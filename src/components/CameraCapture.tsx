"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export interface FaceNodes {
  leftEye: [number, number];
  rightEye: [number, number];
  noseTip: [number, number];
  leftEar: [number, number];
  rightEar: [number, number];
  chinBottom: [number, number];
  noseBridge: [number, number];
  outerLips: [number, number][];
  // Metrics for matching
  interEyeDist: number;       // scale proxy
  earToEarDist: number;       // scale proxy
  headRotation: number;       // left-ear-to-nose / nose-to-right-ear ratio
  headTilt: number;           // eye-line angle in degrees
  faceBrightness: number;     // average face brightness 0-255
  leftBrightness: number;     // left half brightness
  rightBrightness: number;    // right half brightness
}

interface Props {
  mode: "before" | "after";
  existingBefore: string | null;
  beforeLandmarks: FaceNodes | null;
  onCapture: (dataUrl: string, landmarks: FaceNodes | null) => void;
}

// MediaPipe landmark indices
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const NOSE_TIP = 4;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const CHIN = 152;
const NOSE_BRIDGE = 6;
const OUTER_LIP = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61];

// Match thresholds
const POSITION_THRESHOLD = 0.025;
const SCALE_THRESHOLD = 0.15;       // 15% size difference allowed
const ROTATION_THRESHOLD = 0.2;     // head rotation ratio tolerance
const TILT_THRESHOLD = 5;           // degrees
const BRIGHTNESS_THRESHOLD = 30;    // absolute brightness difference

