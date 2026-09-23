// Centralized Color & Exposure Constants (Section 28)
export const H2S_REFERENCE_COLORS = [
  { percent: 0,   ppm: 0.0,  hex: "#4B197A" },
  { percent: 20,  ppm: 2.0,  hex: "#7047B5" },
  { percent: 40,  ppm: 4.0,  hex: "#937F79" },
  { percent: 60,  ppm: 6.0,  hex: "#987B45" },
  { percent: 80,  ppm: 8.0,  hex: "#E6C229" },
  { percent: 100, ppm: 10.0, hex: "#F28C16" }
];

export const VALIDITY_REFERENCE_COLORS = {
  valid100: "#215F9A",
  valid50: "#407ED3",
  invalid: "#E8E0EF"
};

export const MAX_H2S_PPM = 10;

// Exact H2S Detector Reference Calibration Swatches (0% to 100%)
export const EXACT_REFERENCE_SWATCHES = H2S_REFERENCE_COLORS.map(s => ({
  percentage: s.percent,
  hex: s.hex,
  ppm: s.ppm,
  label: `${s.percent}%`
}));

// Exact Expiry Indicator Reference Swatches
export const EXPIRY_REFERENCE_SWATCHES = [
  { hex: VALIDITY_REFERENCE_COLORS.valid100, status: 'VALID', confidence: 100, label: 'Dark Blue (Valid 100%)' },
  { hex: VALIDITY_REFERENCE_COLORS.valid50, status: 'VALID', confidence: 50, label: 'Light Blue (Valid 50%)' },
  { hex: VALIDITY_REFERENCE_COLORS.invalid, status: 'INVALID', confidence: 0, label: 'White (NOT VALID)' }
];

// ==========================================
// HSV COLOR SPACE & BACKGROUND/SKIN FILTERING
// ==========================================

export function rgbToHsv(r, g, b) {
  const rL = r / 255;
  const gL = g / 255;
  const bL = b / 255;

  const max = Math.max(rL, gL, bL);
  const min = Math.min(rL, gL, bL);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === rL) {
      h = (60 * ((gL - bL) / diff) + 360) % 360;
    } else if (max === gL) {
      h = 60 * ((bL - rL) / diff) + 120;
    } else {
      h = 60 * ((rL - gL) / diff) + 240;
    }
  }

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h, s, v };
}

/**
 * Detects if an RGB pixel belongs to a human skin tone (hand/arm background)
 */
export function isSkinTone(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  const isSkinHue = (h >= 0 && h <= 38) || (h >= 330 && h <= 360);
  const isSkinSat = s >= 0.15 && s <= 0.65;
  const isSkinVal = v >= 0.30 && v <= 0.95;
  const isRgbSkin = r > g && g > b && (r - g) >= 12;

  return isSkinHue && isSkinSat && isSkinVal && isRgbSkin;
}

/**
 * Explicit Protection against false Green / Red Detection (Section 8).
 * Detects if an RGB pixel is green or red.
 * Green or red pixels anywhere outside/inside the candidate search are rejected.
 */
export function isGreenOrRed(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  // Saturated/bright Green (hue 68° to 172°, sat >= 0.12, val >= 0.12)
  const isGreen = (h >= 68 && h <= 172) && (s >= 0.12) && (v >= 0.12);
  // Vivid Red (hue 340°-360° or 0°-16°, sat >= 0.35, r > g + 25 and r > b + 25)
  const isRed = ((h >= 340 && h <= 360) || (h >= 0 && h <= 16)) && (s >= 0.35) && (r - g > 25) && (r - b > 25);

  return isGreen || isRed;
}

/**
 * Checks if pixel is background wall, extreme glare, dark shadow, or green/red object
 */
export function isBackgroundOrNoise(r, g, b, lum) {
  if (isGreenOrRed(r, g, b)) return true;

  const { s, v } = rgbToHsv(r, g, b);

  if (lum < 12 || v < 0.05) return true;
  // Blown-out specular glare (extreme white highlights)
  if (lum > 252 && r > 250 && g > 250 && b > 250) return true;
  // Neutral mid-tone background wall (narrow band lum between 60 and 150 with very low saturation)
  if (s < 0.06 && lum > 60 && lum < 150) return true;

  return false;
}

/**
 * Checks if a pixel matches any calibrated dosimeter strip swatch family
 * (Detector pad #4B197A..#F28C16, Reference swatches, Expiry #215F9A..#E8E0EF)
 */
