import test from 'node:test';
import assert from 'node:assert/strict';

import {
  H2S_REFERENCE_COLORS,
  VALIDITY_REFERENCE_COLORS,
  interpolateDetectorExposure,
  classifyExpiryIndicator,
  validateWristbandImage,
  calculateNetExposure,
  calculateLaplacianVariance,
  rgbToLab,
  deltaE
} from './colorAnalyzer.js';

test('Phase 8: H2S Six Reference Calibration Colors & CIELAB Interpolation', () => {
  // Test reference color array structure
  assert.equal(H2S_REFERENCE_COLORS.length, 6);
  assert.equal(H2S_REFERENCE_COLORS[0].hex, '#4B197A');
  assert.equal(H2S_REFERENCE_COLORS[5].hex, '#F28C16');

  // Test validity reference colors structure
  assert.equal(VALIDITY_REFERENCE_COLORS.valid100, '#215F9A');
  assert.equal(VALIDITY_REFERENCE_COLORS.valid50, '#407ED3');
  assert.equal(VALIDITY_REFERENCE_COLORS.invalid, '#E8E0EF');

  // Test CIELAB color conversion and Delta-E distance
  const labWhite = rgbToLab(255, 255, 255);
  assert.ok(labWhite.L > 99, 'White L* value should be approximately 100');
  const dE = deltaE(labWhite, labWhite);
  assert.equal(dE, 0, 'Delta E distance between identical colors must be zero');

  // Test exact 0% (#4B197A / 0.0 ppm)
  const res0 = interpolateDetectorExposure({ r: 75, g: 25, b: 122, hex: '#4B197A' });
  assert.equal(res0.ppm, 0.0);
  assert.equal(res0.percentage, 0);

  // Test exact 20% (#7047B5 / 2.0 ppm)
  const res20 = interpolateDetectorExposure({ r: 112, g: 71, b: 181, hex: '#7047B5' });
  assert.equal(res20.ppm, 2.0);
  assert.equal(res20.percentage, 20);

  // Test exact 100% (#F28C16 / 10.0 ppm)
  const res100 = interpolateDetectorExposure({ r: 242, g: 140, b: 22, hex: '#F28C16' });
  assert.equal(res100.ppm, 10.0);
  assert.equal(res100.percentage, 100);

  // Test intermediate continuous interpolation (~35%)
  const resMid = interpolateDetectorExposure({ r: 147, g: 127, b: 121, hex: '#937F79' });
  assert.ok(resMid.ppm > 3.0 && resMid.ppm < 5.0, 'Intermediate ppm should interpolate between 3.0 and 5.0');
});

test('Phase 12: Expiry Indicator Classification & Unclassified Status', () => {
  // Dark Blue 100% Valid (#215F9A)
  const exp100 = classifyExpiryIndicator({ r: 33, g: 95, b: 154, hex: '#215F9A', pixelCount: 10 });
  assert.equal(exp100.status, 'VALID_100');
  assert.equal(exp100.confidence, 100);

  // Light Blue 50% Valid (#407ED3)
  const exp50 = classifyExpiryIndicator({ r: 64, g: 126, b: 211, hex: '#407ED3', pixelCount: 10 });
  assert.equal(exp50.status, 'VALID_50');
  assert.equal(exp50.confidence, 50);

  // White Invalid (#E8E0EF)
  const expInv = classifyExpiryIndicator({ r: 232, g: 224, b: 239, hex: '#E8E0EF', pixelCount: 10 });
  assert.equal(expInv.status, 'INVALID');
  assert.equal(expInv.confidence, 0);

  // Random/Unrelated color -> UNCLASSIFIED with 0 confidence
  const expUnclass = classifyExpiryIndicator({ r: 50, g: 200, b: 50, hex: '#32C832', pixelCount: 10 });
  assert.equal(expUnclass.status, 'UNCLASSIFIED');
  assert.equal(expUnclass.confidence, 0);
});

test('Phase 11: Image Quality Validation & Laplacian Variance', () => {
  // Test Laplacian Variance sharpness measurement on synthetic image buffer
  const width = 10, height = 10;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const val = ((x + y) % 2 === 0) ? 255 : 0;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  const variance = calculateLaplacianVariance({ data, width, height });
  assert.ok(variance > 0, 'Laplacian variance should be positive for non-uniform image');

  // Test detection failure -> WRISTBAND_NOT_FOUND
  const valFailed = validateWristbandImage(null, null, null, { isDetected: false, issues: ["Wristband not found"] });
  assert.equal(valFailed.isValid, false);
  assert.equal(valFailed.errorCode, 'WRISTBAND_NOT_FOUND');
  assert.equal(valFailed.analysisConfidence, 0);
});

