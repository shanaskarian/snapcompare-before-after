"use client";

import { useState } from "react";
import CameraCapture, { type FaceNodes } from "@/components/CameraCapture";
import ComparisonSlider from "@/components/ComparisonSlider";
import SessionManager, {
  ClientProfileView,
  type ClientProfile,
  type TreatmentSession,
  createTreatmentSession,
} from "@/components/SessionManager";
import AIAnalysis from "@/components/AIAnalysis";
import FaceAnalysis from "@/components/FaceAnalysis";

type AppView = "clients" | "profile" | "capture" | "compare" | "analyze";

export default function AppPage() {
  const [view, setView] = useState<AppView>("clients");
  const [currentClient, setCurrentClient] = useState<ClientProfile | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"before" | "after">("before");

  // ── Persistence ──

  const saveClient = (client: ClientProfile) => {
    const clients = JSON.parse(localStorage.getItem("ba-clients") || "[]") as ClientProfile[];
    const idx = clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) clients[idx] = client;
    else clients.unshift(client);
    localStorage.setItem("ba-clients", JSON.stringify(clients));
  };

  // ── Active session helper ──

  const getActiveSession = (): TreatmentSession | null => {
    if (!currentClient || !activeSessionId) return null;
    return currentClient.sessions.find((s) => s.id === activeSessionId) || null;
  };

  const updateSession = (sessionId: string, updater: (s: TreatmentSession) => TreatmentSession) => {
    if (!currentClient) return;
    const updated = {
      ...currentClient,
      sessions: currentClient.sessions.map((s) => s.id === sessionId ? updater(s) : s),
    };
    setCurrentClient(updated);
    saveClient(updated);
  };

  // ── Handlers ──

  const handleNewClient = (name: string) => {
    const session = createTreatmentSession();
    const client: ClientProfile = {
      id: Date.now().toString(),
      patientName: name,
      createdAt: new Date().toISOString(),
      sessions: [session],
    };
    setCurrentClient(client);
    setActiveSessionId(session.id);
    setCaptureMode("before");
    setView("capture");
    saveClient(client);
  };

  const handleOpenClient = (client: ClientProfile) => {
    setCurrentClient(client);
    setActiveSessionId(null);
    setView("profile");
  };

  const handleUpdateClient = (client: ClientProfile) => {
    setCurrentClient(client);
    saveClient(client);
  };

  const handleCaptureBeforePhoto = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCaptureMode("before");
    setView("capture");
  };

  const handleCaptureAfterPhoto = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCaptureMode("after");
    setView("capture");
  };

  const handleViewComparison = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("compare");
  };

  const handlePhotoCapture = (photoDataUrl: string, landmarks: FaceNodes | null) => {
    if (!currentClient || !activeSessionId) return;

    updateSession(activeSessionId, (s) => {
      if (captureMode === "before") {
        return {
          ...s,
          beforePhoto: photoDataUrl,
          beforeDate: new Date().toISOString(),
          beforeLandmarks: landmarks,
        };
      } else {
        return {
          ...s,
          afterPhoto: photoDataUrl,
          afterDate: new Date().toISOString(),
        };
      }
    });

    // After capturing, go back to the client profile view
    setView("profile");
  };

  const retakePhoto = (mode: "before" | "after") => {
    setCaptureMode(mode);
    setView("capture");
  };

  const activeSession = getActiveSession();

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
          {currentClient && (
            <div className="app-patient-info">
              <div className="app-patient-name">{currentClient.patientName}</div>
              <div className="app-patient-date">{new Date(currentClient.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </header>

      {/* Navigation */}
      <div style={{ background: "var(--cream)", borderBottom: "2px solid var(--ink)" }}>
        <nav className="app-nav">
          <button
            onClick={() => { setView("clients"); setCurrentClient(null); setActiveSessionId(null); }}
            className={`app-nav-btn ${view === "clients" ? "active" : ""}`}
          >
            Clients
          </button>
          <button
            onClick={() => currentClient && setView("profile")}
            disabled={!currentClient}
            className={`app-nav-btn ${view === "profile" || view === "capture" ? "active" : ""}`}
          >
            Profile
          </button>
          <button
            onClick={() => activeSession?.beforePhoto && activeSession?.afterPhoto && setView("compare")}
            disabled={!activeSession?.beforePhoto || !activeSession?.afterPhoto}
            className={`app-nav-btn ${view === "compare" ? "active" : ""}`}
          >
            Compare
          </button>
          <button
            onClick={() => setView("analyze")}
            className={`app-nav-btn ${view === "analyze" ? "active" : ""}`}
          >
            Face Analysis
          </button>
        </nav>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Client list */}
        {view === "clients" && (
          <SessionManager onNewClient={handleNewClient} onOpenClient={handleOpenClient} />
        )}

        {/* Client profile with treatment sessions */}
        {view === "profile" && currentClient && (
          <ClientProfileView
            client={currentClient}
            onBack={() => { setView("clients"); setCurrentClient(null); }}
            onCaptureBeforePhoto={handleCaptureBeforePhoto}
            onCaptureAfterPhoto={handleCaptureAfterPhoto}
            onViewComparison={handleViewComparison}
            onUpdateClient={handleUpdateClient}
          />
        )}

        {/* Camera capture */}
        {view === "capture" && currentClient && activeSessionId && (
          <CameraCapture
            mode={captureMode}
            existingBefore={activeSession?.beforePhoto || null}
            beforeLandmarks={activeSession?.beforeLandmarks ?? null}
            onCapture={handlePhotoCapture}
          />
        )}

        {/* Comparison + AI analysis */}
        {view === "compare" && activeSession?.beforePhoto && activeSession?.afterPhoto && (
          <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Date stamps */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
                  <span style={{ fontWeight: 600, color: "var(--purple)" }}>Before:</span>{" "}
                  {activeSession.beforeDate ? new Date(activeSession.beforeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
                  <span style={{ fontWeight: 600, color: "var(--green)" }}>After:</span>{" "}
                  {activeSession.afterDate ? new Date(activeSession.afterDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                </div>
              </div>

              <ComparisonSlider beforeSrc={activeSession.beforePhoto} afterSrc={activeSession.afterPhoto} />

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => retakePhoto("before")} className="app-btn-secondary" style={{ flex: 1 }}>
                  Retake Before
                </button>
                <button onClick={() => retakePhoto("after")} className="app-btn-secondary" style={{ flex: 1 }}>
                  Retake After
                </button>
              </div>

              <AIAnalysis
                beforePhoto={activeSession.beforePhoto}
                afterPhoto={activeSession.afterPhoto}
                cachedAnalysis={activeSession.aiAnalysis}
                onAnalysisComplete={(analysis) => {
                  updateSession(activeSessionId!, (s) => ({ ...s, aiAnalysis: analysis }));
                }}
              />
            </div>
          </div>
        )}

        {/* Face Analysis (single photo) */}
        {view === "analyze" && <FaceAnalysis />}

        {/* Capture with no client */}
        {view === "capture" && !currentClient && (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="empty-state-title">No Active Client</h2>
            <p className="empty-state-desc" style={{ marginBottom: "24px" }}>Open a client profile to start capturing photos.</p>
            <button onClick={() => setView("clients")} className="app-btn-primary">
              Go to Clients
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