export function isStripCandidateColor(r, g, b) {
  if (isGreenOrRed(r, g, b)) return { isCandidate: false, family: null };

  const { h, s, v } = rgbToHsv(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  if (isBackgroundOrNoise(r, g, b, lum)) return { isCandidate: false, family: null };

  // 1. Purple/Violet detector pad or reference swatch (#4B197A, #7047B5)
  if (h >= 240 && h <= 305 && s >= 0.28 && v >= 0.15) {
    return { isCandidate: true, family: 'PURPLE' };
  }

  // 2. Yellow/Orange/Gold swatches (#E6C229, #F28C16, #987B45)
  if (h >= 18 && h <= 65 && s >= 0.35 && v >= 0.35) {
    return { isCandidate: true, family: 'YELLOW_ORANGE' };
  }

  // 3. Mauve/Brown swatches (#937F79 - 40% calibration swatch)
  if (h >= 0 && h <= 32 && s >= 0.10 && s <= 0.42 && v >= 0.35 && v <= 0.75) {
    return { isCandidate: true, family: 'MAUVE' };
  }

  // 4. Blue expiry badge swatches (#215F9A, #407ED3)
  if (h >= 195 && h <= 238 && s >= 0.35 && v >= 0.25) {
    return { isCandidate: true, family: 'BLUE_EXPIRY' };
  }

  // 5. White/Light expiry badge swatch (#E8E0EF or light neutral white)
  if (s <= 0.28 && lum >= 160) {
    return { isCandidate: true, family: 'WHITE_EXPIRY' };
  }

  // Skip human skin tone background only if not matching calibrated strip swatches above
  if (isSkinTone(r, g, b)) return { isCandidate: false, family: null };

  return { isCandidate: false, family: null };
}

/**
 * Analyzes a validated cropped physical H2S sensor panel canvas.
 * Extracts LEFT (H2S Detector), MIDDLE (Reference Scale), and RIGHT (Expiry Indicator).
 */
export function analyzeCroppedSensorPanel(croppedCtx, croppedWidth, croppedHeight) {
  if (!croppedCtx || croppedWidth <= 0 || croppedHeight <= 0) {
    return {
      isDetected: false,
      issues: ["Cropped sensor panel canvas is invalid."],
      detectionConfidence: 0
    };
  }

  const innerY = Math.max(0, Math.floor(croppedHeight * 0.10));
  const innerH = Math.max(1, Math.floor(croppedHeight * 0.80));

  const badgeROI = {
    x: Math.max(0, Math.floor(croppedWidth * 0.02)),
    y: innerY,
    w: Math.max(1, Math.floor(croppedWidth * 0.28)),
    h: innerH
  };

  const refROI = {
    x: Math.max(0, Math.floor(croppedWidth * 0.34)),
    y: innerY,
    w: Math.max(1, Math.floor(croppedWidth * 0.38)),
    h: innerH
  };

  const expiryROI = {
    x: Math.max(0, Math.floor(croppedWidth * 0.74)),
    y: innerY,
    w: Math.max(1, Math.floor(croppedWidth * 0.24)),
    h: innerH
  };

  const badgeRGB = extractRobustROIColor(croppedCtx, badgeROI.x, badgeROI.y, badgeROI.w, badgeROI.h);
  const refScaleRGB = extractRobustROIColor(croppedCtx, refROI.x, refROI.y, refROI.w, refROI.h);
  const expiryRGB = extractRobustROIColor(croppedCtx, expiryROI.x, expiryROI.y, expiryROI.w, expiryROI.h);

  if (!badgeRGB || !refScaleRGB || !expiryRGB) {
    return {
      isDetected: false,
      issues: ["Could not extract valid color swatches from cropped sensor panel."],
      detectionConfidence: 0
    };
  }

  return {
    isDetected: true,
    badgeRGB,
    refScaleRGB,
    expiryRGB,
    boundingBox: { x: 0, y: 0, w: croppedWidth, h: croppedHeight },
    regionROIs: { badgeROI, refROI, expiryROI },
    rawWidth: croppedWidth,
    rawHeight: croppedHeight,
    detectionConfidence: 98,
    issues: []
  };
}

/**
 * DYNAMIC PHYSICAL WRISTBAND DETECTION ENGINE
 * Locates the physical wristband assembly anywhere inside a captured or uploaded image.
 * Uses grid clustering, spatial density, multi-family three-region validation, and
 * feature end identification before running color analysis.
 */
export function detectAndSegmentWristband(ctx, width, height) {
  if (!ctx || width <= 0 || height <= 0) {
    return {
      isDetected: false,
      issues: [
        "Uploaded image is not correct.",
        "Please capture a clear image showing the complete H₂S detector wristband."
      ],
      detectionConfidence: 0
    };
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const step = Math.max(2, Math.floor(Math.min(width, height) / 100));
    let candidatePixels = [];
    let skinPixelCount = 0;
    let totalSampled = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        totalSampled++;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 128) continue;

        if (isSkinTone(r, g, b)) {
          skinPixelCount++;
        }

        const match = isStripCandidateColor(r, g, b);
        if (match.isCandidate) {
          candidatePixels.push({ x, y, r, g, b, family: match.family });
        }
      }
    }

    // Hard rejection if insufficient candidate pixels sampled
    if (candidatePixels.length < 20) {
      return {
        isDetected: false,
        issues: [
          "Uploaded image is not correct.",
          "Complete H₂S detector wristband could not be reliably detected in the image."
        ],
        detectionConfidence: 0
      };
    }

    // Grid-based Connected Component Clustering to find contiguous physical object candidate
    const cellSize = Math.max(10, Math.floor(Math.min(width, height) / 30));
    const gridCols = Math.ceil(width / cellSize);
    const gridRows = Math.ceil(height / cellSize);
    const grid = Array.from({ length: gridRows }, () => Array.from({ length: gridCols }, () => []));

    candidatePixels.forEach(p => {
      const c = Math.floor(p.x / cellSize);
      const r = Math.floor(p.y / cellSize);
      if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
        grid[r][c].push(p);
      }
    });

    const visited = Array.from({ length: gridRows }, () => new Array(gridCols).fill(false));
    const clusters = [];

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (visited[r][c] || grid[r][c].length === 0) continue;

        const currentCluster = [];
        const queue = [[r, c]];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [currR, currC] = queue.shift();
          currentCluster.push(...grid[currR][currC]);

          // Check 8-neighbor grid cells
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = currR + dr;
              const nc = currC + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && !visited[nr][nc] && grid[nr][nc].length > 0) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
              }
            }
          }
        }

        if (currentCluster.length >= 15) {
          clusters.push(currentCluster);
        }
      }
    }

    if (clusters.length === 0) {
      return {
        isDetected: false,
        issues: [
          "Uploaded image is not correct.",
          "No contiguous physical wristband object found."
        ],
        detectionConfidence: 0
      };
    }

    // Evaluate each contiguous cluster for physical geometry & 3-region spatial structure
    let bestCandidate = null;

    for (const cluster of clusters) {
      const xs = cluster.map(p => p.x);
      const ys = cluster.map(p => p.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const boxW = Math.max(1, maxX - minX + step);
      const boxH = Math.max(1, maxY - minY + step);

      const isHorizontal = boxW >= boxH;
      const longAxis = isHorizontal ? boxW : boxH;
      const shortAxis = isHorizontal ? boxH : boxW;
      const aspectRatio = longAxis / shortAxis;
      const areaRatio = (boxW * boxH) / (width * height);

      // Grid sampling density fill factor check:
      // Scattered pixels across a person span a huge box with low fill factor.
      const gridSamplesPossible = Math.max(1, (boxW / step) * (boxH / step));
      const fillFactor = cluster.length / gridSamplesPossible;

      // Physical geometry criteria:
      const validAspect = aspectRatio >= 1.5 && aspectRatio <= 9.0;
      const validSize = areaRatio >= 0.005 && longAxis >= 35 && shortAxis >= 10;
      const validDensity = fillFactor >= 0.15; // Must be contiguous wristband object

      if (!validAspect || !validSize || !validDensity) {
        continue;
      }

      // Three-Region Spatial Analysis along long axis (0..33%, 33..66%, 66..100%)
      const sec1 = [];
      const sec2 = [];
      const sec3 = [];

      cluster.forEach(p => {
        const pos = isHorizontal ? (p.x - minX) / boxW : (p.y - minY) / boxH;
        if (pos < 0.33) sec1.push(p);
        else if (pos < 0.66) sec2.push(p);
        else sec3.push(p);
      });

      if (sec1.length < 2 || sec2.length < 2 || sec3.length < 2) {
        continue; // Partial or incomplete regions
      }

      const sec1Families = new Set(sec1.map(p => p.family));
      const sec2Families = new Set(sec2.map(p => p.family));
      const sec3Families = new Set(sec3.map(p => p.family));

      const hasExpiry1 = sec1Families.has('BLUE_EXPIRY') || sec1Families.has('WHITE_EXPIRY');
      const hasExpiry3 = sec3Families.has('BLUE_EXPIRY') || sec3Families.has('WHITE_EXPIRY');
      const hasDetector1 = sec1Families.has('PURPLE') || sec1Families.has('MAUVE') || sec1Families.has('YELLOW_ORANGE');
      const hasDetector3 = sec3Families.has('PURPLE') || sec3Families.has('MAUVE') || sec3Families.has('YELLOW_ORANGE');
      const hasRef2 = sec2Families.size > 0;

      // Must have evidence of all 3 regions (Expiry on one end, Detector on other end, Reference in middle)
      const validThreeRegions = ((hasExpiry1 && hasDetector3) || (hasExpiry3 && hasDetector1)) && hasRef2;

      if (!validThreeRegions) {
        continue;
      }

      const score = (cluster.length / totalSampled) * 100 + fillFactor * 50;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          cluster,
          minX, maxX, minY, maxY,
          boxW, boxH,
          isHorizontal,
          hasExpiry1,
          score
        };
      }
    }

    if (!bestCandidate) {
      return {
        isDetected: false,
        issues: [
          "Uploaded image is not correct.",
          "Physical wristband object was not detected. Please ensure all 3 regions (detector, scale, expiry) are visible."
        ],
        detectionConfidence: 0
      };
    }

    const { minX, maxX, minY, maxY, isHorizontal, hasExpiry1 } = bestCandidate;

    const padX = Math.round((maxX - minX) * 0.04);
    const padY = Math.round((maxY - minY) * 0.04);

    const boxX = Math.max(0, minX - padX);
    const boxY = Math.max(0, minY - padY);
    const boxW = Math.min(width - boxX, (maxX - minX) + padX * 2);
    const boxH = Math.min(height - boxY, (maxY - minY) + padY * 2);

    let badgeROI, refROI, expiryROI;

    if (isHorizontal) {
      const innerY = boxY + boxH * 0.15;
      const innerH = boxH * 0.70;

      if (hasExpiry1) {
        // Expiry indicator is on the LEFT side of image, H2S Detector pad is on the RIGHT side
        expiryROI = { x: Math.round(boxX + boxW * 0.03), y: Math.round(innerY), w: Math.round(boxW * 0.28), h: Math.round(innerH) };
        refROI = { x: Math.round(boxX + boxW * 0.34), y: Math.round(innerY), w: Math.round(boxW * 0.38), h: Math.round(innerH) };
        badgeROI = { x: Math.round(boxX + boxW * 0.73), y: Math.round(innerY), w: Math.round(boxW * 0.24), h: Math.round(innerH) };
      } else {
        // Standard Orientation: H2S Detector pad is on the LEFT, Expiry indicator is on the RIGHT
        badgeROI = { x: Math.round(boxX + boxW * 0.03), y: Math.round(innerY), w: Math.round(boxW * 0.28), h: Math.round(innerH) };
        refROI = { x: Math.round(boxX + boxW * 0.34), y: Math.round(innerY), w: Math.round(boxW * 0.38), h: Math.round(innerH) };
        expiryROI = { x: Math.round(boxX + boxW * 0.73), y: Math.round(innerY), w: Math.round(boxW * 0.24), h: Math.round(innerH) };
      }
    } else {
      // Vertical Wristband orientation (top to bottom)
      const innerX = boxX + boxW * 0.15;
      const innerW = boxW * 0.70;

      if (hasExpiry1) {
        // Expiry on TOP, Detector on BOTTOM
        expiryROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.03), w: Math.round(innerW), h: Math.round(boxH * 0.28) };
        refROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.34), w: Math.round(innerW), h: Math.round(boxH * 0.38) };
        badgeROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.73), w: Math.round(innerW), h: Math.round(boxH * 0.24) };
      } else {
        // Detector on TOP, Expiry on BOTTOM
        badgeROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.03), w: Math.round(innerW), h: Math.round(boxH * 0.28) };
        refROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.34), w: Math.round(innerW), h: Math.round(boxH * 0.38) };
        expiryROI = { x: Math.round(innerX), y: Math.round(boxY + boxH * 0.73), w: Math.round(innerW), h: Math.round(boxH * 0.24) };
      }
    }

    const badgeRGB = extractRobustROIColor(ctx, badgeROI.x, badgeROI.y, badgeROI.w, badgeROI.h);
    const refScaleRGB = extractRobustROIColor(ctx, refROI.x, refROI.y, refROI.w, refROI.h);
    const expiryRGB = extractRobustROIColor(ctx, expiryROI.x, expiryROI.y, expiryROI.w, expiryROI.h);

    if (!badgeRGB || !refScaleRGB || !expiryRGB) {
      return {
        isDetected: false,
        issues: [
          "Uploaded image is not correct.",
          "Could not isolate valid physical detector, scale, and expiry regions from the wristband."
        ],
        detectionConfidence: 0
      };
    }

    const isSkinDominant = (skinPixelCount / totalSampled) > 0.70;
    let detectionConfidence = Math.round(Math.min(96, (bestCandidate.cluster.length / (totalSampled * 0.12)) * 100));
    if (isSkinDominant) detectionConfidence = Math.max(30, detectionConfidence - 20);

    return {
      isDetected: true,
      badgeRGB,
      refScaleRGB,
      expiryRGB,
      boundingBox: {
        x: Math.round(boxX),
        y: Math.round(boxY),
        w: Math.round(boxW),
        h: Math.round(boxH)
      },
      regionROIs: {
        badgeROI,
        refROI,
        expiryROI
      },
      rawWidth: width,
      rawHeight: height,
      detectionConfidence,
      issues: []
    };
  } catch (err) {
    console.error("[SULFIDE SENTINELS] Wristband detection error:", err);
    return {
      isDetected: false,
      issues: ["Error during dynamic wristband detection.", err.message],
      detectionConfidence: 0
    };
  }
}

