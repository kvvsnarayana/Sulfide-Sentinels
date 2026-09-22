import React, { useState } from 'react';
import { User, Clock, ShieldCheck, AlertCircle, ArrowRight, PlayCircle, StopCircle } from 'lucide-react';

export default function Phase1Setup({ workerData, setWorkerData, onCompleteSetup, onResetTemporaryScan }) {
  const [workerId, setWorkerId] = useState(workerData?.workerId || 'W-1042');
  const [shift, setShift] = useState(workerData?.shift || 'Morning (06:00 - 14:00)');
  const [scanStage, setScanStage] = useState(workerData?.scanStage || 'PRE_SHIFT');
  const [checklist, setChecklist] = useState({
    wristbandWorn: true,
    visualClean: true
  });
  const [errorMsg, setErrorMsg] = useState('');

  const handleStageChange = (newStage) => {
    setScanStage(newStage);
    if (onResetTemporaryScan) onResetTemporaryScan();
  };

  const handleWorkerIdChange = (val) => {
    setWorkerId(val);
    if (errorMsg) setErrorMsg('');
    if (onResetTemporaryScan) onResetTemporaryScan();
  };

  const handleProceed = (e) => {
    e.preventDefault();
    if (!workerId.trim()) {
      setErrorMsg('⚠ Please enter a valid Worker ID / Badge Number.');
      return;
    }
    if (workerId.trim().length < 3) {
      setErrorMsg('⚠ Worker ID must be at least 3 characters (e.g. W-1042).');
      return;
    }
    if (!checklist.wristbandWorn || !checklist.visualClean) {
      setErrorMsg('⚠ Please confirm all physical inspection checklist items before proceeding.');
      return;
    }

    setErrorMsg('');
    const updated = {
      workerId: workerId.trim().toUpperCase(),
      shift,
      scanStage
    };
    setWorkerData(updated);
    onCompleteSetup();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/20 mb-3">
              <span>WORKER REGISTRATION & SCAN STAGE</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Worker & Shift Registration
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Select <strong>Pre-Shift Baseline</strong> (before entering work area) or <strong>Post-Shift Scan</strong> (after work completion).
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
            <User className="w-6 h-6" />
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleProceed} className="mt-6 space-y-5">
          {/* Dual Scan Stage Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Select Scan Stage <span className="text-amber-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleStageChange('PRE_SHIFT')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  scanStage === 'PRE_SHIFT'
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <PlayCircle className={`w-5 h-5 ${scanStage === 'PRE_SHIFT' ? 'text-blue-400' : 'text-slate-500'}`} />
                  {scanStage === 'PRE_SHIFT' && (
                    <span className="text-[10px] font-extrabold bg-blue-500 text-slate-950 px-2 py-0.5 rounded-full">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-bold text-sm text-white">1. PRE-SHIFT SCAN</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Establishes worker's baseline before starting work</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStageChange('POST_SHIFT')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  scanStage === 'POST_SHIFT'
                    ? 'bg-amber-600/20 border-amber-500 text-white ring-2 ring-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <StopCircle className={`w-5 h-5 ${scanStage === 'POST_SHIFT' ? 'text-amber-400' : 'text-slate-500'}`} />
                  {scanStage === 'POST_SHIFT' && (
                    <span className="text-[10px] font-extrabold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-bold text-sm text-white">2. POST-SHIFT SCAN</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Compares exposure against pre-shift baseline</div>
                </div>
              </button>
            </div>
          </div>

          {/* Worker ID Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-400" />
              Worker ID / Badge Number <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              value={workerId}
              onChange={(e) => handleWorkerIdChange(e.target.value)}
              placeholder="e.g. W-1042"
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm transition-all"
            />
          </div>

          {/* Shift Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Operational Shift Metadata <span className="text-amber-400">*</span>
            </label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm transition-all cursor-pointer"
            >
              <option value="Morning (06:00 - 14:00)">Morning Shift (06:00 - 14:00)</option>
              <option value="Afternoon (14:00 - 22:00)">Afternoon Shift (14:00 - 22:00)</option>
              <option value="Night (22:00 - 06:00)">Night Shift (22:00 - 06:00)</option>
            </select>
          </div>

          {/* Inspection Checklist */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Physical Wristband Inspection Checklist
            </h3>

            <label className="flex items-center space-x-3 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={checklist.wristbandWorn}
                onChange={(e) => setChecklist({ ...checklist, wristbandWorn: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded bg-slate-900 border-slate-700"
              />
              <span>Dosimeter wristband is securely fastened on worker's wrist.</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={checklist.visualClean}
                onChange={(e) => setChecklist({ ...checklist, visualClean: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded bg-slate-900 border-slate-700"
              />
              <span>Wristband strip is clean (H₂S Detector on LEFT, Reference Scale in MIDDLE, Expiry on RIGHT).</span>
            </label>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 text-sm tracking-wide transition-all transform active:scale-95"
          >
            <span>PROCEED TO CAMERA SCAN</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