test('Phase 15 & 16: Pre/Post Exposure Dose Math & Overnight Shift Duration', () => {
  // Overnight shift: 22:00 to 06:00 (8 hours)
  const preRecord = {
    detectorPpm: 0.0,
    timestamp: '2026-09-23T22:00:00.000Z'
  };
  const postDetector = { ppm: 3.5, percentage: 35 };
  const postTimestamp = '2026-09-24T06:00:00.000Z';

  const net = calculateNetExposure({
    preShiftRecord: preRecord,
    postShiftDetector: postDetector,
    postShiftTimestamp: postTimestamp,
    expiryResult: { isExpired: false, isClassified: true, status: 'VALID_100' }
  });

  assert.equal(net.exposureDurationHours, 8.0);
  assert.equal(net.netPpm, 3.5);
  assert.equal(net.dosePpmH, 28.0); // 3.5 * 8 = 28.0 ppm*h
  assert.equal(net.finalStatus, 'WARNING'); // 10-50 ppm*h -> WARNING
});

test('Phase 14: Unclassified Expiry Preservation', () => {
  const postDetector = { ppm: 1.0, percentage: 10 };
  const net = calculateNetExposure({
    preShiftRecord: null,
    postShiftDetector: postDetector,
    postShiftTimestamp: '2026-09-24T06:00:00.000Z',
    expiryResult: { isExpired: false, isClassified: false, status: 'UNCLASSIFIED' }
  });

  assert.equal(net.finalStatus, 'UNCLASSIFIED');
});