/**
 * Estimates ambient lighting transformation from detected reference scale swatches
 * and applies lighting correction to the raw detector RGB. (Section 13)
 */
export function applyLightingCorrection(badgeRGB, refScaleRGB) {
  if (!badgeRGB) return { rawHex: '#000000', correctedHex: '#000000', correctedRGB: badgeRGB };

  const rawHex = badgeRGB.hex || rgbToHex(badgeRGB.r, badgeRGB.g, badgeRGB.b);

  if (!refScaleRGB) {
    return { rawHex, correctedHex: rawHex, correctedRGB: badgeRGB };
  }

  // Baseline ideal luminance of reference scale ~ 45
  const idealLum = 45;
  const measuredLum = refScaleRGB.luminance || (0.299 * refScaleRGB.r + 0.587 * refScaleRGB.g + 0.114 * refScaleRGB.b);
  const lumRatio = measuredLum > 0 ? (idealLum / measuredLum) : 1.0;

  // Clamp gain factor between 0.75 and 1.35 to prevent extreme color distortion
  const clampedGain = Math.max(0.75, Math.min(1.35, lumRatio));

  const corrR = Math.round(Math.max(0, Math.min(255, badgeRGB.r * clampedGain)));
  const corrG = Math.round(Math.max(0, Math.min(255, badgeRGB.g * clampedGain)));
  const corrB = Math.round(Math.max(0, Math.min(255, badgeRGB.b * clampedGain)));

  const correctedHex = rgbToHex(corrR, corrG, corrB);

  return {
    rawHex,
    correctedHex,
    correctedRGB: {
      r: corrR,
      g: corrG,
      b: corrB,
      hex: correctedHex,
      luminance: Math.round(0.299 * corrR + 0.587 * corrG + 0.114 * corrB),
      pixelCount: badgeRGB.pixelCount,
      stdDev: badgeRGB.stdDev
    }
  };
}


