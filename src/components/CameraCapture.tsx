"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  mode: "before" | "after";
  existingBefore: string | null;
  onCapture: (dataUrl: string) => void;
}

interface LightingInfo {
  overall: number; // 0-100
  leftSide: number;
  rightSide: number;
  balance: number; // 0-100, 100 = perfectly balanced
  quality: "poor" | "fair" | "good" | "excellent";
}

interface FaceInfo {
  detected: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  centered: boolean;
  properSize: boolean;
}

export default function CameraCapture({ mode, existingBefore, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [lighting, setLighting] = useState<LightingInfo | null>(null);
  const [faceInfo, setFaceInfo] = useState<FaceInfo | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [showGuide, setShowGuide] = useState(true);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [startCamera]);

  // Analyze frame for face detection + lighting
  useEffect(() => {
    if (!cameraReady) return;

    const analyze = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(analyze);
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Simple face detection using skin-color heuristic + center-mass
      // (MediaPipe loaded separately for production; this is a fast built-in approach)
      const w = canvas.width;
      const h = canvas.height;
      const smallW = Math.floor(w / 8);
      const smallH = Math.floor(h / 8);

      // Sample center region for face-like colors
      const centerX = Math.floor(w * 0.3);
      const centerW = Math.floor(w * 0.4);
      const centerY = Math.floor(h * 0.1);
      const centerH = Math.floor(h * 0.7);

      let facePixels: { x: number; y: number }[] = [];
      const imgData = ctx.getImageData(centerX, centerY, centerW, centerH);
      const step = 4; // sample every 4th pixel for speed

      for (let py = 0; py < centerH; py += step) {
        for (let px = 0; px < centerW; px += step) {
          const i = (py * centerW + px) * 4;
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];

          // Skin color detection (simplified)
          if (
            r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            r - g > 15 &&
            Math.abs(r - g) > 15 &&
            r - b > 15
          ) {
            facePixels.push({ x: px + centerX, y: py + centerY });
          }
        }
      }

      if (facePixels.length > 50) {
        const minX = Math.min(...facePixels.map((p) => p.x));
        const maxX = Math.max(...facePixels.map((p) => p.x));
        const minY = Math.min(...facePixels.map((p) => p.y));
        const maxY = Math.max(...facePixels.map((p) => p.y));
        const faceW = maxX - minX;
        const faceH = maxY - minY;
        const faceCX = minX + faceW / 2;
        const faceCY = minY + faceH / 2;

        const centered =
          Math.abs(faceCX - w / 2) < w * 0.12 &&
          Math.abs(faceCY - h * 0.4) < h * 0.15;

        const faceArea = faceW * faceH;
        const frameArea = w * h;
        const properSize =
          faceArea > frameArea * 0.04 && faceArea < frameArea * 0.45;

        setFaceInfo({
          detected: true,
          x: minX,
          y: minY,
          width: faceW,
          height: faceH,
          centered,
          properSize,
        });

        // Lighting analysis on the face region
        const faceData = ctx.getImageData(minX, minY, faceW, faceH);
        const halfW = Math.floor(faceW / 2);
        let leftBrightness = 0,
          rightBrightness = 0,
          leftCount = 0,
          rightCount = 0;

        for (let py = 0; py < faceH; py += 2) {
          for (let px = 0; px < faceW; px += 2) {
            const i = (py * faceW + px) * 4;
            const brightness =
              (faceData.data[i] * 0.299 +
                faceData.data[i + 1] * 0.587 +
                faceData.data[i + 2] * 0.114) /
              255;
            if (px < halfW) {
              leftBrightness += brightness;
              leftCount++;
            } else {
              rightBrightness += brightness;
              rightCount++;
            }
          }
        }

        const leftAvg = leftCount > 0 ? leftBrightness / leftCount : 0;
        const rightAvg = rightCount > 0 ? rightBrightness / rightCount : 0;
        const overall = ((leftAvg + rightAvg) / 2) * 100;
        const balance = (1 - Math.abs(leftAvg - rightAvg) / Math.max(leftAvg, rightAvg, 0.01)) * 100;

        let quality: LightingInfo["quality"] = "poor";
        if (overall > 30 && overall < 80 && balance > 80) quality = "excellent";
        else if (overall > 25 && overall < 85 && balance > 65) quality = "good";
        else if (overall > 15 && overall < 90 && balance > 50) quality = "fair";

        setLighting({
          overall: Math.round(overall),
          leftSide: Math.round(leftAvg * 100),
          rightSide: Math.round(rightAvg * 100),
          balance: Math.round(balance),
          quality,
        });
      } else {
        setFaceInfo({
          detected: false,
          x: 0, y: 0, width: 0, height: 0,
          centered: false, properSize: false,
        });
        setLighting(null);
      }

      // Draw overlay guide
      drawOverlay();

      animFrameRef.current = requestAnimationFrame(analyze);
    };

    animFrameRef.current = requestAnimationFrame(analyze);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraReady, showGuide]);

  const drawOverlay = () => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!showGuide) return;

    const w = overlay.width;
    const h = overlay.height;

    // Draw face guide oval
    ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.4, w * 0.18, h * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center crosshair
    const cx = w / 2;
    const cy = h * 0.4;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Rule of thirds lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(w / 3, 0);
    ctx.lineTo(w / 3, h);
    ctx.moveTo((2 * w) / 3, 0);
    ctx.lineTo((2 * w) / 3, h);
    ctx.moveTo(0, h / 3);
    ctx.lineTo(w, h / 3);
    ctx.moveTo(0, (2 * h) / 3);
    ctx.lineTo(w, (2 * h) / 3);
    ctx.stroke();
  };

  const capturePhoto = () => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        takeSnapshot();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally if using front camera
    if (facingMode === "user") {
      ctx.translate(captureCanvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.92);
    setCapturedPreview(dataUrl);
  };

  const confirmCapture = () => {
    if (capturedPreview) {
      onCapture(capturedPreview);
      setCapturedPreview(null);
    }
  };

  const retakeCapture = () => {
    setCapturedPreview(null);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    setCameraReady(false);
  };

  const lightingColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "text-green-400";
      case "good": return "text-emerald-400";
      case "fair": return "text-yellow-400";
      default: return "text-red-400";
    }
  };

  // Captured preview mode
  if (capturedPreview) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 relative bg-black flex items-center justify-center">
          <img
            src={capturedPreview}
            alt="Captured"
            className="max-h-full max-w-full object-contain"
          />
          <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded-lg text-sm font-medium">
            Review {mode === "before" ? "Before" : "After"} Photo
          </div>
        </div>
        <div className="bg-gray-900 p-4 flex gap-3">
          <button
            onClick={retakeCapture}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
          >
            Retake
          </button>
          <button
            onClick={confirmCapture}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors"
          >
            Use This Photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Camera viewport */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
        />
        <canvas ref={canvasRef} className="hidden" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={facingMode === "user" ? { transform: "scaleX(-1)" } : {}}
        />

        {/* Mode badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              mode === "before"
                ? "bg-blue-600/90"
                : "bg-emerald-600/90"
            }`}
          >
            {mode === "before" ? "BEFORE" : "AFTER"}
          </span>
        </div>

        {/* Camera flip button */}
        <button
          onClick={toggleCamera}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Guide toggle */}
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="absolute top-4 right-16 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
          </svg>
        </button>

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <span className="text-8xl font-bold animate-pulse">{countdown}</span>
          </div>
        )}

        {/* Existing "before" thumbnail when capturing "after" */}
        {mode === "after" && existingBefore && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="relative">
              <img
                src={existingBefore}
                alt="Before reference"
                className="w-24 h-32 object-cover rounded-lg border-2 border-blue-500 shadow-lg"
              />
              <span className="absolute -top-2 -right-2 bg-blue-600 text-xs px-1.5 py-0.5 rounded font-medium">
                Before
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div className="bg-gray-900 border-t border-gray-800 p-4 space-y-3 shrink-0">
        {/* Lighting + Face status */}
        <div className="flex items-center gap-4 text-xs">
          {/* Face detection status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                faceInfo?.detected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span className="text-gray-400">
              {faceInfo?.detected ? "Face detected" : "No face"}
            </span>
          </div>

          {faceInfo?.detected && (
            <>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    faceInfo.centered ? "bg-green-400" : "bg-yellow-400"
                  }`}
                />
                <span className="text-gray-400">
                  {faceInfo.centered ? "Centered" : "Off-center"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    faceInfo.properSize ? "bg-green-400" : "bg-yellow-400"
                  }`}
                />
                <span className="text-gray-400">
                  {faceInfo.properSize ? "Good framing" : "Adjust distance"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Lighting meter */}
        {lighting && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Lighting</span>
              <span className={lightingColor(lighting.quality)}>
                {lighting.quality.charAt(0).toUpperCase() +
                  lighting.quality.slice(1)}{" "}
                ({lighting.overall}%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-6">L:{lighting.leftSide}</span>
              <div className="flex-1 relative h-2">
                <div className="lighting-meter w-full h-full" />
                <div
                  className="lighting-indicator absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${lighting.overall}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-6">R:{lighting.rightSide}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                Balance: {lighting.balance}%
              </span>
              {lighting.balance < 70 && (
                <span className="text-yellow-400">
                  {lighting.leftSide > lighting.rightSide
                    ? "More light on right side needed"
                    : "More light on left side needed"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Capture button */}
        <div className="flex items-center justify-center pt-2">
          <button
            onClick={capturePhoto}
            disabled={!cameraReady || countdown !== null}
            className="relative w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center disabled:opacity-40 group"
          >
            <div className="absolute inset-0 rounded-full border-4 border-indigo-400 opacity-0 group-hover:opacity-100 capture-btn-ring" />
            <div
              className={`w-14 h-14 rounded-full transition-colors ${
                mode === "before"
                  ? "bg-blue-500 group-hover:bg-blue-400"
                  : "bg-emerald-500 group-hover:bg-emerald-400"
              }`}
            />
          </button>
        </div>

        {!cameraReady && (
          <p className="text-center text-sm text-gray-400">
            Starting camera...
          </p>
        )}
      </div>
    </div>
  );
}
