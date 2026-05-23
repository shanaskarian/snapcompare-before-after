"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface BotoxArea {
  severity: string;
  suggest: boolean;
  confidence: string;
  units: string;
  points: number;
  notes: string;
}

interface FillerArea {
  assessment: string;
  suggest: boolean;
  confidence: string;
  syringes: string;
  pointsPerSide?: number;
  points?: number;
  notes: string;
}

interface AnalysisResult {
  demographics: {
    estimatedAgeRange: string;
    apparentGender: string;
  };
  skinAssessment: {
    qualityScore: number;
    texture: string;
    tone: string;
    agingSigns: string;
  };
  botox: {
    forehead: BotoxArea;
    glabella: BotoxArea;
    crowsFeetLeft: BotoxArea;
    crowsFeetRight: BotoxArea;
    bunnyLines: BotoxArea;
  };
  filler: {
    cheeks: FillerArea;
    nasolabialFolds: FillerArea;
    lips: FillerArea;
    jawline: FillerArea;
    temples: FillerArea;
    tearTroughs: FillerArea;
  };
  summary: {
    topTreatments: string[];
    totalBotoxUnits: string;
    totalFillerSyringes: string;
    disclaimer: string;
  };
}

// ── MediaPipe Landmark Contours ──
const LEFT_EYE_CONTOUR = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33];
const RIGHT_EYE_CONTOUR = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249, 263];
const LEFT_EYEBROW = [70, 63, 105, 66, 107];
const RIGHT_EYEBROW = [300, 293, 334, 296, 336];
const OUTER_LIP_CONTOUR = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61];
const INNER_LIP_CONTOUR = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78];
const NOSE_BRIDGE = [6, 197, 195, 5, 4];

// ── Zone config for labels/colors ──
const ZONE_CONFIG: Record<string, { label: string; color: string }> = {
  forehead: { label: "Forehead", color: "#FF6B6B" },
  glabella: { label: "Glabella", color: "#FF8C42" },
  crowsFeetLeft: { label: "Crow's Feet L", color: "#FFD93D" },
  crowsFeetRight: { label: "Crow's Feet R", color: "#FFD93D" },
  bunnyLines: { label: "Bunny Lines", color: "#C77DFF" },
  cheeks: { label: "Cheeks", color: "#6C63FF" },
  nasolabialFolds: { label: "Nasolabial", color: "#00B4D8" },
  lips: { label: "Lips", color: "#FF006E" },
  jawline: { label: "Jawline", color: "#06D6A0" },
  temples: { label: "Temples", color: "#E0AAFF" },
  tearTroughs: { label: "Tear Troughs", color: "#48BFE3" },
};

type LM = { x: number; y: number; z: number };