// ==========================================
// COLOR SPACE CONVERSIONS (sRGB -> XYZ -> CIELAB)
// ==========================================

export function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

/**
 * Converts RGB [0..255] to CIELAB [L*, a*, b*]
 * Uses standard D65 2-degree observer reference white point.
 */
export function rgbToLab(r, g, b) {
  // 1. sRGB to linear RGB
  let rL = r / 255;
  let gL = g / 255;
  let bL = b / 255;

  rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
  gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
  bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

  // 2. Linear RGB to XYZ (D65 white point)
  let x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) * 100;
  let y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) * 100;
  let z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) * 100;

  // D65 reference white constants
  const xn = 95.047;
  const yn = 100.000;
  const zn = 108.883;

  let xr = x / xn;
  let yr = y / yn;
  let zr = z / zn;

  const f = t => t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t) + (16 / 116);

  let fx = f(xr);
  let fy = f(yr);
  let fz = f(zr);

  let L = (116 * fy) - 16;
  let a = 500 * (fx - fy);
  let bVal = 200 * (fy - fz);

  return { L, a, b: bVal };
}

export function hexToLab(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

/**
 * Calculates CIELAB Delta E (CIE76 color distance)
 */
export function deltaE(lab1, lab2) {
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

// Pre-calculate CIELAB values for exact reference swatches
const PRECOMPUTED_SCALE_LAB = EXACT_REFERENCE_SWATCHES.map(s => ({
  ...s,
  lab: hexToLab(s.hex)
}));

const PRECOMPUTED_EXPIRY_LAB = EXPIRY_REFERENCE_SWATCHES.map(s => ({
  ...s,
  lab: hexToLab(s.hex)
}));

// ==========================================
// ROBUST PIXEL EXTRACTION (TRIMMED MEAN)
// ==========================================

/**
 * Extracts a robust representative color from a canvas ROI using trimmed mean/median,
 * excluding border pixels, specular glare, text, and extreme background noise.
 */
export function extractRobustROIColor(ctx, x, y, width, height) {
  try {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    const imageData = ctx.getImageData(startX, startY, w, h);
    const data = imageData.data;

    let validPixels = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];

      if (alpha < 128) continue; // Skip transparent

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Filter specular glare highlights (extreme lum > 252) or pitch dark borders (lum < 12)
      if (lum > 252 || lum < 12) continue;

      validPixels.push({ r, g, b, lum });
    }

    // Fallback if all pixels were filtered out
    if (validPixels.length < 5) {
      validPixels = [];
      for (let i = 0; i < data.length; i += 4) {
        validPixels.push({ r: data[i], g: data[i + 1], b: data[i + 2], lum: 128 });
      }
    }

    if (validPixels.length === 0) return null;

    // Sort by luminance to perform 10% trimmed mean
    validPixels.sort((p1, p2) => p1.lum - p2.lum);
    const trimCount = Math.floor(validPixels.length * 0.1);
    const trimmed = validPixels.slice(trimCount, validPixels.length - trimCount);

    let rSum = 0, gSum = 0, bSum = 0;
    let brightnesses = [];

    trimmed.forEach(p => {
      rSum += p.r;
      gSum += p.g;
      bSum += p.b;
      brightnesses.push(p.lum);
    });

    const count = trimmed.length;
    const avgR = Math.round(rSum / count);
    const avgG = Math.round(gSum / count);
    const avgB = Math.round(bSum / count);

    const avgLum = brightnesses.reduce((a, b) => a + b, 0) / count;
    const variance = brightnesses.reduce((sum, val) => sum + Math.pow(val - avgLum, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      r: avgR,
      g: avgG,
      b: avgB,
      hex: rgbToHex(avgR, avgG, avgB),
      luminance: Math.round(avgLum),
      stdDev: Math.round(stdDev * 10) / 10,
      pixelCount: count,
      glareRatio: Math.round(((validPixels.length - count) / validPixels.length) * 100) / 100
    };
  } catch (err) {
    console.error("Robust ROI color extraction error:", err);
    return null;
  }
}

// ==========================================
// ==========================================
// EXPIRY INDICATOR CLASSIFICATION
// ==========================================

export function classifyExpiryIndicator(expiryRGB) {
  if (!expiryRGB || expiryRGB.pixelCount < 3) {
    return {
      isClassified: false,
      isExpired: false,
      status: 'UNCLASSIFIED',
      confidence: 0,
      hex: expiryRGB?.hex || '#000000',
      message: 'Expiry indicator not detected or insufficient pixels.'
    };
  }

  const { s } = rgbToHsv(expiryRGB.r, expiryRGB.g, expiryRGB.b);
  const lum = 0.299 * expiryRGB.r + 0.587 * expiryRGB.g + 0.114 * expiryRGB.b;

  // Direct White / Light Neutral Expiry Badge Check (#E8E0EF or light off-white)
  // White/off-white appearance on expiry indicator ALWAYS signifies INVALID strip.
  if (s <= 0.28 && lum >= 155) {
    return {
      isClassified: true,
      isExpired: true,
      status: 'INVALID',
      confidence: 0,
      matchedHex: VALIDITY_REFERENCE_COLORS.invalid,
      detectedHex: expiryRGB.hex,
      distance: 0,
      label: 'White (NOT VALID / EXPIRED)'
    };
  }

  const measuredLab = rgbToLab(expiryRGB.r, expiryRGB.g, expiryRGB.b);

  let minDistance = Infinity;
  let bestMatch = null;

  PRECOMPUTED_EXPIRY_LAB.forEach(swatch => {
    const dist = deltaE(measuredLab, swatch.lab);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = swatch;
    }
  });

  // Strict tolerance threshold Delta E <= 25 to classify
  if (minDistance > 25 || !bestMatch) {
    return {
      isClassified: false,
      isExpired: false,
      status: 'UNCLASSIFIED',
      confidence: 0,
      hex: expiryRGB.hex,
      distance: Math.round(minDistance * 10) / 10,
      message: 'Expiry indicator could not be reliably classified.'
    };
  }

  const isExpired = bestMatch.status === 'INVALID';
  let formattedStatus = 'UNCLASSIFIED';
  if (bestMatch.hex === VALIDITY_REFERENCE_COLORS.valid100) formattedStatus = 'VALID_100';
  else if (bestMatch.hex === VALIDITY_REFERENCE_COLORS.valid50) formattedStatus = 'VALID_50';
  else if (isExpired) formattedStatus = 'INVALID';

  return {
    isClassified: true,
    isExpired,
    status: formattedStatus,
    confidence: bestMatch.confidence,
    matchedHex: bestMatch.hex,
    detectedHex: expiryRGB.hex,
    distance: Math.round(minDistance * 10) / 10,
    label: bestMatch.label
  };
}

