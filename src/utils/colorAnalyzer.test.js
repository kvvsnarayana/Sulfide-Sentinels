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
