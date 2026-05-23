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

// Injection point positions as percentages relative to face bounding box
// These are approximate anatomical positions for visualization
const INJECTION_ZONES: Record<string, { label: string; color: string; positions: [number, number][] }> = {
  forehead: {
    label: "Forehead",
    color: "#FF6B6B",
    positions: [
      [0.30, 0.12], [0.40, 0.10], [0.50, 0.09], [0.60, 0.10], [0.70, 0.12],
      [0.35, 0.16], [0.50, 0.15], [0.65, 0.16],
    ],
  },
  glabella: {
    label: "Glabella",
    color: "#FF8C42",
    positions: [
      [0.43, 0.22], [0.50, 0.20], [0.57, 0.22],
      [0.46, 0.25], [0.54, 0.25],
    ],
  },
  crowsFeetLeft: {
    label: "Crow's Feet L",
    color: "#FFD93D",
    positions: [
      [0.18, 0.30], [0.16, 0.34], [0.15, 0.38], [0.17, 0.42],
    ],
  },
  crowsFeetRight: {
    label: "Crow's Feet R",
    color: "#FFD93D",
    positions: [
      [0.82, 0.30], [0.84, 0.34], [0.85, 0.38], [0.83, 0.42],
    ],
  },
  bunnyLines: {
    label: "Bunny Lines",
    color: "#C77DFF",
    positions: [
      [0.44, 0.40], [0.56, 0.40],
    ],
  },
  cheeks: {
    label: "Cheeks",
    color: "#6C63FF",
    positions: [
      [0.22, 0.48], [0.20, 0.54], [0.24, 0.58], [0.27, 0.52],
      [0.78, 0.48], [0.80, 0.54], [0.76, 0.58], [0.73, 0.52],
    ],
  },
  nasolabialFolds: {
    label: "Nasolabial",
    color: "#00B4D8",
    positions: [
      [0.36, 0.58], [0.34, 0.64], [0.33, 0.70],
      [0.64, 0.58], [0.66, 0.64], [0.67, 0.70],
    ],
  },
  lips: {
    label: "Lips",
    color: "#FF006E",
    positions: [
      [0.40, 0.74], [0.45, 0.73], [0.50, 0.72], [0.55, 0.73], [0.60, 0.74],
      [0.43, 0.78], [0.50, 0.79], [0.57, 0.78],
    ],
  },
  jawline: {
    label: "Jawline",
    color: "#06D6A0",
    positions: [
      [0.20, 0.70], [0.18, 0.76], [0.20, 0.82], [0.25, 0.86],
      [0.80, 0.70], [0.82, 0.76], [0.80, 0.82], [0.75, 0.86],
    ],
  },
  temples: {
    label: "Temples",
    color: "#E0AAFF",
    positions: [
      [0.14, 0.22], [0.15, 0.26],
      [0.86, 0.22], [0.85, 0.26],
    ],
  },
  tearTroughs: {
    label: "Tear Troughs",
    color: "#48BFE3",
    positions: [
      [0.34, 0.38], [0.38, 0.40],
      [0.66, 0.38], [0.62, 0.40],
    ],
  },
};

export default function FaceAnalysis() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Stop camera
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setShowCamera(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // Mirror for selfie
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    setPhoto(dataUrl);
    stopCamera();
  };

  // Handle file upload
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

  // Run analysis
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
      // Enable all suggested overlays by default
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

  // Toggle overlay zone
  const toggleOverlay = (zone: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  // Draw injection points on canvas
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo || !analysis) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    activeOverlays.forEach((zone) => {
      const config = INJECTION_ZONES[zone];
      if (!config) return;
      const pts = config.positions;
      // Determine how many points to show based on analysis data
      let numPoints = pts.length;
      const botoxData = (analysis.botox as any)?.[zone];
      const fillerData = (analysis.filler as any)?.[zone];
      if (botoxData?.suggest) {
        numPoints = Math.min(botoxData.points || pts.length, pts.length);
      } else if (fillerData?.suggest) {
        const perSide = fillerData.pointsPerSide || fillerData.points || 0;
        numPoints = Math.min(perSide * 2, pts.length);
        if (fillerData.points) numPoints = Math.min(fillerData.points, pts.length);
      }

      for (let i = 0; i < numPoints; i++) {
        const [px, py] = pts[i];
        const x = px * canvas.width;
        const y = py * canvas.height;

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
    });
  }, [photo, analysis, activeOverlays]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // When photo loads, size canvas to match
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
              {analysis && (
                <span className="app-badge app-badge-green">Analyzed</span>
              )}
            </div>
            <div style={{ position: "relative", background: "#1a1a2e" }}>
              <img
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
                      label={INJECTION_ZONES[key]?.label || key}
                      color={INJECTION_ZONES[key]?.color || "#999"}
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
                      label={INJECTION_ZONES[key]?.label || key}
                      color={INJECTION_ZONES[key]?.color || "#999"}
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

// Helper
function skinScoreColor(score: number): string {
  if (score >= 8) return "var(--green)";
  if (score >= 5) return "var(--yellow-check)";
  return "var(--coral)";
}

// Zone Card sub-component
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