// ==========================================
// COLOR MATCHING & CONTINUOUS INTERPOLATION
// ==========================================

/**
 * Maps measured detector color to continuous exposure percentage [0%..100%]
 * using CIELAB color space distance interpolation against reference scale swatches.
 */
export function interpolateDetectorExposure(detectorRGB) {
  if (!detectorRGB) return null;

  const measuredLab = rgbToLab(detectorRGB.r, detectorRGB.g, detectorRGB.b);

  // Calculate distance to all 6 exact reference swatches
  const distances = PRECOMPUTED_SCALE_LAB.map((swatch, idx) => ({
    index: idx,
    percentage: swatch.percentage,
    hex: swatch.hex,
    ppm: swatch.ppm,
    dist: deltaE(measuredLab, swatch.lab)
  }));

  // Check for exact match (Delta E < 2.0)
  const exactMatch = distances.find(d => d.dist < 2.0);
  if (exactMatch) {
    return {
      isExactMatch: true,
      percentage: exactMatch.percentage,
      ppm: exactMatch.ppm,
      detectedHex: detectorRGB.hex,
      matchedHex: exactMatch.hex,
      matchMessage: `Exact Match: ${exactMatch.hex} (${exactMatch.percentage}%)`,
      lowerSwatch: null,
      upperSwatch: null
    };
  }

  // Find two closest/bracketing swatches along the scale order [0%, 20%, 40%, 60%, 80%, 100%]
  // Sort distances to find closest primary swatch
  distances.sort((a, b) => a.dist - b.dist);
  const primaryIndex = distances[0].index;

  // Determine neighboring secondary index (left or right neighbor in scale order)
  let secondaryIndex = primaryIndex + 1;
  if (primaryIndex === PRECOMPUTED_SCALE_LAB.length - 1) {
    secondaryIndex = primaryIndex - 1;
  } else if (primaryIndex > 0) {
    const leftDist = deltaE(measuredLab, PRECOMPUTED_SCALE_LAB[primaryIndex - 1].lab);
    const rightDist = deltaE(measuredLab, PRECOMPUTED_SCALE_LAB[primaryIndex + 1].lab);
    if (leftDist < rightDist) {
      secondaryIndex = primaryIndex - 1;
    }
  }

  const iLower = Math.min(primaryIndex, secondaryIndex);
  const iUpper = Math.max(primaryIndex, secondaryIndex);

  const lowerSwatch = PRECOMPUTED_SCALE_LAB[iLower];
  const upperSwatch = PRECOMPUTED_SCALE_LAB[iUpper];

  const dLower = deltaE(measuredLab, lowerSwatch.lab);
  const dUpper = deltaE(measuredLab, upperSwatch.lab);

  // Linear ratio between lower and upper reference points based on inverse color distance
  const totalD = dLower + dUpper;
  const weightLower = totalD > 0 ? (1 - dLower / totalD) : 0.5;

  const interpolatedPercentage = lowerSwatch.percentage + (upperSwatch.percentage - lowerSwatch.percentage) * weightLower;
  const clampedPercentage = Math.min(100.0, Math.max(0.0, Math.round(interpolatedPercentage * 10) / 10));

  const ppm = Math.min(10.0, Math.max(0.0, Math.round((clampedPercentage / 10) * 100) / 100));

  return {
    isExactMatch: false,
    percentage: clampedPercentage,
    ppm: ppm,
    detectedHex: detectorRGB.hex,
    matchedHex: null,
    matchMessage: 'Between reference levels',
    lowerSwatch: { hex: lowerSwatch.hex, percentage: lowerSwatch.percentage, ppm: lowerSwatch.ppm },
    upperSwatch: { hex: upperSwatch.hex, percentage: upperSwatch.percentage, ppm: upperSwatch.ppm }
  };
}

