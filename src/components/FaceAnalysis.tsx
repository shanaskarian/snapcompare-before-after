"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface BotoxArea {
  severity: string;
  suggest: boolean;
  confidence: string;
  units: string;
  points: number;
  notes: string;
  estimatedCost?: string;
}

interface FillerArea {
  assessment: string;
  suggest: boolean;
  confidence: string;
  syringes: string;
  pointsPerSide?: number;
  points?: number;
  notes: string;
  estimatedCost?: string;
}

interface SkinHealthScores {
  hydration: number;
  elasticity: number;
  texture: number;
  toneEvenness: number;
  radiance: number;
  clarity: number;
}

interface AnalysisResult {
  demographics: {
    estimatedAgeRange: string;
    apparentGender: string;
  };
  symmetry?: {
    score: number;
    leftRightDeviation: number;
    thirdRatios: { upper: number; middle: number; lower: number };
    notes: string;
  };
  skinHealth?: SkinHealthScores;
  skinAssessment: {
    qualityScore: number;
    texture: string;
    tone: string;
    agingSigns: string;
  };
  agingAssessment?: {
    biologicalVsChronological: string;
    agingScore: number;
    keyIndicators: string[];
    earliestAgingAreas: string[];
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
  costEstimate?: {
    totalBotoxCost: string;
    totalFillerCost: string;
    grandTotal: string;
  };
  treatmentTimeline?: {
    recommendedOrder: Array<{ step: number; treatment: string; timeframe: string }>;
    maintenanceSchedule: string;
  };
  narrative?: string;
  summary: {
    topTreatments: string[];
    totalBotoxUnits: string;
    totalFillerSyringes: string;
    overallScore?: number;
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
  const [reportTab, setReportTab] = useState<"overview" | "treatments" | "plan">("overview");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const meshRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const liveLandmarksRef = useRef<LM[] | null>(null);

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

  // ── Shared face tracker drawing (used by both live and static overlays) ──
  // Key landmark indices for the tracker style:
  // Ears: 234 (left tragus), 454 (right tragus)
  // Eyes: 33 (left eye outer), 133 (left eye inner), 263 (right eye outer), 362 (right eye inner)
  // Nose: 6 (bridge top), 4 (tip), 48 (left alar), 278 (right alar)
  // Chin: 152 (chin center), 172 (left jaw low), 397 (right jaw low)
  const drawFaceTracker = (
    ctx: CanvasRenderingContext2D,
    lms: LM[],
    w: number,
    h: number,
    mirror: boolean
  ) => {
    const px = (i: number) => (mirror ? 1 - lms[i].x : lms[i].x) * w;
    const py = (i: number) => lms[i].y * h;
    const dotColor = "rgba(108, 99, 255, 0.85)";
    const lineColor = "rgba(108, 99, 255, 0.5)";
    const lipColor = "rgba(255, 100, 150, 0.7)";
    const chinColor = "rgba(255, 255, 255, 0.5)";
    const dotR = 4;

    // Helper: draw a dot
    const dot = (i: number) => {
      ctx.beginPath();
      ctx.arc(px(i), py(i), dotR, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    };

    // Helper: draw line between two landmarks
    const line = (a: number, b: number, color: string, lw: number) => {
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    // Helper: draw a polyline through indices
    const polyline = (indices: number[], color: string, lw: number, close = false) => {
      if (indices.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(px(indices[0]), py(indices[0]));
      for (let k = 1; k < indices.length; k++) {
        ctx.lineTo(px(indices[k]), py(indices[k]));
      }
      if (close) ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    // ── Key points: ears, eyes, nose ──
    const keyPoints = [
      234, 454,           // ears (tragus)
      33, 133, 263, 362,  // eye corners
      6, 4, 48, 278,      // nose (bridge top, tip, left/right alar)
    ];
    keyPoints.forEach(dot);

    // ── Connect: left ear → left eye outer → left eye inner → nose bridge ──
    line(234, 33, lineColor, 1.5);
    line(33, 133, lineColor, 1.5);
    line(133, 6, lineColor, 1.5);

    // ── Connect: right ear → right eye outer → right eye inner → nose bridge ──
    line(454, 263, lineColor, 1.5);
    line(263, 362, lineColor, 1.5);
    line(362, 6, lineColor, 1.5);

    // ── Nose: bridge → tip, tip → left alar, tip → right alar ──
    line(6, 4, lineColor, 1.5);
    line(4, 48, lineColor, 1.5);
    line(4, 278, lineColor, 1.5);

    // ── Iris dots ──
    if (lms.length > 473) {
      ctx.beginPath();
      ctx.arc(px(468), py(468), 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(108, 99, 255, 0.7)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px(473), py(473), 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(108, 99, 255, 0.7)";
      ctx.fill();
    }

    // ── Lip outline (outer contour, closed loop) ──
    polyline(OUTER_LIP_CONTOUR, lipColor, 2, true);

    // ── Chin line: jaw low left → chin center → jaw low right ──
    // Use a smooth curve across several jaw landmarks
    const chinLine = [172, 136, 150, 149, 176, 152, 400, 378, 379, 365, 397];
    polyline(chinLine, chinColor, 1.5);
  };

  // ── Draw face contours on the live camera canvas ──
  const drawLiveOverlay = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const video = videoRef.current;
    const lms = liveLandmarksRef.current;
    if (!canvas || !video || !lms) return;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFaceTracker(ctx, lms, canvas.width, canvas.height, true);
  }, []);

  // ── Live face detection loop ──
  const startLiveDetection = useCallback(async () => {
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
      mesh.onResults((results: any) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          liveLandmarksRef.current = results.multiFaceLandmarks[0] as LM[];
        } else {
          liveLandmarksRef.current = null;
        }
        drawLiveOverlay();
      });
      meshRef.current = mesh;

      // Detection loop: send video frames to FaceMesh
      let processing = false;
      const loop = async () => {
        if (!videoRef.current || !meshRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(loop);
          return;
        }
        // Size the live canvas to match video display size
        const liveCanvas = liveCanvasRef.current;
        if (liveCanvas && videoRef.current) {
          const rect = videoRef.current.getBoundingClientRect();
          if (liveCanvas.width !== rect.width || liveCanvas.height !== rect.height) {
            liveCanvas.width = rect.width;
            liveCanvas.height = rect.height;
          }
        }
        if (!processing) {
          processing = true;
          try {
            await meshRef.current.send({ image: videoRef.current });
          } catch {
            // ignore send errors if camera stopped
          }
          processing = false;
        }
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error("Live face detection init error:", err);
    }
  }, [drawLiveOverlay]);

  const stopLiveDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (meshRef.current) {
      try { meshRef.current.close(); } catch {}
      meshRef.current = null;
    }
    liveLandmarksRef.current = null;
  }, []);

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
        // Start live face detection after camera is ready
        startLiveDetection();
      }
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    stopLiveDetection();
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