// Compute injection point positions from face landmarks
function computeZonePoints(lms: LM[], zone: string): [number, number][] {
  const p = (i: number): [number, number] => [lms[i].x, lms[i].y];
  const mid = (a: [number, number], b: [number, number], t = 0.5): [number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const offset = (pt: [number, number], dx: number, dy: number): [number, number] =>
    [pt[0] + dx, pt[1] + dy];

  // Face scale reference (inter-eye distance for proportional offsets)
  const leftEye = p(33);
  const rightEye = p(263);
  const eyeDist = Math.abs(rightEye[0] - leftEye[0]);
  const s = eyeDist * 0.12; // small offset unit

  switch (zone) {
    case "forehead": {
      const top = p(10);     // forehead top center
      const brow = p(9);     // glabella
      // Two rows across forehead
      const leftT = p(54);   // left temple
      const rightT = p(284); // right temple
      const row1y = top[1] + (brow[1] - top[1]) * 0.25;
      const row2y = top[1] + (brow[1] - top[1]) * 0.55;
      const pts: [number, number][] = [];
      // Upper row: 5 points
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        pts.push([leftT[0] + (rightT[0] - leftT[0]) * t, row1y]);
      }
      // Lower row: 4 points
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.75) / 4;
        pts.push([leftT[0] + (rightT[0] - leftT[0]) * t, row2y]);
      }
      return pts;
    }
    case "glabella": {
      const center = p(9);
      return [
        center,
        offset(center, -s * 1.2, -s * 0.5),
        offset(center, s * 1.2, -s * 0.5),
        offset(center, -s * 0.8, s * 0.8),
        offset(center, s * 0.8, s * 0.8),
      ];
    }
    case "crowsFeetLeft": {
      const outer = p(33);
      return [
        offset(outer, -s * 1.5, -s * 0.8),
        offset(outer, -s * 1.8, s * 0.2),
        offset(outer, -s * 1.6, s * 1.2),
        offset(outer, -s * 1.2, s * 2.0),
      ];
    }
    case "crowsFeetRight": {
      const outer = p(263);
      return [
        offset(outer, s * 1.5, -s * 0.8),
        offset(outer, s * 1.8, s * 0.2),
        offset(outer, s * 1.6, s * 1.2),
        offset(outer, s * 1.2, s * 2.0),
      ];
    }
    case "bunnyLines": {
      const noseB = p(6);
      return [
        offset(noseB, -s * 1.5, s * 0.5),
        offset(noseB, s * 1.5, s * 0.5),
      ];
    }
    case "cheeks": {
      // Malar/zygomatic area — between outer eye and ear, below eye level
      const lEye = p(33);
      const rEye = p(263);
      const lEar = p(234);
      const rEar = p(454);
      const noseTip = p(4);
      const cheekY = lEye[1] + (noseTip[1] - lEye[1]) * 0.5;
      const pts: [number, number][] = [];
      // Left cheek
      const lCheekX = lEye[0] - (lEye[0] - lEar[0]) * 0.4;
      pts.push([lCheekX, cheekY - s], [lCheekX - s, cheekY + s], [lCheekX + s * 0.5, cheekY + s * 2]);
      // Right cheek
      const rCheekX = rEye[0] + (rEar[0] - rEye[0]) * 0.4;
      pts.push([rCheekX, cheekY - s], [rCheekX + s, cheekY + s], [rCheekX - s * 0.5, cheekY + s * 2]);
      return pts;
    }
    case "nasolabialFolds": {
      const noseTip = p(4);
      const lMouth = p(61);
      const rMouth = p(291);
      return [
        mid(noseTip, lMouth, 0.3),
        mid(noseTip, lMouth, 0.55),
        mid(noseTip, lMouth, 0.8),
        mid(noseTip, rMouth, 0.3),
        mid(noseTip, rMouth, 0.55),
        mid(noseTip, rMouth, 0.8),
      ];
    }
    case "lips": {
      // Injection points around the lip border
      return [
        p(0),    // upper lip center
        p(17),   // lower lip center
        p(61),   // left corner
        p(291),  // right corner
        mid(p(0), p(61), 0.5),   // upper left
        mid(p(0), p(291), 0.5),  // upper right
        mid(p(17), p(61), 0.5),  // lower left
        mid(p(17), p(291), 0.5), // lower right
      ];
    }
    case "jawline": {
      const chin = p(152);
      const lEar = p(234);
      const rEar = p(454);
      const pts: [number, number][] = [];
      // Left jaw
      for (let i = 1; i <= 4; i++) pts.push(mid(chin, lEar, i / 5));
      // Right jaw
      for (let i = 1; i <= 4; i++) pts.push(mid(chin, rEar, i / 5));
      return pts;
    }
    case "temples": {
      const lEyeOuter = p(33);
      const rEyeOuter = p(263);
      const lEar = p(234);
      const rEar = p(454);
      const foreheadTop = p(10);
      return [
        mid(lEyeOuter, lEar, 0.5).map((v, i) => i === 1 ? foreheadTop[1] + (lEyeOuter[1] - foreheadTop[1]) * 0.3 : v) as [number, number],
        mid(lEyeOuter, lEar, 0.5).map((v, i) => i === 1 ? foreheadTop[1] + (lEyeOuter[1] - foreheadTop[1]) * 0.5 : v) as [number, number],
        mid(rEyeOuter, rEar, 0.5).map((v, i) => i === 1 ? foreheadTop[1] + (rEyeOuter[1] - foreheadTop[1]) * 0.3 : v) as [number, number],
        mid(rEyeOuter, rEar, 0.5).map((v, i) => i === 1 ? foreheadTop[1] + (rEyeOuter[1] - foreheadTop[1]) * 0.5 : v) as [number, number],
      ];
    }
    case "tearTroughs": {
      const lInner = p(133);
      const rInner = p(362);
      return [
        offset(lInner, -s * 0.5, s * 1.2),
        offset(lInner, s * 0.5, s * 1.5),
        offset(rInner, s * 0.5, s * 1.2),
        offset(rInner, -s * 0.5, s * 1.5),
      ];
    }
    default:
      return [];
  }
}

