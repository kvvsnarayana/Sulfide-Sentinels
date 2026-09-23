import React, { useState } from 'react';
import { AlertOctagon, Sliders, ShieldX, RefreshCcw, Upload, ChevronDown, ChevronUp, Eye } from 'lucide-react';

export default function Phase3Analysis({ scanResult, qualityValidation, onRetake }) {
  const [showDebug, setShowDebug] = useState(false);

  if (!scanResult) return null;

  const { isValid, isExpired, expiryEval, issues, analysisConfidence } = qualityValidation;
  const detectionInfo = scanResult.detectionInfo;
  const regionROIs = detectionInfo?.regionROIs;
  const rawW = detectionInfo?.rawWidth || 1;
  const rawH = detectionInfo?.rawHeight || 1;

  // Calculate CSS percentage positions for post-capture detection overlays (Section 2, 16, 23)
  const getOverlayStyle = (roi) => {
    if (!roi || rawW <= 0 || rawH <= 0) return { display: 'none' };
    return {
      left: `${(roi.x / rawW) * 100}%`,
      top: `${(roi.y / rawH) * 100}%`,
      width: `${(roi.w / rawW) * 100}%`,
      height: `${(roi.h / rawH) * 100}%`
    };
  };

  return (
    <div className="space-y-6">
      {/* 1. STRICT IMAGE VALIDATION FAILURE DIALOG */}
      {!isValid && (
        <div className="bg-red-950/90 border-2 border-red-500 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-red-400 tracking-wide">
                  ❌ Uploaded image is not correct.
                </h3>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-500 text-slate-950 uppercase">
                  Validation Failed
                </span>
              </div>

              <p className="text-xs text-red-200 leading-relaxed font-medium">
                Please capture a clear image of the complete H₂S detector wristband showing the detector, scale, and expiry badge.
              </p>

              <div className="bg-slate-950 p-4 rounded-2xl border border-red-500/30 space-y-2">
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Detected Issues:</span>
                <ul className="list-disc list-inside text-xs text-red-300 space-y-1 font-mono">
                  {issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={onRetake}
                  className="bg-red-500 hover:bg-red-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>[ Retake Photo ]</span>
                </button>

                <button
                  onClick={onRetake}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 border border-slate-700 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>[ Upload Correct Image ]</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXPIRED STRIP EMERGENCY ALERT MODAL (#E8E0EF White Expiry) */}
      {isValid && isExpired && (
        <div className="bg-red-950/90 border-2 border-red-500 rounded-3xl p-6 shadow-2xl backdrop-blur-xl animate-bounce-once">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
              <ShieldX className="w-8 h-8" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-red-400 tracking-wide">
                  🚨 STRIP INVALID
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500 text-slate-950 uppercase">
                  Expiry = #E8E0EF (0%)
                </span>
              </div>
              <p className="text-xs text-red-200 leading-relaxed font-semibold">
                Expiry indicator shows that the detector strip is not valid. Replace dosimeter immediately before starting shift.
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-red-500/30 text-xs text-red-300">
                <strong>Mandatory Safety Action:</strong> Replace dosimeter wristband before entering hazardous area.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. POST-CAPTURE VISUAL DETECTION BORDERS (Section 2, 16 & 23) */}
      {isValid && scanResult.imageSrc && regionROIs && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              Post-Capture Detection Overlay (Visual Verification)
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
              ✓ Dynamic ROIs Located
            </span>
          </div>

          <div className="relative w-full h-[320px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <img
              src={scanResult.imageSrc}
              alt="Analyzed Wristband"
              className="w-full h-full object-contain"
            />

            {/* Overlaid Detected Regions (H2S Detector, Reference Scale, Expiry Indicator) */}
            <div className="absolute inset-0 pointer-events-none">
              {/* H2S Detector Pad */}
              <div
                style={getOverlayStyle(regionROIs.badgeROI)}
                className="absolute border-2 border-purple-400 bg-purple-500/10 rounded-lg flex items-start p-1 transition-all shadow-[0_0_12px_rgba(192,132,252,0.3)]"
              >
                <span className="bg-slate-950/90 text-purple-300 text-[8px] font-black px-1 py-0.5 rounded border border-purple-500/50 shadow uppercase tracking-tighter">
                  {regionROIs.badgeROI.x <= regionROIs.expiryROI.x ? 'LEFT: H₂S DETECTOR' : 'RIGHT: H₂S DETECTOR'}
                </span>
              </div>

              {/* MIDDLE: Reference Scale */}
              <div
                style={getOverlayStyle(regionROIs.refROI)}
                className="absolute border-2 border-amber-400 bg-amber-500/10 rounded-lg flex items-start p-1 transition-all shadow-[0_0_12px_rgba(251,191,36,0.3)]"
              >
                <span className="bg-slate-950/90 text-amber-300 text-[8px] font-black px-1 py-0.5 rounded border border-amber-500/50 shadow uppercase tracking-tighter">
                  MIDDLE: REFERENCE SCALE
                </span>
              </div>

              {/* Expiry Indicator */}
              <div
                style={getOverlayStyle(regionROIs.expiryROI)}
                className="absolute border-2 border-emerald-400 bg-emerald-500/10 rounded-lg flex items-start p-1 transition-all shadow-[0_0_12px_rgba(52,211,153,0.3)]"
              >
                <span className="bg-slate-950/90 text-emerald-300 text-[8px] font-black px-1 py-0.5 rounded border border-emerald-500/50 shadow uppercase tracking-tighter">
                  {regionROIs.expiryROI.x >= regionROIs.badgeROI.x ? 'RIGHT: EXPIRY INDICATOR' : 'LEFT: EXPIRY INDICATOR'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. OPTICAL BREAKDOWN (Left H2S Detector, Middle Ref Scale, Right Expiry Indicator) */}
      {isValid && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Optical Analysis Breakdown (LEFT → MIDDLE → RIGHT)
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-700">
              CIELAB Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* LEFT: H2S Detector (Raw & Corrected HEX - Section 13 & 17) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-purple-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-400 uppercase">1. Left: H₂S Detector</span>
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              </div>
              <div className="flex items-center space-x-3">
                <div
                  className="w-9 h-9 rounded-lg border border-slate-700 shadow shrink-0"
                  style={{ backgroundColor: scanResult.correctedHex || scanResult.rawHex || '#4B197A' }}
                ></div>
                <div className="space-y-0.5 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Raw HEX: </span>
                    <span className="font-bold text-slate-300">{scanResult.rawHex || '#4B197A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Corrected: </span>
                    <span className="font-extrabold text-amber-400">{scanResult.correctedHex || scanResult.rawHex || '#4B197A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE: Reference Scale Swatch Normalization */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase">2. Middle: Reference Scale</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              </div>
              <div className="text-xs font-mono text-emerald-400 font-semibold">
                Match: {scanResult.detectorMatch?.isExactMatch ? `Exact Swatch (${scanResult.detectorMatch.percentage}%)` : `Between Swatches`}
              </div>
              <div className="text-[10px] text-slate-400">
                Scale: #4B197A (0%) to #F28C16 (100% / 10 ppm)
              </div>
            </div>

            {/* RIGHT: Expiry Indicator Badge */}
            <div className={`bg-slate-950 p-3.5 rounded-xl border space-y-2 ${isExpired ? 'border-red-500' : 'border-emerald-500/40'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-300">3. Right: Expiry Badge</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isExpired ? 'bg-red-500 animate-ping' : 'bg-blue-400'}`}></span>
              </div>
              <div className="flex items-center space-x-3">
                <div
                  className="w-9 h-9 rounded-lg border border-slate-700 shadow shrink-0"
                  style={{ backgroundColor: expiryEval?.detectedHex || '#215F9A' }}
                ></div>
                <div>
                  <div className="text-xs font-mono font-bold text-white">Detected HEX: {expiryEval?.detectedHex}</div>
                  <div className={`text-xs font-bold ${isExpired ? 'text-red-400 font-extrabold' : 'text-emerald-400'}`}>
                    Validity: {isExpired ? 'INVALID (0% - STRIP EXPIRED)' : `${expiryEval?.status} (${expiryEval?.confidence}%)`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Confidence Metrics Bar */}
          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Reading Confidence:</span>
              <span className="font-extrabold text-emerald-400 font-mono">{analysisConfidence}%</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Expiry Validity Confidence:</span>
              <span className={`font-extrabold font-mono ${expiryEval?.confidence === 0 ? 'text-slate-400' : 'text-blue-400'}`}>
                {expiryEval?.confidence}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. COLLAPSIBLE DEBUG / ANALYSIS DETAILS (Section 17 & 33) */}
      {isValid && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-all bg-slate-900/80 hover:bg-slate-800/60"
          >
            <span className="flex items-center space-x-2">
              <span>🔍 Analysis Details (Debug & Calibration)</span>
            </span>
            {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDebug && (
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 space-y-3 font-mono text-xs text-slate-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Detected Wristband</div>
                  <div className="font-bold text-emerald-400">{detectionInfo?.isDetected ? 'YES' : 'NO'}</div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Detector Raw HEX</div>
                  <div className="font-bold text-purple-300">{scanResult.rawHex || '#4B197A'}</div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Detector Corrected HEX</div>
                  <div className="font-bold text-amber-400">{scanResult.correctedHex || '#4B197A'}</div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Expiry HEX</div>
                  <div className="font-bold text-blue-400">{expiryEval?.detectedHex || '#215F9A'}</div>
                </div>
              </div>

              {detectionInfo?.regionROIs && (
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                  <div className="text-amber-400 font-bold uppercase text-[10px]">Pixel ROIs (Native Canvas Frame):</div>
                  <div>Left Detector ROI: x={regionROIs.badgeROI.x}, y={regionROIs.badgeROI.y}, w={regionROIs.badgeROI.w}, h={regionROIs.badgeROI.h}</div>
                  <div>Middle Scale ROI: x={regionROIs.refROI.x}, y={regionROIs.refROI.y}, w={regionROIs.refROI.w}, h={regionROIs.refROI.h}</div>
                  <div>Right Expiry ROI: x={regionROIs.expiryROI.x}, y={regionROIs.expiryROI.y}, w={regionROIs.expiryROI.w}, h={regionROIs.expiryROI.h}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