    // Draw the face tracker (same style as live camera)
    drawFaceTracker(ctx, landmarks, w, h, false);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveDetection();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopLiveDetection]);

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
            <canvas
              ref={liveCanvasRef}
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
              {/* Hero Score Card */}
              {analysis.summary.overallScore != null && (
                <div className="ai-panel" style={{ overflow: "hidden" }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${analysis.summary.overallScore >= 75 ? "var(--green)" : analysis.summary.overallScore >= 50 ? "var(--yellow-check)" : "var(--coral)"}15, transparent)`,
                    padding: "24px 20px",
                    display: "flex", alignItems: "center", gap: "20px",
                  }}>
                    <div style={{ position: "relative", width: "80px", height: "80px", flexShrink: 0 }}>
                      <svg viewBox="0 0 80 80" style={{ width: "80px", height: "80px", transform: "rotate(-90deg)" }}>
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#eee" strokeWidth="6" />
                        <circle cx="40" cy="40" r="34" fill="none"
                          stroke={analysis.summary.overallScore >= 75 ? "var(--green)" : analysis.summary.overallScore >= 50 ? "var(--yellow-check)" : "var(--coral)"}
                          strokeWidth="6"
                          strokeDasharray={`${(analysis.summary.overallScore / 100) * 213.6} 213.6`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: analysis.summary.overallScore >= 75 ? "var(--green)" : analysis.summary.overallScore >= 50 ? "var(--yellow-check)" : "var(--coral)", lineHeight: 1 }}>
                          {analysis.summary.overallScore}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>/100</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--ink)", marginBottom: "4px" }}>
                        Overall Assessment Score
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)", lineHeight: 1.6 }}>
                        Comprehensive facial aesthetics evaluation based on skin health, symmetry, and treatment potential
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div style={{
                display: "flex", gap: "4px",
                background: "var(--cream)", borderRadius: "10px", padding: "4px",
              }}>
                {(["overview", "treatments", "plan"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setReportTab(tab)}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: "8px", border: "none",
                      cursor: "pointer", textTransform: "capitalize",
                      fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 600,
                      background: reportTab === tab ? "white" : "transparent",
                      color: reportTab === tab ? "var(--purple)" : "var(--text-light)",
                      boxShadow: reportTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* ═══ OVERVIEW TAB ═══ */}
              {reportTab === "overview" && (<>

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

              {/* Symmetry Analysis */}
              {analysis.symmetry && (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>&#x1F50D;</span>
                      <span>Facial Symmetry</span>
                    </div>
                    <span className="app-badge" style={{
                      background: (analysis.symmetry.score >= 80 ? "var(--green)" : analysis.symmetry.score >= 60 ? "var(--yellow-check)" : "var(--coral)") + "20",
                      color: analysis.symmetry.score >= 80 ? "var(--green)" : analysis.symmetry.score >= 60 ? "var(--yellow-check)" : "var(--coral)"
                    }}>
                      {analysis.symmetry.score}/100
                    </span>
                  </div>
                  <div className="ai-panel-body">
                    <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                      <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "var(--cream)", borderRadius: "10px" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: analysis.symmetry.leftRightDeviation <= 5 ? "var(--green)" : "var(--coral)" }}>
                          {analysis.symmetry.leftRightDeviation}%
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
                          L/R Deviation
                        </div>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" }}>
                        {(["upper", "middle", "lower"] as const).map((third) => (
                          <div key={third} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", width: "48px", textTransform: "capitalize" }}>
                              {third}
                            </span>
                            <div style={{ flex: 1, height: "5px", borderRadius: "3px", background: "#eee" }}>
                              <div style={{ width: `${analysis.symmetry!.thirdRatios[third]}%`, height: "5px", borderRadius: "3px", background: "var(--purple)" }} />
                            </div>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink)", fontWeight: 600, minWidth: "28px", textAlign: "right" }}>
                              {analysis.symmetry!.thirdRatios[third]}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {analysis.symmetry.notes && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)", lineHeight: 1.6 }}>
                        {analysis.symmetry.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Skin Health Radar */}
              {analysis.skinHealth && <FaceSkinRadar skinHealth={analysis.skinHealth} />}

              {/* Aging Assessment */}
              {analysis.agingAssessment && (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>&#x23F3;</span>
                      <span>Aging Assessment</span>
                    </div>
                    <span className="app-badge" style={{
                      background: (analysis.agingAssessment.agingScore >= 8 ? "var(--green)" : analysis.agingAssessment.agingScore >= 5 ? "var(--yellow-check)" : "var(--coral)") + "20",
                      color: analysis.agingAssessment.agingScore >= 8 ? "var(--green)" : analysis.agingAssessment.agingScore >= 5 ? "var(--yellow-check)" : "var(--coral)"
                    }}>
                      {analysis.agingAssessment.agingScore}/10
                    </span>
                  </div>
                  <div className="ai-panel-body">
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)", lineHeight: 1.7, marginBottom: "12px" }}>
                      {analysis.agingAssessment.biologicalVsChronological}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                      {analysis.agingAssessment.keyIndicators.map((ind, i) => (
                        <span key={i} style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px",
                          background: "var(--coral)18", color: "var(--coral)",
                          padding: "3px 10px", borderRadius: "4px",
                        }}>
                          {ind}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                      Earliest Aging Areas
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {analysis.agingAssessment.earliestAgingAreas.map((area, i) => (
                        <span key={i} style={{
                          fontFamily: "var(--font-mono)", fontSize: "10px",
                          background: "var(--purple)18", color: "var(--purple)",
                          padding: "3px 10px", borderRadius: "4px",
                        }}>
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Narrative (in Overview) */}
              {analysis.narrative && (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>&#x1F4DD;</span>
                      <span>Clinical Summary</span>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(analysis.narrative || "")}
                      style={{
                        background: "none", border: "1px solid #e0e0e0", borderRadius: "6px",
                        padding: "4px 10px", cursor: "pointer",
                        fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="ai-panel-body">
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)",
                      lineHeight: 1.8, fontStyle: "italic",
                    }}>
                      {analysis.narrative}
                    </div>
                  </div>
                </div>
              )}

              </>)}

              {/* ═══ TREATMENTS TAB ═══ */}
              {reportTab === "treatments" && (<>

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
                      estimatedCost={area.estimatedCost}
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
                      estimatedCost={area.estimatedCost}
                      active={activeOverlays.has(key)}
                      onToggle={() => toggleOverlay(key)}
                      severityColor={severityColor}
                      confidenceBadge={confidenceBadge}
                    />
                  ))}
                </div>
              </div>

              </>)}

              {/* ═══ PLAN TAB ═══ */}
              {reportTab === "plan" && (<>

              {/* Cost Estimate */}
              {analysis.costEstimate && (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>&#x1F4B0;</span>
                      <span>Estimated Cost</span>
                    </div>
                  </div>
                  <div className="ai-panel-body">
                    <div style={{ textAlign: "center", padding: "16px", background: "var(--cream)", borderRadius: "10px", marginBottom: "12px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--purple)" }}>
                        {analysis.costEstimate.grandTotal}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>
                        Estimated Total Treatment Cost
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #eee", textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600, color: "var(--coral)" }}>
                          {analysis.costEstimate.totalBotoxCost}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase" }}>Botox</div>
                      </div>
                      <div style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #eee", textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600, color: "var(--purple)" }}>
                          {analysis.costEstimate.totalFillerCost}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase" }}>Filler</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Treatment Timeline */}
              {analysis.treatmentTimeline && (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>&#x1F4C5;</span>
                      <span>Treatment Timeline</span>
                    </div>
                  </div>
                  <div className="ai-panel-body">
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                      {analysis.treatmentTimeline.recommendedOrder.map((step, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 12px", borderRadius: "10px", border: "1px solid #eee",
                        }}>
                          <span style={{
                            width: "26px", height: "26px", borderRadius: "50%",
                            background: "var(--purple)", color: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, flexShrink: 0,
                          }}>
                            {step.step}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--ink)" }}>
                              {step.treatment}
                            </div>
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
                            {step.timeframe}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      padding: "10px 14px", borderRadius: "8px",
                      background: "var(--cream)",
                      fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text)", lineHeight: 1.6,
                    }}>
                      <strong>Maintenance:</strong> {analysis.treatmentTimeline.maintenanceSchedule}
                    </div>
                  </div>
                </div>
              )}

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

              </>)}
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

function FaceSkinRadar({ skinHealth }: { skinHealth: SkinHealthScores }) {
  const dimensions: (keyof SkinHealthScores)[] = ["hydration", "elasticity", "texture", "toneEvenness", "radiance", "clarity"];
  const labels: Record<string, string> = {
    hydration: "Hydration", elasticity: "Elasticity", texture: "Texture",
    toneEvenness: "Tone", radiance: "Radiance", clarity: "Clarity",
  };

  const cx = 100, cy = 100, r = 70;
  const angleStep = (2 * Math.PI) / dimensions.length;

  const getPoint = (dim: keyof SkinHealthScores): [number, number] => {
    const i = dimensions.indexOf(dim);
    const angle = i * angleStep - Math.PI / 2;
    const val = (skinHealth[dim] / 10) * r;
    return [cx + val * Math.cos(angle), cy + val * Math.sin(angle)];
  };

  const polygon = dimensions.map((d) => getPoint(d).join(",")).join(" ");
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const avg = Math.round(dimensions.reduce((sum, d) => sum + skinHealth[d], 0) / dimensions.length * 10) / 10;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F31F;</span>
          <span>Skin Health Radar</span>
        </div>
        <span className="app-badge app-badge-purple">avg {avg}/10</span>
      </div>
      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: "260px" }}>
          {gridLevels.map((level) => (
            <polygon key={level}
              points={dimensions.map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const dist = level * r;
                return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`;
              }).join(" ")}
              fill="none" stroke="#e0e0e0" strokeWidth="0.5"
            />
          ))}
          {dimensions.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#e0e0e0" strokeWidth="0.5" />;
          })}
          <polygon points={polygon} fill="rgba(108,99,255,0.15)" stroke="#6C63FF" strokeWidth="1.5" />
          {dimensions.map((dim) => {
            const [px, py] = getPoint(dim);
            return <circle key={dim} cx={px} cy={py} r="3" fill="#6C63FF" />;
          })}
          {dimensions.map((dim, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const lx = cx + (r + 18) * Math.cos(angle);
            const ly = cy + (r + 18) * Math.sin(angle);
            return <text key={dim} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#888" fontFamily="var(--font-mono)">{labels[dim]}</text>;
          })}
        </svg>
        <div style={{ width: "100%", marginTop: "8px" }}>
          {dimensions.map((dim) => (
            <div key={dim} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", flex: 1 }}>{labels[dim]}</span>
              <div style={{ width: "80px", height: "5px", borderRadius: "3px", background: "#eee" }}>
                <div style={{ width: `${skinHealth[dim] * 10}%`, height: "5px", borderRadius: "3px", background: skinHealth[dim] >= 7 ? "var(--green)" : skinHealth[dim] >= 4 ? "var(--yellow-check)" : "var(--coral)" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--purple)", fontWeight: 600, width: "24px", textAlign: "right" }}>{skinHealth[dim]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneCard({
  zoneKey, label, color, type, severity, suggest, confidence, amount, points, notes, estimatedCost, active, onToggle,
  severityColor, confidenceBadge,
}: {
  zoneKey: string; label: string; color: string; type: string;
  severity: string; suggest: boolean; confidence: string; amount: string;
  points: number | string; notes: string; estimatedCost?: string; active: boolean;
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
          <div style={{ display: "flex", gap: "16px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span><strong style={{ color: "var(--ink)" }}>{amount}</strong></span>
            <span><strong style={{ color: "var(--ink)" }}>{points}</strong> point(s)</span>
            {estimatedCost && estimatedCost !== "$0" && (
              <span style={{ color: "var(--green)", fontWeight: 600 }}>{estimatedCost}</span>
            )}
          </div>
          <p>{notes}</p>
        </div>
      )}
    </div>
  );
}