/**
 * Calculates real optical sharpness using 2D Laplacian operator variance over grayscale pixels. (Phase 11)
 */
export function calculateLaplacianVariance(imageData) {
  if (!imageData || !imageData.data || imageData.width <= 2 || imageData.height <= 2) return 0;
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0, count = 0;
  const lap = new Float32Array((width - 2) * (height - 2));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const val = gray[(y - 1) * width + x] + gray[(y + 1) * width + x] +
        gray[y * width + (x - 1)] + gray[y * width + (x + 1)] -
        4 * gray[y * width + x];
      lap[count++] = val;
      sum += val;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  let varSum = 0;
  for (let i = 0; i < count; i++) {
    const diff = lap[i] - mean;
    varSum += diff * diff;
  }
  return varSum / count;
}

// ==========================================
// IMAGE VALIDATION & ANALYSIS CONFIDENCE
// ==========================================

export function validateWristbandImage(badgeData, refScaleData, expiryData, detectionInfo) {
  const issues = [];
  let isReliable = true;
  let errorCode = null;

  if (detectionInfo && !detectionInfo.isDetected) {
    const rawW = detectionInfo.rawWidth || 0;
    if (rawW > 0 && rawW < 200) {
      errorCode = 'LOW_RESOLUTION';
    } else {
      errorCode = 'WRISTBAND_NOT_FOUND';
    }
    return {
      isValid: false,
      errorCode,
      issues: detectionInfo.issues && detectionInfo.issues.length > 0
        ? detectionInfo.issues
        : [
          "Uploaded image is not correct.",
          "Please capture a clear image showing the complete H₂S detector wristband."
        ],
      analysisConfidence: detectionInfo.detectionConfidence ?? 0
    };
  }

  if (!badgeData || !refScaleData || !expiryData) {
    return {
      isValid: false,
      errorCode: 'UNRELATED_IMAGE',
      issues: [
        "Uploaded image is not correct.",
        "Please capture a clear image showing the complete H₂S detector wristband."
      ],
      analysisConfidence: 0
    };
  }

  // 1. Check ROI presence & partial wristband
  if (badgeData.pixelCount < 8 || refScaleData.pixelCount < 8 || expiryData.pixelCount < 4) {
    issues.push("Error: Partial wristband or incomplete regions detected.");
    errorCode = 'PARTIAL_WRISTBAND';
    isReliable = false;
  }

  // 2. Glare Check
  if (badgeData.luminance > 242 || refScaleData.luminance > 245) {
    issues.push("Error: Excessive glare reflection detected on detector pad.");
    if (!errorCode) errorCode = 'EXCESSIVE_GLARE';
    isReliable = false;
  }

  // 3. Underexposure / Lighting Check
  if (badgeData.luminance < 20 || refScaleData.luminance < 20) {
    issues.push("Error: Severe darkness / insufficient lighting for optical analysis.");
    if (!errorCode) errorCode = 'TOO_DARK';
    isReliable = false;
  }

  // 4. Blur / Sharpness Check
  if (badgeData.stdDev < 0.3) {
    issues.push("Error: Image is too blurry for reliable optical analysis.");
    if (!errorCode) errorCode = 'BLURRY_IMAGE';
    isReliable = false;
  }

  // Compute Analysis Confidence Score (0% - 100%)
  let sharpnessScore = Math.min(100, badgeData.stdDev * 8);
  let lightingScore = Math.max(0, 100 - Math.abs(badgeData.luminance - 128) * 0.7);
  let glareScore = Math.max(0, 100 - (badgeData.glareRatio || 0) * 100);

  let analysisConfidence = Math.round((sharpnessScore * 0.3) + (lightingScore * 0.4) + (glareScore * 0.3));
  analysisConfidence = Math.min(98, Math.max(10, analysisConfidence));

  if (!isReliable) analysisConfidence = Math.min(30, analysisConfidence);

  return {
    isValid: isReliable && issues.length === 0,
    errorCode,
    issues,
    analysisConfidence
  };
}