export default function CameraCapture({ mode, existingBefore, beforeLandmarks, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const beforeOverlayRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const faceMeshRef = useRef<any>(null);
  const currentLandmarksRef = useRef<FaceNodes | null>(null);

  // Use refs for values needed in FaceMesh callback to avoid re-init
  const modeRef = useRef(mode);
  const beforeLandmarksRef = useRef(beforeLandmarks);
  const showGuideRef = useRef(true);
  const facingModeRef = useRef<"user" | "environment">("user");

  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [matchStatus, setMatchStatus] = useState<"none" | "red" | "yellow" | "green">("none");
  const [matchDetails, setMatchDetails] = useState({ position: false, scale: false, angle: false, lighting: false });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [showGuide, setShowGuide] = useState(true);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [meshLoading, setMeshLoading] = useState(true);

  // Keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { beforeLandmarksRef.current = beforeLandmarks; }, [beforeLandmarks]);
  useEffect(() => { showGuideRef.current = showGuide; }, [showGuide]);
  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

  // Extract FaceNodes from MediaPipe landmarks + compute metrics
  const extractNodes = useCallback((landmarks: any[]): FaceNodes => {
    const leftEye: [number, number] = [landmarks[LEFT_IRIS].x, landmarks[LEFT_IRIS].y];
    const rightEye: [number, number] = [landmarks[RIGHT_IRIS].x, landmarks[RIGHT_IRIS].y];
    const noseTip: [number, number] = [landmarks[NOSE_TIP].x, landmarks[NOSE_TIP].y];
    const leftEar: [number, number] = [landmarks[LEFT_EAR].x, landmarks[LEFT_EAR].y];
    const rightEar: [number, number] = [landmarks[RIGHT_EAR].x, landmarks[RIGHT_EAR].y];
    const chinBottom: [number, number] = [landmarks[CHIN].x, landmarks[CHIN].y];
    const noseBridge: [number, number] = [landmarks[NOSE_BRIDGE].x, landmarks[NOSE_BRIDGE].y];

    const interEyeDist = Math.sqrt((leftEye[0] - rightEye[0]) ** 2 + (leftEye[1] - rightEye[1]) ** 2);
    const earToEarDist = Math.sqrt((leftEar[0] - rightEar[0]) ** 2 + (leftEar[1] - rightEar[1]) ** 2);

    const leftEarToNose = Math.sqrt((leftEar[0] - noseTip[0]) ** 2 + (leftEar[1] - noseTip[1]) ** 2);
    const rightEarToNose = Math.sqrt((rightEar[0] - noseTip[0]) ** 2 + (rightEar[1] - noseTip[1]) ** 2);
    const headRotation = rightEarToNose > 0.001 ? leftEarToNose / rightEarToNose : 1;

    const eyeDx = rightEye[0] - leftEye[0];
    const eyeDy = rightEye[1] - leftEye[1];
    const headTilt = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

    return {
      leftEye, rightEye, noseTip, leftEar, rightEar, chinBottom, noseBridge,
      outerLips: OUTER_LIP.map((i) => [landmarks[i].x, landmarks[i].y] as [number, number]),
      interEyeDist, earToEarDist, headRotation, headTilt,
      faceBrightness: 0, leftBrightness: 0, rightBrightness: 0, // filled by analyzeBrightness
    };
  }, []);

  // Analyze face brightness from the hidden canvas
  const analyzeBrightness = useCallback((nodes: FaceNodes): FaceNodes => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return nodes;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return nodes;

    ctx.drawImage(video, 0, 0);
    const w = canvas.width;
    const h = canvas.height;

    // Sample face region between ears and from eyes to chin
    const faceLeft = Math.floor(Math.min(nodes.leftEar[0], nodes.leftEye[0]) * w);
    const faceRight = Math.ceil(Math.max(nodes.rightEar[0], nodes.rightEye[0]) * w);
    const faceTop = Math.floor(Math.min(nodes.leftEye[1], nodes.rightEye[1]) * h) - 20;
    const faceBottom = Math.ceil(nodes.chinBottom[1] * h);
    const faceW = Math.max(1, faceRight - faceLeft);
    const faceH = Math.max(1, faceBottom - faceTop);
    const faceMidX = faceLeft + faceW / 2;

    try {
      const imgData = ctx.getImageData(
        Math.max(0, faceLeft), Math.max(0, faceTop),
        Math.min(faceW, w - faceLeft), Math.min(faceH, h - faceTop)
      );
      let totalBright = 0, leftBright = 0, rightBright = 0;
      let totalCount = 0, leftCount = 0, rightCount = 0;
      const step = 4;

      for (let py = 0; py < imgData.height; py += step) {
        for (let px = 0; px < imgData.width; px += step) {
          const i = (py * imgData.width + px) * 4;
          const brightness = imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114;
          totalBright += brightness;
          totalCount++;
          if ((faceLeft + px) < faceMidX) { leftBright += brightness; leftCount++; }
          else { rightBright += brightness; rightCount++; }
        }
      }

      return {
        ...nodes,
        faceBrightness: totalCount > 0 ? totalBright / totalCount : 0,
        leftBrightness: leftCount > 0 ? leftBright / leftCount : 0,
        rightBrightness: rightCount > 0 ? rightBright / rightCount : 0,
      };
    } catch {
      return nodes;
    }
  }, []);

  // Compare current vs before landmarks — returns detailed match info
  const compareDetailed = useCallback((current: FaceNodes, target: FaceNodes) => {
    // Position: average landmark distance
    const posKeys: (keyof Pick<FaceNodes, "leftEye" | "rightEye" | "noseTip" | "leftEar" | "rightEar" | "chinBottom">)[] = [
      "leftEye", "rightEye", "noseTip", "leftEar", "rightEar", "chinBottom",
    ];
    let totalDist = 0;
    for (const key of posKeys) {
      const c = current[key] as [number, number];
      const t = target[key] as [number, number];
      totalDist += Math.sqrt((c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2);
    }
    const avgDist = totalDist / posKeys.length;

    // Scale: compare inter-eye distance ratio
    const scaleRatio = target.interEyeDist > 0.001 ? current.interEyeDist / target.interEyeDist : 1;
    const scaleDiff = Math.abs(1 - scaleRatio);

    // Angle: head rotation and tilt
    const rotationDiff = Math.abs(current.headRotation - target.headRotation);
    const tiltDiff = Math.abs(current.headTilt - target.headTilt);

    // Lighting: brightness difference
    const brightDiff = Math.abs(current.faceBrightness - target.faceBrightness);
    const balanceDiff = Math.abs(
      (current.leftBrightness - current.rightBrightness) -
      (target.leftBrightness - target.rightBrightness)
    );

    const positionOk = avgDist < POSITION_THRESHOLD;
    const scaleOk = scaleDiff < SCALE_THRESHOLD;
    const angleOk = rotationDiff < ROTATION_THRESHOLD && tiltDiff < TILT_THRESHOLD;
    const lightingOk = brightDiff < BRIGHTNESS_THRESHOLD && balanceDiff < BRIGHTNESS_THRESHOLD;

    return { positionOk, scaleOk, angleOk, lightingOk, allMatch: positionOk && scaleOk && angleOk && lightingOk };
  }, []);

  // Draw face mesh overlay — called from FaceMesh onResults via ref
  const drawMeshFromResults = useCallback((landmarks: any[]) => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    overlay.width = w;
    overlay.height = h;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!showGuideRef.current) return;

    let nodes = extractNodes(landmarks);
    nodes = analyzeBrightness(nodes);
    currentLandmarksRef.current = nodes;

    const curMode = modeRef.current;
    const curBeforeLandmarks = beforeLandmarksRef.current;

    // Determine match color and status
    let lineColor = "rgba(255, 107, 107, 0.9)";
    let nodeColor = "rgba(255, 107, 107, 0.95)";
    let status: "none" | "red" | "yellow" | "green" = "red";
    let details = { position: false, scale: false, angle: false, lighting: false };

    if (curMode === "after" && curBeforeLandmarks) {
      const match = compareDetailed(nodes, curBeforeLandmarks);
      details = { position: match.positionOk, scale: match.scaleOk, angle: match.angleOk, lighting: match.lightingOk };

      const matchCount = [match.positionOk, match.scaleOk, match.angleOk, match.lightingOk].filter(Boolean).length;

      if (match.allMatch) {
        lineColor = "rgba(34, 197, 94, 0.9)";
        nodeColor = "rgba(34, 197, 94, 0.95)";
        status = "green";
      } else if (matchCount >= 2) {
        lineColor = "rgba(251, 191, 36, 0.9)";
        nodeColor = "rgba(251, 191, 36, 0.95)";
        status = "yellow";
      }
    } else if (curMode === "before") {
      lineColor = "rgba(108, 99, 255, 0.8)";
      nodeColor = "rgba(108, 99, 255, 0.95)";
      status = "none";
    }

    setMatchStatus(status);
    setMatchDetails(details);
    setFaceDetected(true);

    // Helper: convert normalized to pixel
    const px = (x: number) => x * w;
    const py = (y: number) => y * h;

    // Draw connection lines
    const connections: [keyof Pick<FaceNodes, "leftEar" | "leftEye" | "noseBridge" | "rightEye" | "rightEar" | "noseTip" | "chinBottom">, keyof Pick<FaceNodes, "leftEar" | "leftEye" | "noseBridge" | "rightEye" | "rightEar" | "noseTip" | "chinBottom">][] = [
      ["leftEar", "leftEye"],
      ["leftEye", "noseBridge"],
      ["noseBridge", "rightEye"],
      ["rightEye", "rightEar"],
      ["leftEye", "rightEye"],
      ["noseBridge", "noseTip"],
      ["noseTip", "chinBottom"],
    ];

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    for (const [from, to] of connections) {
      const f = nodes[from] as [number, number];
      const t = nodes[to] as [number, number];
      ctx.beginPath();
      ctx.moveTo(px(f[0]), py(f[1]));
      ctx.lineTo(px(t[0]), py(t[1]));
      ctx.stroke();
    }

    // Draw lip outline
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < nodes.outerLips.length; i++) {
      const [lx, ly] = nodes.outerLips[i];
      if (i === 0) ctx.moveTo(px(lx), py(ly));
      else ctx.lineTo(px(lx), py(ly));
    }
    ctx.closePath();
    ctx.stroke();

    // Draw nodes
    const nodePoints: [number, number][] = [
      nodes.leftEye, nodes.rightEye, nodes.noseTip,
      nodes.leftEar, nodes.rightEar, nodes.noseBridge,
    ];
    for (const [nx, ny] of nodePoints) {
      ctx.beginPath();
      ctx.arc(px(nx), py(ny), 5, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Shoulder guide line
    const shoulderY = nodes.chinBottom[1] + (nodes.chinBottom[1] - nodes.noseBridge[1]) * 0.8;
    const shoulderSpan = Math.abs(nodes.leftEar[0] - nodes.rightEar[0]) * 1.8;
    const shoulderCX = (nodes.leftEar[0] + nodes.rightEar[0]) / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(px(shoulderCX - shoulderSpan / 2), py(shoulderY));
    ctx.quadraticCurveTo(px(shoulderCX), py(shoulderY + 0.04), px(shoulderCX + shoulderSpan / 2), py(shoulderY));
    ctx.stroke();
    ctx.setLineDash([]);

    // Status text
    const isSelfie = facingModeRef.current === "user";
    const fontSize = Math.max(14, Math.round(w * 0.028));
    let statusText = "Face detected";
    if (curMode === "after" && curBeforeLandmarks) {
      if (status === "green") statusText = "Perfect match! Hold steady";
      else if (status === "yellow") {
        const missing: string[] = [];
        if (!details.position) missing.push("position");
        if (!details.scale) missing.push("distance");
        if (!details.angle) missing.push("angle");
        if (!details.lighting) missing.push("lighting");
        statusText = `Adjust: ${missing.join(", ")}`;
      } else {
        statusText = "Align face to match before photo";
      }
    } else if (curMode === "before") {
      statusText = "Position your face — hold steady";
    }

    ctx.save();
    if (isSelfie) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const textY = py(nodes.chinBottom[1]) + 40;
    const cx = w / 2;
    const textMetrics = ctx.measureText(statusText);
    const pillW = textMetrics.width + 24;
    const pillH = fontSize + 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, textY - 2, pillW, pillH, pillH / 2);
    ctx.fill();

    const textColor = status === "green" ? "rgba(34,197,94,0.95)" :
                      status === "yellow" ? "rgba(251,191,36,0.95)" :
                      curMode === "before" ? "rgba(108,99,255,0.95)" :
                      "rgba(255,107,107,0.95)";
    ctx.fillStyle = textColor;
    ctx.fillText(statusText, cx, textY + 4);
    ctx.restore();
  }, [extractNodes, analyzeBrightness, compareDetailed]);

  // Draw "no face" overlay
  const drawNoFaceOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    overlay.width = w;
    overlay.height = h;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!showGuideRef.current) return;

    const cx = w / 2;
    const cy = h * 0.38;
    const rx = w * 0.2;
    const ry = h * 0.28;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 10, ry + 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    const isSelfie = facingModeRef.current === "user";
    const fontSize = Math.max(14, Math.round(w * 0.028));
    ctx.save();
    if (isSelfie) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const statusText = "Position your face in the oval";
    const textY = cy + ry + 20;
    const textMetrics = ctx.measureText(statusText);
    const pillW = textMetrics.width + 24;
    const pillH = fontSize + 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, textY - 2, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(statusText, cx, textY + 4);
    ctx.restore();
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
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

  // Re-attach stream to video element after preview is dismissed
  // (the video element unmounts during preview and loses its srcObject)
  useEffect(() => {
    if (capturedPreview === null && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [capturedPreview]);

  // Store drawMesh in a ref so FaceMesh onResults always uses latest version without re-init
  const drawMeshRef = useRef(drawMeshFromResults);
  useEffect(() => { drawMeshRef.current = drawMeshFromResults; }, [drawMeshFromResults]);

  const drawNoFaceRef = useRef(drawNoFaceOverlay);
  useEffect(() => { drawNoFaceRef.current = drawNoFaceOverlay; }, [drawNoFaceOverlay]);

  // Initialize MediaPipe FaceMesh — runs ONCE when camera is ready
  useEffect(() => {
    if (!cameraReady) return;

    let cancelled = false;

    const initFaceMesh = async () => {
      // If already initialized, skip
      if (faceMeshRef.current) {
        setMeshLoading(false);
        return;
      }

      try {
        const faceMeshModule = await import("@mediapipe/face_mesh");
        const FaceMesh = faceMeshModule.FaceMesh;

        const mesh = new FaceMesh({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        mesh.onResults((results: any) => {
          if (cancelled) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            drawMeshRef.current(results.multiFaceLandmarks[0]);
          } else {
            setFaceDetected(false);
            currentLandmarksRef.current = null;
            setMatchStatus("none");
            setMatchDetails({ position: false, scale: false, angle: false, lighting: false });
            drawNoFaceRef.current();
          }
        });

        if (!cancelled) {
          faceMeshRef.current = mesh;
          setMeshLoading(false);
        }
      } catch (err) {
        console.error("FaceMesh init error:", err);
        setMeshLoading(false);
      }
    };

    initFaceMesh();

    return () => {
      cancelled = true;
    };
  }, [cameraReady]); // Only depends on cameraReady — no more drawMesh dependency!

  // Send video frames to FaceMesh
  useEffect(() => {
    if (!cameraReady || meshLoading) return;

    let running = true;

    const sendFrame = async () => {
      const video = videoRef.current;
      const mesh = faceMeshRef.current;
      if (!video || !mesh || video.readyState < 2) {
        if (running) animFrameRef.current = requestAnimationFrame(sendFrame);
        return;
      }

      try {
        await mesh.send({ image: video });
      } catch (e) {
        // Ignore frame send errors
      }

      if (running) {
        setTimeout(() => {
          if (running) animFrameRef.current = requestAnimationFrame(sendFrame);
        }, 50);
      }
    };

    animFrameRef.current = requestAnimationFrame(sendFrame);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraReady, meshLoading]);

  // Redraw overlay when guide is toggled
  useEffect(() => {
    if (!faceDetected) {
      drawNoFaceOverlay();
    }
  }, [showGuide, faceDetected, drawNoFaceOverlay]);

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
      onCapture(capturedPreview, currentLandmarksRef.current);
      setCapturedPreview(null);
    }
  };

  const retakeCapture = () => {
    setCapturedPreview(null);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    setCameraReady(false);
    faceMeshRef.current = null; // Reset so it re-inits with new camera
    setMeshLoading(true);
  };

  // In "after" mode, capture is only allowed when all checks pass (green)
  const canCapture = mode === "before"
    ? cameraReady && countdown === null
    : cameraReady && countdown === null && matchStatus === "green";

  // Captured preview mode
  if (capturedPreview) {
    return (
      <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="preview-container" style={{ position: "relative" }}>
            <img src={capturedPreview} alt="Captured" style={{ width: "100%", display: "block" }} />
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

          {/* Transparent before photo overlay for "after" mode */}
          {mode === "after" && existingBefore && (
            <img
              ref={beforeOverlayRef}
              src={existingBefore}
              alt=""
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
                opacity: 0.25,
                pointerEvents: "none",
                borderRadius: "13px",
                zIndex: 5,
              }}
            />
          )}

          <canvas
            ref={overlayCanvasRef}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
              borderRadius: "13px",
              zIndex: 6,
            }}
          />

          {/* Mode badge */}
          <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 10 }}>
            <span className={`app-badge ${mode === "before" ? "app-badge-blue" : "app-badge-green"}`}>
              {mode === "before" ? "BEFORE" : "AFTER"}
            </span>
          </div>

          {/* Camera flip button */}
          <button
            onClick={toggleCamera}
            style={{
              position: "absolute", top: "12px", right: "12px", zIndex: 10,
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
              position: "absolute", top: "12px", right: "60px", zIndex: 10,
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

          {/* Small before reference thumbnail (bottom-left) */}
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
          {/* Face detection status */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div className="status-indicator">
              <div className={faceDetected ? "status-dot-ok" : "status-dot-bad"} />
              <span>{meshLoading ? "Loading..." : faceDetected ? "Face detected" : "No face"}</span>
            </div>
            {mode === "after" && beforeLandmarks && faceDetected && (
              <>
                <div className="status-indicator">
                  <div className={matchDetails.position ? "status-dot-ok" : "status-dot-bad"} />
                  <span>Position</span>
                </div>
                <div className="status-indicator">
                  <div className={matchDetails.scale ? "status-dot-ok" : "status-dot-bad"} />
                  <span>Scale</span>
                </div>
                <div className="status-indicator">
                  <div className={matchDetails.angle ? "status-dot-ok" : "status-dot-bad"} />
                  <span>Angle</span>
                </div>
                <div className="status-indicator">
                  <div className={matchDetails.lighting ? "status-dot-ok" : "status-dot-bad"} />
                  <span>Lighting</span>
                </div>
              </>
            )}
          </div>

          {/* Capture button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "8px" }}>
            <button
              onClick={capturePhoto}
              disabled={!canCapture}
              className="capture-btn-outer"
              style={{ opacity: canCapture ? 1 : 0.4, cursor: canCapture ? "pointer" : "not-allowed" }}
            >
              <div className={`capture-btn-inner ${mode === "before" ? "capture-btn-before" : "capture-btn-after"}`} />
            </button>
          </div>

          {/* Helpful message when button is locked */}
          {mode === "after" && !canCapture && faceDetected && (
            <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--coral)" }}>
              Align all indicators to green to capture
            </p>
          )}

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
