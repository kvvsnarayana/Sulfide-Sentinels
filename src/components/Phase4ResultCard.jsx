import React, { useState } from 'react';
import { ShieldAlert, Save, PlayCircle, StopCircle, CheckCircle2, ArrowLeft, Info, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Phase4ResultCard({ workerData, scanResult, onSaveRecord, onResetScan, onGoToPreShift }) {
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveStatusMsg, setSaveStatusMsg] = useState(null);

  if (!scanResult) return null;

  const { scanStage } = workerData;
  const { detectorMatch, expiryEval, qualityValidation, netExposure } = scanResult;

  if (scanStage === 'POST_SHIFT' && !netExposure?.preTimestamp && netExposure?.exposureDurationHours === null) {
    return (
      <div className="bg-amber-950/90 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-bold text-amber-300">
              Pre-shift baseline not found.
            </h3>
            <p className="text-xs text-amber-200">
              Complete a pre-shift scan before performing a post-shift exposure calculation for worker <strong className="text-white">{workerData.workerId}</strong>.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                onClick={onGoToPreShift}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all"
              >
                <PlayCircle className="w-4 h-4" />
                <span>[ Go to Pre-Shift Scan ]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (isSaving || savedSuccess) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveStatusMsg(null);

    try {
      const recordTimestamp = new Date().toISOString();
      const formattedTime = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });

      let refMatchText = detectorMatch?.isExactMatch
        ? `Exact: ${detectorMatch.matchedHex} (${detectorMatch.percentage}%)`
        : `Between ${detectorMatch?.lowerSwatch?.hex ?? 'N/A'} (${detectorMatch?.lowerSwatch?.percentage ?? 0}%) and ${detectorMatch?.upperSwatch?.hex ?? 'N/A'} (${detectorMatch?.upperSwatch?.percentage ?? 0}%)`;

      const result = await onSaveRecord({
        workerId: workerData.workerId,
        shift: workerData.shift,
        scanStage,
        timestamp: recordTimestamp,
        dateFormatted: formattedTime,
        detectorHex: detectorMatch?.detectedHex ?? scanResult.rawRGB?.hex ?? null,
        detectorPercentage: detectorMatch?.percentage ?? null,
        detectorPpm: detectorMatch?.ppm ?? null,
        referenceMatch: refMatchText,
        referenceLowerHex: detectorMatch?.lowerSwatch?.hex ?? null,
        referenceLowerPercentage: detectorMatch?.lowerSwatch?.percentage ?? null,
        referenceUpperHex: detectorMatch?.upperSwatch?.hex ?? null,
        referenceUpperPercentage: detectorMatch?.upperSwatch?.percentage ?? null,
        expiryHex: expiryEval?.detectedHex ?? scanResult.expiryRGB?.hex ?? null,
        expiryStatus: expiryEval?.status ?? 'UNCLASSIFIED',
        expiryConfidence: expiryEval?.confidence ?? null,
        analysisConfidence: qualityValidation?.analysisConfidence ?? null,
        exposureDurationHours: scanStage === 'POST_SHIFT' ? netExposure?.exposureDurationHours ?? null : null,
        netPpm: scanStage === 'POST_SHIFT' ? netExposure?.netPpm ?? null : null,
        dosePpmH: scanStage === 'POST_SHIFT' ? netExposure?.dosePpmH ?? null : null,
        finalStatus: netExposure?.finalStatus ?? (expiryEval?.isExpired ? 'INVALID STRIP' : 'UNCLASSIFIED'),
        notes: notes.trim() || (scanStage === 'PRE_SHIFT' ? 'Pre-shift baseline scan' : 'Post-shift exposure scan')
      });

      if (result?.cloudSaved) {
        setSavedSuccess(true);
        setSaveStatusMsg('RECORD SAVED TO SUPABASE DB!');
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } else if (result?.localSaved) {
        setSavedSuccess(true);
        setSaveStatusMsg('SAVED TO LOCAL CACHE (Cloud Offline)');
        setSaveError('Cloud save unavailable. Record saved to local cache.');
      } else {
        setSavedSuccess(true);
        setSaveStatusMsg('RECORD SAVED TO LOGS');
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (err) {
      console.error('Failed to save scan record:', err);
      setSaveError(err.message || 'Unable to save scan. Please check database connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const isExpired = expiryEval?.isExpired;
  const finalStatus = isExpired ? 'INVALID STRIP' : (netExposure?.finalStatus || 'SAFE');
  const statusColor = isExpired ? '#EF4444' : (netExposure?.statusColor || '#10B981');
  const badgeClass = isExpired ? 'bg-red-500/20 text-red-400 border-red-500/40' : (netExposure?.badgeClass || 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] -z-10 opacity-20"
        style={{ backgroundColor: statusColor }}
      ></div>

      <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          {scanStage === 'PRE_SHIFT' ? (
            <>
              <PlayCircle className="w-4 h-4 text-blue-400" />
              <span className="font-extrabold text-blue-400 tracking-wider">PRE-SHIFT BASELINE RECORD</span>
            </>
          ) : (
            <>
              <StopCircle className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold text-amber-400 tracking-wider">POST-SHIFT EXPOSURE RESULT</span>
            </>
          )}
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Worker: <strong className="text-white">{workerData.workerId}</strong> ({workerData.shift?.split(' ')[0]})
        </div>
      </div>

      {scanStage === 'PRE_SHIFT' && (
        <div className="space-y-6">
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-blue-500/30 text-center space-y-3">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 uppercase">
              BASELINE RECORDED
            </span>
            <div className="text-3xl font-black text-white font-mono">
              {detectorMatch?.ppm} <span className="text-base font-normal text-slate-400">ppm</span>
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Pre-shift detector baseline response established at <strong>{detectorMatch?.percentage}%</strong>. 
              Post-shift scan required to calculate time-integrated exposure (ppm·h).
            </p>
          </div>
        </div>
      )}

      {scanStage === 'POST_SHIFT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                1. Estimated H₂S Exposure Dose
              </span>
              <div className="text-5xl font-black text-white tracking-tight font-mono my-2">
                {netExposure?.dosePpmH !== null ? netExposure.dosePpmH : '0.00'}{' '}
                <span className="text-lg font-bold text-amber-400">ppm·h</span>
              </div>
              <span className={`inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider border mt-2 ${badgeClass}`}>
                3. FINAL STATUS: {finalStatus}
              </span>
            </div>

            <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                2. Exposure Duration
              </span>
              <div className="text-3xl font-black text-white font-mono my-2">
                {netExposure?.exposureDurationHours !== null ? netExposure.exposureDurationHours : '0.00'}{' '}
                <span className="text-sm font-normal text-slate-400">hours</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Calculated from actual scan timestamps
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pre-Shift Baseline</span>
              <div className="text-lg font-bold text-slate-300 font-mono mt-1">{netExposure?.prePpm || 0.0} ppm</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">4. Post-Shift H₂S</span>
              <div className="text-lg font-bold text-amber-400 font-mono mt-1">{netExposure?.postPpm || 0.0} ppm</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase">5. Net H₂S Concentration</span>
              <div className="text-lg font-black text-emerald-400 font-mono mt-1">+{netExposure?.netPpm || 0.0} ppm</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
          <span>H₂S Detector Color Calibration</span>
          <span className="text-[10px] text-amber-400 font-mono">6. Detector Response: {detectorMatch?.percentage}%</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400">7. Detected Color HEX:</div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded border border-slate-700 shadow" style={{ backgroundColor: detectorMatch?.detectedHex }}></span>
              <strong className="text-white font-mono text-sm">{detectorMatch?.detectedHex}</strong>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Estimated H₂S Concentration: <strong className="text-amber-400 font-mono">{detectorMatch?.ppm} ppm</strong>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[11px]">
            <span className="font-bold text-slate-300 uppercase">8. Reference Scale Match:</span>
            {detectorMatch?.isExactMatch ? (
              <div className="text-emerald-400 font-semibold mt-1">
                Exact Match: {detectorMatch.matchedHex} ({detectorMatch.percentage}%)
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                <div className="text-amber-400 font-bold">Between Reference Levels:</div>
                <div className="text-slate-400 font-mono flex justify-between">
                  <span>Lower: {detectorMatch?.lowerSwatch?.hex} → {detectorMatch?.lowerSwatch?.percentage}%</span>
                  <span>Upper: {detectorMatch?.upperSwatch?.hex} → {detectorMatch?.upperSwatch?.percentage}%</span>
                </div>
                <div className="text-emerald-400 font-bold pt-1">
                  Interpolated Exposure: {detectorMatch?.percentage}% ({detectorMatch?.ppm} ppm)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">9. Expiry Indicator Status</span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="w-4 h-4 rounded border border-slate-700 shadow" style={{ backgroundColor: expiryEval?.detectedHex }}></span>
            <span className={`font-bold ${expiryEval?.isExpired ? 'text-red-400 font-extrabold' : 'text-emerald-400'}`}>
              {expiryEval?.isExpired ? 'INVALID (0% - STRIP EXPIRED)' : `${expiryEval?.status} (${expiryEval?.confidence}% Validity Confidence)`}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">10. Analysis Confidence</span>
          <div className="text-base font-extrabold text-emerald-400 font-mono mt-1">
            {qualityValidation?.analysisConfidence || 90}%
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Add Scan Audit Notes (Optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Pre-shift baseline verification before entering Sector 4"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      {saveError && (
        <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300 font-mono">
          ⚠️ {saveError}
        </div>
      )}

      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[10px] text-slate-500 flex items-start space-x-2">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>
          Optical readings are estimates based on image-based color analysis and reference calibration. The prototype should be validated against calibrated measurements before use for occupational safety decisions.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <button
          onClick={onResetScan}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>New Scan</span>
        </button>

        <button
          onClick={handleSave}
          disabled={savedSuccess || isSaving}
          className={`font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all ${
            savedSuccess
              ? 'bg-emerald-500 text-slate-950 cursor-default'
              : isSaving
              ? 'bg-amber-600 text-slate-950 cursor-wait opacity-80'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>SAVING TO SUPABASE DB...</span>
            </>
          ) : savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveStatusMsg || 'RECORD SAVED TO SUPABASE DB!'}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>SAVE TO AUDIT LOG</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