// ==========================================
// EXPOSURE DOSE MATH & DUAL-SCAN CALCULATIONS
// ==========================================

export function calculateNetExposure({
  preShiftRecord,
  postShiftDetector,
  postShiftTimestamp,
  expiryResult
}) {
  if (!postShiftDetector) {
    return {
      postPpm: 0,
      postPercentage: 0,
      prePpm: 0,
      prePercentage: 0,
      netPpm: 0,
      exposureDurationHours: null,
      dosePpmH: null,
      finalStatus: "ANALYSIS_INCOMPLETE",
      statusColor: "#64748B",
      badgeClass: "bg-slate-500/20 text-slate-400 border-slate-500/40",
      recommendation: "Optical analysis incomplete.",
      preTimestamp: null
    };
  }

  const postPpm = postShiftDetector.ppm ?? 0;
  const postPercentage = postShiftDetector.percentage ?? 0;

  let prePpm = 0.0;
  let prePercentage = 0.0;
  let preTimestamp = null;
  let exposureDurationHours = null;
  let dosePpmH = null;

  if (preShiftRecord && preShiftRecord.timestamp) {
    prePpm = preShiftRecord.detectorPpm !== undefined && preShiftRecord.detectorPpm !== null ? preShiftRecord.detectorPpm : 0.0;
    prePercentage = preShiftRecord.detectorPercentage !== undefined && preShiftRecord.detectorPercentage !== null ? preShiftRecord.detectorPercentage : 0.0;
    preTimestamp = preShiftRecord.timestamp;

    const tPre = new Date(preShiftRecord.timestamp).getTime();
    const tPost = new Date(postShiftTimestamp).getTime();

    if (!isNaN(tPre) && !isNaN(tPost) && tPost > tPre) {
      const diffMs = tPost - tPre;
      exposureDurationHours = Math.round((diffMs / 3600000) * 100) / 100;
    } else {
      exposureDurationHours = 0.0;
    }
  }

  // Net Concentration = max(0, postPpm - prePpm)
  const netPpm = Math.max(0.0, Math.round((postPpm - prePpm) * 100) / 100);

  // Time-integrated Dose = netPpm * exposureDurationHours
  if (exposureDurationHours !== null && exposureDurationHours > 0) {
    dosePpmH = Math.round((netPpm * exposureDurationHours) * 100) / 100;
  } else if (exposureDurationHours === 0) {
    dosePpmH = 0.0;
  }

  // Determine Project-Defined Optical Status (Phases 14, 16 & 17)
  let finalStatus = "SAFE";
  let statusColor = "#10B981";
  let badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  let recommendation = "Project-defined optical reading within normal parameters. Continue standard operations.";

  if (expiryResult && (expiryResult.status === 'UNCLASSIFIED' || !expiryResult.isClassified)) {
    finalStatus = "UNCLASSIFIED";
    statusColor = "#94A3B8";
    badgeClass = "bg-slate-500/20 text-slate-300 border-slate-500/40";
    recommendation = "Expiry indicator could not be reliably classified. Inspect wristband visually.";
  } else if (expiryResult && expiryResult.isExpired) {
    finalStatus = "INVALID STRIP";
    statusColor = "#EF4444";
    badgeClass = "bg-red-500/20 text-red-400 border-red-500/40";
    recommendation = "🚨 STRIP INVALID: Expiry indicator shows that the detector strip is not valid. Replace dosimeter before shift.";
  } else if (dosePpmH !== null && dosePpmH > 50) {
    finalStatus = "CRITICAL";
    statusColor = "#EF4444";
    badgeClass = "bg-red-500/20 text-red-400 border-red-500/40";
    recommendation = "PROJECT-DEFINED EXPOSURE ALERT: Estimated time-integrated dose exceeded 50 ppm·h. Follow site safety procedures.";
  } else if (dosePpmH !== null && dosePpmH > 10) {
    finalStatus = "WARNING";
    statusColor = "#F59E0B";
    badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";
    recommendation = "ELEVATED EXPOSURE NOTICE: Estimated time-integrated dose between 10-50 ppm·h. Inspect area ventilation.";
  }

  return {
    postPpm,
    postPercentage,
    prePpm,
    prePercentage,
    netPpm,
    exposureDurationHours,
    dosePpmH,
    finalStatus,
    statusColor,
    badgeClass,
    recommendation,
    preTimestamp
  };
}