function createMockContext(width, height, drawFn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 120;
    data[i * 4 + 1] = 120;
    data[i * 4 + 2] = 120;
    data[i * 4 + 3] = 255;
  }

  function setPixel(x, y, r, g, b, a = 255) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  function fillRect(rx, ry, rw, rh, r, g, b, a = 255) {
    for (let y = Math.floor(ry); y < Math.floor(ry + rh); y++) {
      for (let x = Math.floor(rx); x < Math.floor(rx + rw); x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  if (drawFn) drawFn({ setPixel, fillRect });

  return {
    getImageData: (x, y, w, h) => {
      const subData = new Uint8ClampedArray(w * h * 4);
      for (let subY = 0; subY < h; subY++) {
        for (let subX = 0; subX < w; subX++) {
          const origX = Math.floor(x + subX);
          const origY = Math.floor(y + subY);
          const subIdx = (subY * w + subX) * 4;
          if (origX >= 0 && origX < width && origY >= 0 && origY < height) {
            const origIdx = (origY * width + origX) * 4;
            subData[subIdx] = data[origIdx];
            subData[subIdx + 1] = data[origIdx + 1];
            subData[subIdx + 2] = data[origIdx + 2];
            subData[subIdx + 3] = data[origIdx + 3];
          }
        }
      }
      return { data: subData, width: w, height: h };
    }
  };
}

test('Phase 10 & 17: Physical Wristband Rejection of Non-Wristband Images', async () => {
  const { detectAndSegmentWristband } = await import('./colorAnalyzer.js');

  // 1. Person photo (skin tones + background, no wristband) -> REJECT
  const personCtx = createMockContext(200, 200, ({ fillRect }) => {
    fillRect(40, 40, 100, 100, 210, 160, 130); // Skin tone
    fillRect(20, 20, 160, 30, 80, 50, 40);    // Hair / clothing
  });
  const resPerson = detectAndSegmentWristband(personCtx, 200, 200);
  assert.equal(resPerson.isDetected, false);
  assert.equal(resPerson.detectionConfidence, 0);

  // 2. Single purple object -> REJECT
  const purpleCtx = createMockContext(200, 200, ({ fillRect }) => {
    fillRect(50, 50, 80, 60, 75, 25, 122); // Purple mug (#4B197A)
  });
  const resPurple = detectAndSegmentWristband(purpleCtx, 200, 200);
  assert.equal(resPurple.isDetected, false);

  // 3. Single yellow object -> REJECT
  const yellowCtx = createMockContext(200, 200, ({ fillRect }) => {
    fillRect(50, 50, 80, 60, 230, 194, 41); // Yellow book (#E6C229)
  });
  const resYellow = detectAndSegmentWristband(yellowCtx, 200, 200);
  assert.equal(resYellow.isDetected, false);

  // 4. Single blue object -> REJECT
  const blueCtx = createMockContext(200, 200, ({ fillRect }) => {
    fillRect(50, 50, 80, 60, 33, 95, 154); // Blue poster (#215F9A)
  });
  const resBlue = detectAndSegmentWristband(blueCtx, 200, 200);
  assert.equal(resBlue.isDetected, false);

  // 5. Partial wristband (only ref scale, missing expiry indicator) -> REJECT
  const partialCtx = createMockContext(200, 200, ({ fillRect }) => {
    fillRect(30, 80, 40, 30, 75, 25, 122);  // Detector pad (#4B197A)
    fillRect(70, 80, 50, 30, 147, 127, 121); // Ref scale (#937F79)
  });
  const resPartial = detectAndSegmentWristband(partialCtx, 200, 200);
  assert.equal(resPartial.isDetected, false);
});

test('Phase 17: Valid Complete Wristband Detection & Orientation', async () => {
  const { detectAndSegmentWristband } = await import('./colorAnalyzer.js');

  // Complete Valid Horizontal Wristband: Detector pad (left) + Ref Scale (mid) + Expiry (right)
  const validHorizCtx = createMockContext(240, 160, ({ fillRect }) => {
    fillRect(20, 60, 50, 35, 75, 25, 122);   // Left: Detector Pad (#4B197A)
    fillRect(70, 60, 60, 35, 147, 127, 121); // Middle: Ref Scale (#937F79)
    fillRect(130, 60, 40, 35, 33, 95, 154);  // Right: Expiry (#215F9A)
  });

  const resValid = detectAndSegmentWristband(validHorizCtx, 240, 160);
  assert.equal(resValid.isDetected, true);
  assert.ok(resValid.detectionConfidence > 0);
  assert.ok(resValid.regionROIs.badgeROI.x < resValid.regionROIs.expiryROI.x, 'Detector ROI should be to the left of Expiry ROI');

  // Complete Reversed Wristband: Expiry (left) + Ref Scale (mid) + Detector pad (right)
  const reversedCtx = createMockContext(240, 160, ({ fillRect }) => {
    fillRect(20, 60, 40, 35, 33, 95, 154);   // Left: Expiry (#215F9A)
    fillRect(60, 60, 60, 35, 147, 127, 121); // Middle: Ref Scale (#937F79)
    fillRect(120, 60, 50, 35, 75, 25, 122);  // Right: Detector Pad (#4B197A)
  });

  const resReversed = detectAndSegmentWristband(reversedCtx, 240, 160);
  assert.equal(resReversed.isDetected, true);
  assert.ok(resReversed.regionROIs.badgeROI.x > resReversed.regionROIs.expiryROI.x, 'In reversed wristband, Detector ROI should be to the right of Expiry ROI');
});

test('Phase 20 & Groq Vision: Detection Response Validation & Bounding Box Boundaries', async () => {
  const { validateGroqDetectionResponse } = await import('../ai/groqStripDetector.js');

  // 1. Valid H2S sensor panel detection
  const validRes = validateGroqDetectionResponse({
    stripDetected: true,
    confidence: 0.95,
    x: 0.20,
    y: 0.30,
    width: 0.50,
    height: 0.25,
    orientation: 'horizontal',
    reason: 'Physical H2S sensor panel detected.'
  }, 1000, 800);

  assert.equal(validRes.isValid, true);
  assert.equal(validRes.confidence, 0.95);
  assert.equal(validRes.x, 0.20);
  assert.equal(validRes.width, 0.50);

  // 2. Rejection response (stripDetected = false)
  const rejectedRes = validateGroqDetectionResponse({
    stripDetected: false,
    confidence: 0.90,
    x: 0, y: 0, width: 0, height: 0,
    orientation: 'unknown',
    reason: 'No physical H2S sensor panel detected.'
  }, 1000, 800);

  assert.equal(rejectedRes.isValid, false);

  // 3. Out-of-bounds bounding box -> Invalid
  const oobRes = validateGroqDetectionResponse({
    stripDetected: true,
    confidence: 0.95,
    x: 0.70, y: 0.70, width: 0.50, height: 0.50
  }, 1000, 800);

  assert.equal(oobRes.isValid, false);

  // 4. Non-numeric or missing confidence -> Invalid
  const badConf = validateGroqDetectionResponse({
    stripDetected: true,
    confidence: 'invalid',
    x: 0.1, y: 0.1, width: 0.4, height: 0.2
  }, 1000, 800);

  assert.equal(badConf.isValid, false);
});

test('Phase 20 & Groq Vision: Cropped Sensor Panel Analysis (LEFT detector, MIDDLE scale, RIGHT expiry)', async () => {
  const { analyzeCroppedSensorPanel } = await import('./colorAnalyzer.js');

  const croppedCtx = createMockContext(300, 100, ({ fillRect }) => {
    fillRect(0, 0, 90, 100, 75, 25, 122);    // LEFT: Detector (#4B197A)
    fillRect(95, 0, 110, 100, 147, 127, 121); // MIDDLE: Ref Scale (#937F79)
    fillRect(210, 0, 90, 100, 33, 95, 154);   // RIGHT: Expiry (#215F9A)
  });

  const res = analyzeCroppedSensorPanel(croppedCtx, 300, 100);
  assert.equal(res.isDetected, true);
  assert.ok(res.badgeRGB);
  assert.ok(res.refScaleRGB);
  assert.ok(res.expiryRGB);

  assert.ok(res.regionROIs.badgeROI.x < res.regionROIs.refROI.x, 'LEFT Detector ROI must precede MIDDLE Ref Scale ROI');
  assert.ok(res.regionROIs.refROI.x < res.regionROIs.expiryROI.x, 'MIDDLE Ref Scale ROI must precede RIGHT Expiry ROI');
});


