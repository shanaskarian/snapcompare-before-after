"use client";

import { useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import ComparisonSlider from "@/components/ComparisonSlider";
import SessionManager, { type PhotoSession } from "@/components/SessionManager";
import AIAnalysis from "@/components/AIAnalysis";

type AppView = "capture" | "compare" | "sessions";

export default function AppPage() {
  const [view, setView] = useState<AppView>("sessions");
  const [currentSession, setCurrentSession] = useState<PhotoSession | null>(null);
  const [captureMode, setCaptureMode] = useState<"before" | "after">("before");
  const [isRetaking, setIsRetaking] = useState(false);

  const handlePhotoCapture = (photoDataUrl: string) => {
    if (!currentSession) return;
    const updated = { ...currentSession };
    if (captureMode === "before") {
      updated.beforePhoto = photoDataUrl;
    } else {
      updated.afterPhoto = photoDataUrl;
    }
    setCurrentSession(updated);
    saveSession(updated);

    if (isRetaking) {
      // Return to compare view after retaking a single photo
      setIsRetaking(false);
      setView("compare");
    } else if (captureMode === "before") {
      // Normal flow: advance to after capture
      setCaptureMode("after");
    } else {
      // Normal flow: both photos done, go to compare
      setView("compare");
    }
  };

  const saveSession = (session: PhotoSession) => {
    const sessions = JSON.parse(localStorage.getItem("ba-sessions") || "[]") as PhotoSession[];
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) sessions[idx] = session;
    else sessions.unshift(session);
    localStorage.setItem("ba-sessions", JSON.stringify(sessions));
  };

  const startNewSession = (patientName: string) => {
    const session: PhotoSession = {
      id: Date.now().toString(),
      patientName,
      createdAt: new Date().toISOString(),
      beforePhoto: null,
      afterPhoto: null,
      aiAnalysis: null,
    };
    setCurrentSession(session);
    setCaptureMode("before");
    setView("capture");
    saveSession(session);
  };

  const loadSession = (session: PhotoSession) => {
    setCurrentSession(session);
    if (session.beforePhoto && session.afterPhoto) setView("compare");
    else if (session.beforePhoto) { setCaptureMode("after"); setView("capture"); }
    else { setCaptureMode("before"); setView("capture"); }
  };

  const retakePhoto = (mode: "before" | "after") => {
    setCaptureMode(mode);
    setIsRetaking(true);
    setView("capture");
  };

  return (
    <div className="app-page min-h-screen flex flex-col">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div className="app-logo-icon">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="10" fill="#1a1a2e" />
                <circle cx="15" cy="16" r="4" fill="#6C63FF" opacity="0.8" />
                <circle cx="25" cy="16" r="4" fill="#FF6B6B" opacity="0.8" />
                <path d="M12 28 Q20 32 28 28" stroke="#FFF" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div>
              <div className="app-logo-text">SnapCompare</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "1px" }}>PHOTO STUDIO</div>
            </div>
          </a>
          {currentSession && (
            <div className="app-patient-info">
              <div className="app-patient-name">{currentSession.patientName}</div>
              <div className="app-patient-date">{new Date(currentSession.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </header>

      {/* Navigation */}
      <div style={{ background: "var(--cream)", borderBottom: "2px solid var(--ink)" }}>
        <nav className="app-nav">
          <button
            onClick={() => setView("sessions")}
            className={`app-nav-btn ${view === "sessions" ? "active" : ""}`}
          >
            Sessions
          </button>
          <button
            onClick={() => currentSession && setView("capture")}
            disabled={!currentSession}
            className={`app-nav-btn ${view === "capture" ? "active" : ""}`}
          >
            Capture
          </button>
          <button
            onClick={() => currentSession?.beforePhoto && currentSession?.afterPhoto && setView("compare")}
            disabled={!currentSession?.beforePhoto || !currentSession?.afterPhoto}
            className={`app-nav-btn ${view === "compare" ? "active" : ""}`}
          >
            Compare
          </button>
        </nav>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {view === "sessions" && <SessionManager onNewSession={startNewSession} onLoadSession={loadSession} />}
        {view === "capture" && currentSession && <CameraCapture mode={captureMode} existingBefore={currentSession.beforePhoto} onCapture={handlePhotoCapture} />}
        {view === "compare" && currentSession?.beforePhoto && currentSession?.afterPhoto && (
          <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <ComparisonSlider beforeSrc={currentSession.beforePhoto} afterSrc={currentSession.afterPhoto} />
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => retakePhoto("before")} className="app-btn-secondary" style={{ flex: 1 }}>
                  Retake Before
                </button>
                <button onClick={() => retakePhoto("after")} className="app-btn-secondary" style={{ flex: 1 }}>
                  Retake After
                </button>
              </div>
              <AIAnalysis beforePhoto={currentSession.beforePhoto} afterPhoto={currentSession.afterPhoto} cachedAnalysis={currentSession.aiAnalysis} onAnalysisComplete={(analysis) => { const updated = { ...currentSession, aiAnalysis: analysis }; setCurrentSession(updated); saveSession(updated); }} />
            </div>
          </div>
        )}
        {view === "capture" && !currentSession && (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="empty-state-title">No Active Session</h2>
            <p className="empty-state-desc" style={{ marginBottom: "24px" }}>Start a new session to begin capturing photos.</p>
            <button onClick={() => setView("sessions")} className="app-btn-primary">
              Go to Sessions
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