// Preset Badges without any SIH references
export const DEMO_PRESET_BADGES = [
  {
    id: 'preshift_baseline',
    name: '🔵 1. PRE-SHIFT BASELINE SCAN (Unexposed #4B197A)',
    description: 'Detector: 0% (#4B197A, 0.0 ppm) | Expiry: #215F9A (Valid 100%)',
    scanStage: 'PRE_SHIFT',
    badgeRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 14.2 },
    refRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 15.0 },
    expiryRGB: { r: 33, g: 95, b: 154, hex: '#215F9A' }
  },
  {
    id: 'postshift_moderate',
    name: '🟡 2. POST-SHIFT SCAN (Interpolated ~35% / 3.5 ppm)',
    description: 'Detector: #937F79 (~35% Interpolated) | Expiry: #407ED3 (Valid 50%)',
    scanStage: 'POST_SHIFT',
    badgeRGB: { r: 147, g: 127, b: 121, hex: '#937F79', luminance: 128, stdDev: 12.8 },
    refRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 15.0 },
    expiryRGB: { r: 64, g: 126, b: 211, hex: '#407ED3' }
  },
  {
    id: 'postshift_critical',
    name: '🔴 3. POST-SHIFT SCAN (High ~80% / 8.0 ppm)',
    description: 'Detector: #E6C229 (80%, 8.0 ppm) | Expiry: #215F9A (Valid 100%)',
    scanStage: 'POST_SHIFT',
    badgeRGB: { r: 230, g: 194, b: 41, hex: '#E6C229', luminance: 180, stdDev: 13.5 },
    refRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 15.0 },
    expiryRGB: { r: 33, g: 95, b: 154, hex: '#215F9A' }
  },
  {
    id: 'expiry_invalid',
    name: '🚨 4. INVALID STRIP ALERT (#E8E0EF White Expiry)',
    description: 'Expiry Badge: #E8E0EF (White 0%) -> Immediately triggers INVALID STRIP Alert',
    scanStage: 'PRE_SHIFT',
    badgeRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 14.0 },
    refRGB: { r: 75, g: 25, b: 122, hex: '#4B197A', luminance: 45, stdDev: 15.0 },
    expiryRGB: { r: 232, g: 224, b: 239, hex: '#E8E0EF' }
  }
];