export default function FaceAnalysis() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const [landmarks, setLandmarks] = useState<LM[] | null>(null);
  const [detectingFace, setDetectingFace] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Run MediaPipe FaceMesh on a static image
  const detectFace = useCallback(async (photoSrc: string) => {
    setDetectingFace(true);
    try {
      // @ts-ignore
      const { FaceMesh } = await import("@mediapipe/face_mesh");

      const mesh = new FaceMesh({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });

      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      return new Promise<LM[]>((resolve, reject) => {
        mesh.onResults((results: any) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            resolve(results.multiFaceLandmarks[0] as LM[]);
          } else {
            reject(new Error("No face detected in the photo"));
          }
          mesh.close();
        });

        // Create image element and send to FaceMesh
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          mesh.send({ image: c });
        };
        img.onerror = () => reject(new Error("Failed to load image for face detection"));
        img.src = photoSrc;
      });
    } catch (err: any) {
      console.error("Face detection error:", err);
      return null;
    } finally {
      setDetectingFace(false);
    }
  }, []);

  // Run face detection when photo changes
  useEffect(() => {
    if (photo) {
      setLandmarks(null);
      detectFace(photo).then((lms) => {
        if (lms) setLandmarks(lms as LM[]);
      }).catch(() => {});
    } else {
      setLandmarks(null);
    }
  }, [photo, detectFace]);

  // Start camera
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    setPhoto(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setAnalysis(null);
      setError(null);
      setActiveOverlays(new Set());
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/face-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Analysis failed");
      }
      const data = await res.json();
      setAnalysis(data.analysis);
      const suggested = new Set<string>();
      if (data.analysis.botox) {
        Object.entries(data.analysis.botox).forEach(([key, val]: [string, any]) => {
          if (val.suggest) suggested.add(key);
        });
      }
      if (data.analysis.filler) {
        Object.entries(data.analysis.filler).forEach(([key, val]: [string, any]) => {
          if (val.suggest) suggested.add(key);
        });
      }
      setActiveOverlays(suggested);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOverlay = (zone: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  // ── Draw all overlays ──
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo || !landmarks) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const lx = (i: number) => landmarks[i].x * w;
    const ly = (i: number) => landmarks[i].y * h;

    // ── Always draw facial feature outlines ──
    // Eye contours
    const drawContour = (indices: number[], color: string, lineWidth: number, fill = false) => {
      ctx.beginPath();
      ctx.moveTo(lx(indices[0]), ly(indices[0]));
      for (let i = 1; i < indices.length; i++) {
        ctx.lineTo(lx(indices[i]), ly(indices[i]));
      }
      if (fill) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    // Left eye outline
    drawContour(LEFT_EYE_CONTOUR, "rgba(255, 255, 255, 0.5)", 1.5);
    // Right eye outline
    drawContour(RIGHT_EYE_CONTOUR, "rgba(255, 255, 255, 0.5)", 1.5);

    // Eyebrows
    drawContour(LEFT_EYEBROW, "rgba(255, 255, 255, 0.35)", 1.5);
    drawContour(RIGHT_EYEBROW, "rgba(255, 255, 255, 0.35)", 1.5);

    // Nose bridge
    drawContour(NOSE_BRIDGE, "rgba(255, 255, 255, 0.4)", 1.5);
    // Nose tip dot
    ctx.beginPath();
    ctx.arc(lx(4), ly(4), 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();
    // Nose wings (nostrils outline)
    const noseWings = [219, 218, 237, 44, 1, 274, 457, 438, 439];
    drawContour(noseWings, "rgba(255, 255, 255, 0.3)", 1);

    // Lip outlines
    drawContour(OUTER_LIP_CONTOUR, "rgba(255, 100, 150, 0.6)", 2);
    drawContour(INNER_LIP_CONTOUR, "rgba(255, 100, 150, 0.4)", 1);

    // Iris dots
    ctx.beginPath();
    ctx.arc(lx(468), ly(468), 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(108, 99, 255, 0.6)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx(473), ly(473), 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(108, 99, 255, 0.6)";
    ctx.fill();

    // ── Draw injection zone dots ──
    if (analysis) {
      activeOverlays.forEach((zone) => {
        const config = ZONE_CONFIG[zone];
        if (!config) return;

        const pts = computeZonePoints(landmarks, zone);

        // Determine how many points to show
        let numPoints = pts.length;
        const botoxData = (analysis.botox as any)?.[zone];
        const fillerData = (analysis.filler as any)?.[zone];
        if (botoxData?.suggest) {
          numPoints = Math.min(botoxData.points || pts.length, pts.length);
        } else if (fillerData?.suggest) {
          const perSide = fillerData.pointsPerSide || fillerData.points || 0;
          numPoints = Math.min(zone === "lips" ? (fillerData.points || pts.length) : perSide * 2, pts.length);
        }

        for (let i = 0; i < numPoints; i++) {
          const [px, py] = pts[i];
          const x = px * w;
          const y = py * h;

          // Outer glow
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.fillStyle = config.color + "40";
          ctx.fill();

          // Inner dot
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = config.color;
          ctx.fill();

          // White center
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "white";
          ctx.fill();
        }

        // Draw zone label near first point
        if (pts.length > 0) {
          const [lbx, lby] = pts[0];
          ctx.font = "bold 10px monospace";
          ctx.fillStyle = config.color;
          ctx.fillText(config.label, lbx * w - 15, lby * h - 14);
        }
      });
    }
  }, [photo, landmarks, analysis, activeOverlays]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  const onPhotoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (canvasRef.current) {
      canvasRef.current.width = img.clientWidth;
      canvasRef.current.height = img.clientHeight;
      drawOverlay();
    }
  };

  const resetAll = () => {
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setActiveOverlays(new Set());
    setLandmarks(null);
    stopCamera();
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "none": return "var(--green)";
      case "mild": return "var(--yellow-check)";
      case "moderate": return "var(--coral)";
      case "severe": case "deep": case "significantly flat": case "significantly hollow": case "significant":
        return "#EF4444";
      default: return "var(--text-light)";
    }
  };

  const confidenceBadge = (c: string) => {
    const colors: Record<string, string> = { high: "var(--green)", medium: "var(--yellow-check)", low: "var(--coral)" };
    return colors[c] || "var(--text-light)";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Disclaimer Banner */}
      <div style={{
        background: "rgba(108,99,255,0.08)",
        border: "2px solid var(--purple)",
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--purple)",
        lineHeight: 1.6,
      }}>
        <strong>Educational Tool Only</strong> — This AI analysis provides general educational information about aesthetic treatments.
        It is NOT a medical diagnosis or treatment plan. Always consult a board-certified provider for personalized recommendations.
      </div>

      {/* Photo Capture Section */}
      {!photo && !showCamera && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>&#x1F9D1;&#x200D;&#x2695;&#xFE0F;</span>
              <span>AI Face Analysis</span>
            </div>
            <span className="app-badge app-badge-purple">NEW</span>
          </div>
          <div className="ai-panel-body" style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: "14px",
              color: "var(--text-light)", marginBottom: "24px", lineHeight: 1.7
            }}>
              Take or upload a clear, front-facing photo for AI-powered aesthetic analysis.
              Get educational suggestions for botox and filler treatment areas.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startCamera} className="app-btn-purple">
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Take Photo
                </span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="app-btn-secondary">
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Photo
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera View */}
      {showCamera && !photo && (
        <div>
          <div className="camera-viewport" style={{ position: "relative", marginBottom: "16px" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", display: "block", transform: "scaleX(-1)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
            <button onClick={stopCamera} className="app-btn-secondary">Cancel</button>
            <button
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="capture-btn-outer"
              style={{ width: "64px", height: "64px" }}
            >
              <div className="capture-btn-inner capture-btn-before" style={{ width: "46px", height: "46px" }} />
            </button>
          </div>
        </div>
      )}

      {/* Photo + Results */}
      {photo && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Photo with overlay */}
          <div className="ai-panel">
            <div className="ai-panel-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>&#x1F4F7;</span>
                <span>Your Photo</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {detectingFace && (
                  <span className="app-badge app-badge-yellow">Detecting face...</span>
                )}
                {landmarks && !detectingFace && (
                  <span className="app-badge app-badge-green">Face detected</span>
                )}
                {analysis && (
                  <span className="app-badge app-badge-purple">Analyzed</span>
                )}
              </div>
            </div>
            <div style={{ position: "relative", background: "#1a1a2e" }}>
              <img
                ref={imgRef}
                src={photo}
                alt="Face photo"
                onLoad={onPhotoLoad}
                style={{ width: "100%", display: "block" }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
              />
            </div>
            <div style={{ padding: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={resetAll} className="app-btn-secondary" style={{ flex: "0 0 auto" }}>
                New Photo
              </button>
              {!analysis && (
                <button
                  onClick={runAnalysis}
                  disabled={loading}
                  className="app-btn-purple"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
                >
                  {loading ? (
                    <>
                      <svg style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing face...
                    </>
                  ) : (
                    <>
                      <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Analyze Face
                    </>
                  )}
                </button>
              )}
              {analysis && (
                <button
                  onClick={runAnalysis}
                  disabled={loading}
                  className="app-btn-secondary"
                  style={{ flex: 1 }}
                >
                  Re-analyze
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(255,107,107,0.08)",
              border: "2px solid var(--coral)",
              borderRadius: "12px",
              padding: "14px",
              fontFamily: "var(--font-mono)", fontSize: "13px",
              color: "var(--coral)"
            }}>
              {error}
              <button
                onClick={runAnalysis}
                style={{
                  marginLeft: "8px", background: "none", border: "none",
                  cursor: "pointer", textDecoration: "underline",
                  color: "var(--coral)", fontFamily: "var(--font-mono)", fontSize: "13px"
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <>
              {/* Demographics & Skin */}
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>&#x1F9EC;</span>
                    <span>Demographics & Skin</span>
                  </div>
                </div>
                <div className="ai-panel-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div style={{ textAlign: "center", padding: "16px", background: "var(--cream)", borderRadius: "12px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--ink)" }}>
                        {analysis.demographics.estimatedAgeRange}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Est. Age
                      </div>
                    </div>
                    <div style={{ textAlign: "center", padding: "16px", background: "var(--cream)", borderRadius: "12px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: "var(--ink)" }}>
                        {analysis.demographics.apparentGender}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Gender
                      </div>
                    </div>
                    <div style={{ textAlign: "center", padding: "16px", background: "var(--cream)", borderRadius: "12px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", color: skinScoreColor(analysis.skinAssessment.qualityScore) }}>
                        {analysis.skinAssessment.qualityScore}/10
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Skin Quality
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)", lineHeight: 1.7 }}>
                    <p><strong>Texture:</strong> {analysis.skinAssessment.texture}</p>
                    <p style={{ marginTop: "4px" }}><strong>Tone:</strong> {analysis.skinAssessment.tone}</p>
                    <p style={{ marginTop: "4px" }}><strong>Aging Signs:</strong> {analysis.skinAssessment.agingSigns}</p>
                  </div>
                </div>
              </div>

              {/* Botox Suggestions */}
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>&#x1F489;</span>
                    <span>Botox Education</span>
                  </div>
                  {analysis.summary.totalBotoxUnits !== "0" && (
                    <span className="app-badge app-badge-coral">{analysis.summary.totalBotoxUnits} units</span>
                  )}
                </div>
                <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {Object.entries(analysis.botox).map(([key, area]) => (
                    <ZoneCard
                      key={key}
                      zoneKey={key}
                      label={ZONE_CONFIG[key]?.label || key}
                      color={ZONE_CONFIG[key]?.color || "#999"}
                      type="botox"
                      severity={area.severity}
                      suggest={area.suggest}
                      confidence={area.confidence}
                      amount={area.units + " units"}
                      points={area.points}
                      notes={area.notes}
                      active={activeOverlays.has(key)}
                      onToggle={() => toggleOverlay(key)}
                      severityColor={severityColor}
                      confidenceBadge={confidenceBadge}
                    />
                  ))}
                </div>
              </div>

              {/* Filler Suggestions */}
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>&#x2728;</span>
                    <span>Filler Education</span>
                  </div>
                  {analysis.summary.totalFillerSyringes !== "0" && (
                    <span className="app-badge app-badge-purple">{analysis.summary.totalFillerSyringes} syringes</span>
                  )}
                </div>
                <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {Object.entries(analysis.filler).map(([key, area]) => (
                    <ZoneCard
                      key={key}
                      zoneKey={key}
                      label={ZONE_CONFIG[key]?.label || key}
                      color={ZONE_CONFIG[key]?.color || "#999"}
                      type="filler"
                      severity={area.assessment}
                      suggest={area.suggest}
                      confidence={area.confidence}
                      amount={area.syringes + " syringe(s)"}
                      points={(area.pointsPerSide ? area.pointsPerSide + "/side" : area.points?.toString()) || "0"}
                      notes={area.notes}
                      active={activeOverlays.has(key)}
                      onToggle={() => toggleOverlay(key)}
                      severityColor={severityColor}
                      confidenceBadge={confidenceBadge}
                    />
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>&#x1F4CB;</span>
                    <span>Summary</span>
                  </div>
                </div>
                <div className="ai-panel-body">
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--purple)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                      Top Recommended Areas
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {analysis.summary.topTreatments.map((t, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)"
                        }}>
                          <span style={{
                            width: "24px", height: "24px", borderRadius: "50%",
                            background: i === 0 ? "var(--coral)" : i === 1 ? "var(--purple)" : "var(--yellow-check)",
                            color: i === 2 ? "var(--ink)" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "12px", flexShrink: 0
                          }}>
                            {i + 1}
                          </span>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    background: "rgba(108,99,255,0.06)",
                    border: "1px solid rgba(108,99,255,0.2)",
                    borderRadius: "10px",
                    padding: "14px",
                    fontFamily: "var(--font-mono)", fontSize: "12px",
                    color: "var(--purple)", lineHeight: 1.6, fontStyle: "italic"
                  }}>
                    {analysis.summary.disclaimer}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function skinScoreColor(score: number): string {
  if (score >= 8) return "var(--green)";
  if (score >= 5) return "var(--yellow-check)";
  return "var(--coral)";
}

function ZoneCard({
  zoneKey, label, color, type, severity, suggest, confidence, amount, points, notes, active, onToggle,
  severityColor, confidenceBadge,
}: {
  zoneKey: string; label: string; color: string; type: string;
  severity: string; suggest: boolean; confidence: string; amount: string;
  points: number | string; notes: string; active: boolean;
  onToggle: () => void;
  severityColor: (s: string) => string;
  confidenceBadge: (c: string) => string;
}) {
  return (
    <div style={{
      border: active ? `2px solid ${color}` : "2px solid #eee",
      borderRadius: "12px",
      overflow: "hidden",
      transition: "all 0.2s",
      background: active ? color + "08" : "white",
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "12px", height: "12px", borderRadius: "50%",
            background: suggest ? color : "#ccc",
            border: active ? "2px solid var(--ink)" : "2px solid transparent",
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--ink)", letterSpacing: "0.5px" }}>
            {label}
          </span>
          {suggest && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
              background: color + "20", color: color,
              padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "1px",
            }}>
              Suggested
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: severityColor(severity), fontWeight: 500,
          }}>
            {severity}
          </span>
          {suggest && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "10px",
              background: confidenceBadge(confidence) + "20",
              color: confidenceBadge(confidence),
              padding: "2px 6px", borderRadius: "4px",
            }}>
              {confidence}
            </span>
          )}
        </div>
      </div>
      {suggest && active && (
        <div style={{
          padding: "0 16px 12px",
          fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)",
          lineHeight: 1.6,
        }}>
          <div style={{ display: "flex", gap: "16px", marginBottom: "6px" }}>
            <span><strong style={{ color: "var(--ink)" }}>{amount}</strong></span>
            <span><strong style={{ color: "var(--ink)" }}>{points}</strong> point(s)</span>
          </div>
          <p>{notes}</p>
        </div>
      )}
    </div>
  );
}
