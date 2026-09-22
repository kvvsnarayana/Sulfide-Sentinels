import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Check, ImageIcon, Sparkles } from 'lucide-react';
import { DEMO_PRESET_BADGES } from '../utils/colorAnalyzer';

export default function Phase2CameraScan({ workerData, onProcessScan, onResetTemporaryScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [inputMode, setInputMode] = useState('CAMERA'); // 'CAMERA' | 'UPLOAD'
  const [streamActive, setStreamActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Selected image preview state (captured frame or uploaded photo)
  const [stagedImageSrc, setStagedImageSrc] = useState(null);
  const [stagedCanvasData, setStagedCanvasData] = useState(null);
  const [selectedDemoBadge, setSelectedDemoBadge] = useState(null);

  // Initialize/stop camera on mode change
  useEffect(() => {
    if (inputMode === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [inputMode]);

  // Clean up object URLs on unmount/reset
  useEffect(() => {
    return () => {
      if (stagedImageSrc && stagedImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(stagedImageSrc);
      }
    };
  }, [stagedImageSrc]);

  /**
   * Mobile-Friendly Camera Fallback Chain
   */
  const startCamera = async () => {
    setCameraError('');
    setIsCameraReady(false);

    const constraintList = [
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: { ideal: "environment" } } },
      { video: true }
    ];

    let stream = null;
    let lastError = null;

    for (const constraints of constraintList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
        setStreamActive(true);
      } catch (playErr) {
        console.warn("[SULFIDE SENTINELS CAMERA] Video play error:", playErr);
        setCameraError('Camera access is unavailable. Please allow camera permission or upload an image.');
        setStreamActive(false);
      }
    } else {
      console.warn("[SULFIDE SENTINELS CAMERA] All camera constraints failed:", lastError);
      setCameraError('Camera access is unavailable. Please allow camera permission or upload an image.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
    setIsCameraReady(false);
  };

  const handleVideoMetadataLoaded = () => {
    checkCameraReadyState();
  };

  const handleVideoCanPlay = () => {
    checkCameraReadyState();
  };

  const checkCameraReadyState = () => {
    if (videoRef.current) {
      const v = videoRef.current;
      const ready = v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2;
      setIsCameraReady(ready);
    }
  };

  const clearStagedPhoto = () => {
    if (stagedImageSrc && stagedImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(stagedImageSrc);
    }
    setStagedImageSrc(null);
    setStagedCanvasData(null);
    setSelectedDemoBadge(null);
    if (onResetTemporaryScan) onResetTemporaryScan();
  };

  /**
   * Capture photo from live HTMLVideoElement (Unobstructed clear frame capture)
   */
  const handleSnapCameraPhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const rawW = video.videoWidth;
    const rawH = video.videoHeight;

    if (rawW <= 0 || rawH <= 0) {
      console.warn("[SULFIDE SENTINELS CAMERA] Invalid zero-dimension video capture attempt.");
      return;
    }

    canvas.width = rawW;
    canvas.height = rawH;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, rawW, rawH);

    const dataUrl = canvas.toDataURL('image/png');
    setStagedImageSrc(dataUrl);

    setStagedCanvasData({
      ctx,
      canvas,
      rawWidth: rawW,
      rawHeight: rawH
    });
  };

  /**
   * Handle File Upload
   */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    clearStagedPhoto();
    const objectUrl = URL.createObjectURL(file);
    setStagedImageSrc(objectUrl);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      setStagedCanvasData({
        ctx,
        canvas,
        rawWidth: img.width,
        rawHeight: img.height
      });
    };
    img.src = objectUrl;
  };

  /**
   * Confirm & Analyze Image (Camera and Upload pass through the EXACT SAME pipeline)
   */
  const handleConfirmAnalyze = () => {
    if (!stagedCanvasData) return;

    onProcessScan({
      source: inputMode,
      ctx: stagedCanvasData.ctx,
      canvas: stagedCanvasData.canvas,
      width: stagedCanvasData.rawWidth,
      height: stagedCanvasData.rawHeight,
      imageSrc: stagedImageSrc
    });
  };

  const handleSelectDemoPreset = (preset) => {
    setSelectedDemoBadge(preset.id);
    onProcessScan({
      source: 'DEMO_PRESET',
      preset
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-400 px-3 py-0.5 rounded-full text-xs font-semibold border border-amber-500/20">
            <span>{workerData.scanStage === 'PRE_SHIFT' ? '🔵 STAGE 1: PRE-SHIFT BASELINE' : '🔴 STAGE 2: POST-SHIFT SCAN'}</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Capture Wristband Image</h2>
        </div>

        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs flex items-center space-x-2">
          <span className="text-slate-400">Worker:</span>
          <span className="text-amber-400 font-bold">{workerData.workerId}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">{workerData.shift?.split(' ')[0]}</span>
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        <button
          onClick={() => {
            setInputMode('CAMERA');
            clearStagedPhoto();
          }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border ${
            inputMode === 'CAMERA'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>[ Open Camera ]</span>
        </button>

        <button
          onClick={() => {
            setInputMode('UPLOAD');
            clearStagedPhoto();
          }}
          className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border ${
            inputMode === 'UPLOAD'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>[ Upload Image ]</span>
        </button>
      </div>

      {/* Processing Canvas (Hidden) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Guidance Instructions */}
      <div className="text-center text-xs text-slate-300 space-y-1 bg-slate-900/50 p-3 rounded-xl border border-slate-800 max-w-lg mx-auto">
        <p className="font-bold text-amber-400">Position the complete wristband clearly in the camera view and take a photo.</p>
        <p className="text-slate-400 text-[11px]">The application will automatically detect the physical wristband and analyze the H₂S detector, scale, and expiry badge after capture.</p>
      </div>

      {/* Main Viewfinder / Staged Image Container */}
      <div 
        ref={containerRef}
        className="relative bg-slate-950 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[400px] flex flex-col items-center justify-center"
      >
        {/* STAGE A: Unobstructed Live Camera Preview */}
        {inputMode === 'CAMERA' && !stagedImageSrc && (
          <div className="relative w-full h-[440px]">
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={handleVideoMetadataLoaded}
              onCanPlay={handleVideoCanPlay}
              onPlaying={handleVideoCanPlay}
              className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
            />

            {!streamActive && (
              <div className="p-8 text-center space-y-3 flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Live Camera Preview</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  {cameraError || "Starting camera…"}
                </p>
                <button
                  onClick={startCamera}
                  className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera Access</span>
                </button>
              </div>
            )}

            {/* Minimal Non-Obstructive Top Badge (NO ARTIFICIAL BOXES OR BORDERS OVER CAMERA) */}
            {streamActive && (
              <div className="absolute top-4 left-0 right-0 pointer-events-none flex justify-center px-4">
                <div className="bg-slate-950/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/60 text-xs font-bold text-amber-300 shadow-xl">
                  {isCameraReady ? 'Live Camera Ready • Position wristband & snap photo' : 'Starting camera…'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAGE B: File Upload Input View */}
        {inputMode === 'UPLOAD' && !stagedImageSrc && (
          <div className="p-10 text-center space-y-4 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ImageIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upload Wristband Photo</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select a clear photograph of the physical wristband showing the detector, scale, and expiry badge.
              </p>
            </div>
            <label className="block">
              <span className="sr-only">Choose file</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* STAGE C: Review Captured Photo (Clean & Unobstructed) */}
        {stagedImageSrc && (
          <div className="relative w-full h-[440px] flex flex-col items-center justify-center bg-slate-950">
            <img
              src={stagedImageSrc}
              alt="Captured Wristband Preview"
              className="w-full h-full object-contain"
            />

            <div className="absolute top-4 left-0 right-0 pointer-events-none flex justify-center px-4">
              <div className="bg-slate-950/90 border border-emerald-500/40 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl">
                ✓ Photo Captured — Ready for Dynamic Detection
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons for Camera / Staged Image */}
      {inputMode === 'CAMERA' && streamActive && !stagedImageSrc && (
        <button
          onClick={handleSnapCameraPhoto}
          disabled={!isCameraReady}
          className={`w-full font-extrabold py-4 px-6 rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-base tracking-wide transition-all transform active:scale-95 ${
            isCameraReady
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-amber-500/20'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>{isCameraReady ? 'CAPTURE PHOTO' : 'Starting camera…'}</span>
        </button>
      )}

      {stagedImageSrc && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={clearStagedPhoto}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 border border-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            <span>[ Retake Photo ]</span>
          </button>

          <button
            onClick={handleConfirmAnalyze}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>[ Analyze Image ]</span>
          </button>
        </div>
      )}

      {/* Demo Presets */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Calibrated Test Presets
        </h4>
        <p className="text-xs text-slate-400">
          Select any reference preset below to test CIELAB color matching, continuous interpolation, and expiry alerts:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEMO_PRESET_BADGES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectDemoPreset(preset)}
              className={`text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                selectedDemoBadge === preset.id
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div>
                <div className="font-bold flex items-center space-x-2">
                  <span>{preset.name}</span>
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.badgeRGB.hex }}
                  ></span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{preset.description}</div>
              </div>
              {selectedDemoBadge === preset.id && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

