"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  mode: "before" | "after";
  existingBefore: string | null;
  onCapture: (dataUrl: string) => void;
}

interface LightingInfo {
  overall: number;
  leftSide: number;
  rightSide: number;
  balance: number;
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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
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

      const w = canvas.width;
      const h = canvas.height;

      const centerX = Math.floor(w * 0.3);
      const centerW = Math.floor(w * 0.4);
      const centerY = Math.floor(h * 0.1);
      const centerH = Math.floor(h * 0.7);

      let facePixels: { x: number; y: number }[] = [];
      const imgData = ctx.getImageData(centerX, centerY, centerW, centerH);
      const step = 4;

      for (let py = 0; py < centerH; py += step) {
        for (let px = 0; px < centerW; px += step) {
          const i = (py * centerW + px) * 4;
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];

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

        const currentFace: FaceInfo = {
          detected: true,
          x: minX, y: minY,
          width: faceW, height: faceH,
          centered, properSize,
        };
        setFaceInfo(currentFace);

        const faceData = ctx.getImageData(minX, minY, faceW, faceH);
        const halfW = Math.floor(faceW / 2);
        let leftBrightness = 0, rightBrightness = 0, leftCount = 0, rightCount = 0;

        for (let py = 0; py < faceH; py += 2) {
          for (let px = 0; px < faceW; px += 2) {
            const i = (py * faceW + px) * 4;
            const brightness =
              (faceData.data[i] * 0.299 +
                faceData.data[i + 1] * 0.587 +
                faceData.data[i + 2] * 0.114) / 255;
            if (px < halfW) { leftBrightness += brightness; leftCount++; }
            else { rightBrightness += brightness; rightCount++; }
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
        drawOverlay(currentFace);
      } else {
        const noFace: FaceInfo = {
          detected: false,
          x: 0, y: 0, width: 0, height: 0,
          centered: false, properSize: false,
        };
        setFaceInfo(noFace);
        setLighting(null);
        drawOverlay(noFace);
      }

      animFrameRef.current = requestAnimationFrame(analyze);
    };

    animFrameRef.current = requestAnimationFrame(analyze);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraReady, showGuide]);

  const drawOverlay = (currentFaceInfo: FaceInfo | null) => {
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
    const cx = w / 2;
    const cy = h * 0.38;
    const rx = w * 0.2;
    const ry = h * 0.28;

    // Determine guide color based on face position
    const face = currentFaceInfo;
    let guideColor = "rgba(255, 255, 255, 0.5)"; // default white — no face
    let glowColor = "rgba(255, 255, 255, 0.08)";
    let statusText = "Position your face in the oval";

    if (face?.detected) {
      if (face.centered && face.properSize) {
        guideColor = "rgba(34, 197, 94, 0.85)"; // green — perfect
        glowColor = "rgba(34, 197, 94, 0.12)";
        statusText = "Perfect! Hold steady";
      } else if (face.centered || face.properSize) {
        guideColor = "rgba(251, 191, 36, 0.85)"; // yellow — close
        glowColor = "rgba(251, 191, 36, 0.1)";
        statusText = !face.centered ? "Move to center" : "Adjust distance";
      } else {
        guideColor = "rgba(255, 107, 107, 0.8)"; // coral — misaligned
        glowColor = "rgba(255, 107, 107, 0.1)";
        statusText = "Align face with oval";
      }
    }

    // Dim area outside the oval guide
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, w, h);
    // Cut out the oval
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner glow around oval
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 6, ry + 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();

    // Main face guide oval
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Corner brackets on the oval for visual anchoring
    const bracketLen = 20;
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    // Top bracket
    ctx.beginPath();
    ctx.moveTo(cx - bracketLen, cy - ry);
    ctx.lineTo(cx + bracketLen, cy - ry);
    ctx.stroke();

    // Bottom bracket
    ctx.beginPath();
    ctx.moveTo(cx - bracketLen, cy + ry);
    ctx.lineTo(cx + bracketLen, cy + ry);
    ctx.stroke();

    // Left bracket
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - bracketLen);
    ctx.lineTo(cx - rx, cy + bracketLen);
    ctx.stroke();

    // Right bracket
    ctx.beginPath();
    ctx.moveTo(cx + rx, cy - bracketLen);
    ctx.lineTo(cx + rx, cy + bracketLen);
    ctx.stroke();

    // Center crosshair (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // Eye level guide lines
    const eyeY = cy - ry * 0.2;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.7, eyeY);
    ctx.lineTo(cx + rx * 0.7, eyeY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Status text at bottom of guide
    // Pre-mirror text when in selfie mode so it reads correctly after CSS scaleX(-1)
    const isSelfie = facingMode === "user";
    const fontSize = Math.max(14, Math.round(w * 0.028));
    ctx.save();
    if (isSelfie) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Text background pill
    const textY = cy + ry + 20;
    const textMetrics = ctx.measureText(statusText);
    const pillW = textMetrics.width + 24;
    const pillH = fontSize + 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, textY - 2, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = guideColor;
    ctx.fillText(statusText, cx, textY + 4);
    ctx.restore();

    // Shoulder guide line at bottom
    const shoulderY = cy + ry + pillH + 30;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.8, shoulderY);
    ctx.quadraticCurveTo(cx, shoulderY + 30, cx + rx * 1.8, shoulderY);
    ctx.stroke();
    ctx.setLineDash([]);
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

  const qualityColor = (q: string) => {
    switch (q) {
      case "excellent": return "var(--green)";
      case "good": return "#22C55E";
      case "fair": return "var(--yellow-check)";
      default: return "var(--coral)";
    }
  };

  // Captured preview mode
  if (capturedPreview) {
    return (
      <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="preview-container" style={{ position: "relative" }}>
            <img
              src={capturedPreview}
              alt="Captured"
              style={{ width: "100%", display: "block" }}
            />
            <div style={{
              position: "absolute", top: "12px", left: "12px",
              fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600,
              padding: "4px 12px", borderRadius: "6px",
              background: mode === "before" ? "rgba(59,130,246,0.85)" : "rgba(34,197,94,0.85)",
              color: "white", textTransform: "uppercase", letterSpacing: "1px"
            }}>
              Review {mode === "before" ? "Before" : "After"} Photo
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={retakeCapture} className="app-btn-secondary" style={{ flex: 1 }}>
              Retake
            </button>
            <button onClick={confirmCapture} className="app-btn-primary" style={{ flex: 1 }}>
              Use This Photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Camera viewport */}
        <div className="camera-viewport" style={{ position: "relative", aspectRatio: "3/4", maxHeight: "70vh" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
              borderRadius: "13px"
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
              borderRadius: "13px"
            }}
          />

          {/* Mode badge */}
          <div style={{ position: "absolute", top: "12px", left: "12px" }}>
            <span className={`app-badge ${mode === "before" ? "app-badge-blue" : "app-badge-green"}`}>
              {mode === "before" ? "BEFORE" : "AFTER"}
            </span>
          </div>

          {/* Camera flip button */}
          <button
            onClick={toggleCamera}
            style={{
              position: "absolute", top: "12px", right: "12px",
              width: "40px", height: "40px",
              background: "rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", transition: "all 0.2s"
            }}
          >
            <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Guide toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            style={{
              position: "absolute", top: "12px", right: "60px",
              width: "40px", height: "40px",
              background: showGuide ? "rgba(108,99,255,0.5)" : "rgba(0,0,0,0.5)",
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", transition: "all 0.2s"
            }}
          >
            <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
            </svg>
          </button>

          {/* Countdown overlay */}
          {countdown !== null && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.4)", zIndex: 20,
              borderRadius: "13px"
            }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: "96px", color: "white",
                textShadow: "3px 3px 0 var(--ink)"
              }}>{countdown}</span>
            </div>
          )}

          {/* Before reference thumbnail when capturing after */}
          {mode === "after" && existingBefore && (
            <div style={{ position: "absolute", bottom: "12px", left: "12px", zIndex: 10 }}>
              <div style={{ position: "relative" }}>
                <img
                  src={existingBefore}
                  alt="Before reference"
                  style={{
                    width: "80px", height: "106px",
                    objectFit: "cover", borderRadius: "10px",
                    border: "3px solid #3B82F6",
                    boxShadow: "3px 3px 0 rgba(0,0,0,0.3)"
                  }}
                />
                <span style={{
                  position: "absolute", top: "-6px", right: "-6px",
                  fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600,
                  background: "#3B82F6", color: "white",
                  padding: "2px 6px", borderRadius: "4px",
                  textTransform: "uppercase", letterSpacing: "0.5px"
                }}>Before</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls panel */}
        <div className="camera-controls" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Face + Lighting status */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div className="status-indicator">
              <div className={faceInfo?.detected ? "status-dot-ok" : "status-dot-bad"} />
              <span>{faceInfo?.detected ? "Face detected" : "No face"}</span>
            </div>
            {faceInfo?.detected && (
              <>
                <div className="status-indicator">
                  <div className={faceInfo.centered ? "status-dot-ok" : "status-dot-warn"} />
                  <span>{faceInfo.centered ? "Centered" : "Off-center"}</span>
                </div>
                <div className="status-indicator">
                  <div className={faceInfo.properSize ? "status-dot-ok" : "status-dot-warn"} />
                  <span>{faceInfo.properSize ? "Good framing" : "Adjust distance"}</span>
                </div>
              </>
            )}
          </div>

          {/* Lighting meter */}
          {lighting && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                <span style={{ color: "var(--text-light)" }}>Lighting</span>
                <span style={{ color: qualityColor(lighting.quality), fontWeight: 600 }}>
                  {lighting.quality.charAt(0).toUpperCase() + lighting.quality.slice(1)} ({lighting.overall}%)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", width: "28px" }}>L:{lighting.leftSide}</span>
                <div style={{ flex: 1, position: "relative", height: "8px" }}>
                  <div className="lighting-meter" style={{ width: "100%", height: "100%" }} />
                  <div
                    className="lighting-indicator"
                    style={{
                      position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
                      left: `${lighting.overall}%`,
                      color: qualityColor(lighting.quality)
                    }}
                  />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", width: "28px" }}>R:{lighting.rightSide}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                <span style={{ color: "var(--text-light)" }}>Balance: {lighting.balance}%</span>
                {lighting.balance < 70 && (
                  <span style={{ color: "var(--yellow-check)" }}>
                    {lighting.leftSide > lighting.rightSide ? "More light on right side needed" : "More light on left side needed"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Capture button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "8px" }}>
            <button
              onClick={capturePhoto}
              disabled={!cameraReady || countdown !== null}
              className="capture-btn-outer"
            >
              <div className={`capture-btn-inner ${mode === "before" ? "capture-btn-before" : "capture-btn-after"}`} />
            </button>
          </div>

          {!cameraReady && (
            <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-light)" }}>
              Starting camera...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
