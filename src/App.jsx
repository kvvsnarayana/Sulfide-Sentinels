import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Phase1Setup from './components/Phase1Setup';
import Phase2CameraScan from './components/Phase2CameraScan';
import Phase3Analysis from './components/Phase3Analysis';
import Phase4ResultCard from './components/Phase4ResultCard';
import Phase5History from './components/Phase5History';

import {
  detectAndSegmentWristband,
  validateWristbandImage,
  classifyExpiryIndicator,
  interpolateDetectorExposure,
  calculateNetExposure,
  applyLightingCorrection
} from './utils/colorAnalyzer';
import {
  getScanHistory,
  saveScanRecord,
  clearScanHistory,
  getLatestPreShiftRecord,
  migrateLocalLogsToSupabase
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');

  const [workerData, setWorkerData] = useState({
    workerId: '',
    shift: 'Morning (06:00 - 14:00)',
    scanStage: 'PRE_SHIFT'
  });

  const [scanResult, setScanResult] = useState(null);
  const [qualityValidation, setQualityValidation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Load history from Supabase on mount & trigger automatic local migration
  useEffect(() => {
    let isMounted = true;
    async function loadLogsAndMigrate() {
      try {
        setIsLoadingLogs(true);
        const records = await getScanHistory();
        if (isMounted) setLogs(records);

        // Run background migration for local legacy logs if any
        await migrateLocalLogsToSupabase();
        const refreshed = await getScanHistory();
        if (isMounted) setLogs(refreshed);
      } catch (err) {
        console.error('[SULFIDE SENTINELS] App init log load error:', err);
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    }
    loadLogsAndMigrate();
    return () => { isMounted = false; };
  }, []);

  const handleResetTemporaryScan = () => {
    setScanResult(null);
    setQualityValidation(null);
  };

  // Process camera frame or uploaded image via dynamic wristband detection
  const handleProcessScan = async (scanInput) => {
    let badgeRGB, refScaleRGB, expiryRGB;
    let targetScanStage = workerData.scanStage;
    let detectionInfo = null;

    if (scanInput.source === 'DEMO_PRESET') {
      const preset = scanInput.preset;
      badgeRGB = preset.badgeRGB;
      refScaleRGB = preset.refRGB;
      expiryRGB = preset.expiryRGB;
      if (preset.scanStage) targetScanStage = preset.scanStage;
      detectionInfo = {
        isDetected: true,
        detectionConfidence: 98,
        boundingBox: { x: 50, y: 120, w: 500, h: 100 },
        regionROIs: {
          badgeROI: { x: 50, y: 130, w: 150, h: 80 },
          refROI: { x: 210, y: 130, w: 200, h: 80 },
          expiryROI: { x: 420, y: 130, w: 120, h: 80 }
        },
        rawWidth: 600,
        rawHeight: 350
      };
    } else if (scanInput.ctx && scanInput.width && scanInput.height) {
      detectionInfo = detectAndSegmentWristband(scanInput.ctx, scanInput.width, scanInput.height);
      badgeRGB = detectionInfo.badgeRGB;
      refScaleRGB = detectionInfo.refScaleRGB;
      expiryRGB = detectionInfo.expiryRGB;
    }

    const validation = validateWristbandImage(badgeRGB, refScaleRGB, expiryRGB, detectionInfo);
    const expiryEval = classifyExpiryIndicator(expiryRGB);
    validation.isExpired = expiryEval.isExpired;

    if (expiryEval.isExpired && validation.isValid) {
      validation.issues.push("CRITICAL ALERT: EXPIRED STRIP (#E8E0EF White). Replace dosimeter wristband before shift.");
    }

    setQualityValidation(validation);

    if (!validation.isValid) {
      setScanResult({
        source: scanInput.source,
        imageSrc: scanInput.imageSrc,
        detectionInfo,
        qualityValidation: validation
      });
      return;
    }

    const lightingCorrection = applyLightingCorrection(badgeRGB, refScaleRGB);
    const correctedRGB = lightingCorrection.correctedRGB;
    const detectorMatch = interpolateDetectorExposure(correctedRGB || badgeRGB);

    // Guaranteed Worker Isolation: Look up latest matching Pre-Shift for THIS specific worker_code + shift
    let preShiftRecord = null;
    if (targetScanStage === 'POST_SHIFT') {
      preShiftRecord = await getLatestPreShiftRecord(workerData.workerId, workerData.shift);
    }

    const postShiftTimestamp = new Date().toISOString();
    const netExposure = calculateNetExposure({
      preShiftRecord,
      postShiftDetector: detectorMatch,
      postShiftTimestamp,
      expiryResult: expiryEval
    });

    setScanResult({
      source: scanInput.source,
      imageSrc: scanInput.imageSrc,
      rawRGB: badgeRGB,
      refRGB: refScaleRGB,
      expiryRGB,
      rawHex: lightingCorrection.rawHex,
      correctedHex: lightingCorrection.correctedHex,
      detectorMatch,
      expiryEval,
      netExposure,
      detectionInfo,
      qualityValidation: validation
    });
  };

  const handleSaveRecord = async (recordData) => {
    const updated = await saveScanRecord(recordData);
    setLogs(updated);
  };

  const handleClearHistory = async () => {
    const cleared = await clearScanHistory();
    setLogs(cleared);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeWorker={workerData}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {activeTab === 'setup' && (
          <Phase1Setup
            workerData={workerData}
            setWorkerData={setWorkerData}
            onCompleteSetup={() => setActiveTab('scan')}
            onResetTemporaryScan={handleResetTemporaryScan}
          />
        )}

        {activeTab === 'scan' && (
          <div className="space-y-6">
            {!scanResult ? (
              <Phase2CameraScan
                workerData={workerData}
                onProcessScan={handleProcessScan}
                onResetTemporaryScan={handleResetTemporaryScan}
              />
            ) : (
              <>
                <Phase3Analysis
                  scanResult={scanResult}
                  qualityValidation={qualityValidation}
                  onRetake={handleResetTemporaryScan}
                />

                {qualityValidation?.isValid && (
                  <Phase4ResultCard
                    workerData={workerData}
                    scanResult={scanResult}
                    onSaveRecord={handleSaveRecord}
                    onResetScan={handleResetTemporaryScan}
                    onGoToPreShift={() => {
                      setWorkerData({ ...workerData, scanStage: 'PRE_SHIFT' });
                      handleResetTemporaryScan();
                      setActiveTab('scan');
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <Phase5History
            logs={logs}
            isLoading={isLoadingLogs}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-slate-300">SULFIDE SENTINELS</strong> — H₂S Passive Dosimeter Optical Reader
          </div>
          <div>
            Layout: LEFT (H₂S Detector) • MIDDLE (Ref Scale) • RIGHT (Expiry Indicator)
          </div>
        </div>
      </footer>
    </div>
  );
}