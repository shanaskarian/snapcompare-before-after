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

  const handlePhotoCapture = (photoDataUrl: string) => {
    if (!currentSession) return;
    const updated = { ...currentSession };
    if (captureMode === "before") {
      updated.beforePhoto = photoDataUrl;
      setCaptureMode("after");
    } else {
      updated.afterPhoto = photoDataUrl;
    }
    setCurrentSession(updated);
    saveSession(updated);
    if (captureMode === "after") setView("compare");
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
    setView("capture");
  };

  return (
    <div className="app-page min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3 text-white no-underline">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">SC</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">SnapCompare</h1>
              <p className="text-xs text-gray-400">Before &amp; After Photo Studio</p>
            </div>
          </a>
        </div>
        {currentSession && (
          <div className="text-right">
            <p className="text-sm font-medium">{currentSession.patientName}</p>
            <p className="text-xs text-gray-400">{new Date(currentSession.createdAt).toLocaleDateString()}</p>
          </div>
        )}
      </header>

      {/* Navigation */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex gap-2 shrink-0">
        <button onClick={() => setView("sessions")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "sessions" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>Sessions</button>
        <button onClick={() => currentSession && setView("capture")} disabled={!currentSession} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "capture" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"} disabled:opacity-30 disabled:cursor-not-allowed`}>Capture</button>
        <button onClick={() => currentSession?.beforePhoto && currentSession?.afterPhoto && setView("compare")} disabled={!currentSession?.beforePhoto || !currentSession?.afterPhoto} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "compare" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"} disabled:opacity-30 disabled:cursor-not-allowed`}>Compare</button>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {view === "sessions" && <SessionManager onNewSession={startNewSession} onLoadSession={loadSession} />}
        {view === "capture" && currentSession && <CameraCapture mode={captureMode} existingBefore={currentSession.beforePhoto} onCapture={handlePhotoCapture} />}
        {view === "compare" && currentSession?.beforePhoto && currentSession?.afterPhoto && (
          <div className="p-4 space-y-6 max-w-4xl mx-auto">
            <ComparisonSlider beforeSrc={currentSession.beforePhoto} afterSrc={currentSession.afterPhoto} />
            <div className="flex gap-3">
              <button onClick={() => retakePhoto("before")} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">Retake Before</button>
              <button onClick={() => retakePhoto("after")} className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">Retake After</button>
            </div>
            <AIAnalysis beforePhoto={currentSession.beforePhoto} afterPhoto={currentSession.afterPhoto} cachedAnalysis={currentSession.aiAnalysis} onAnalysisComplete={(analysis) => { const updated = { ...currentSession, aiAnalysis: analysis }; setCurrentSession(updated); saveSession(updated); }} />
          </div>
        )}
        {view === "capture" && !currentSession && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Active Session</h2>
            <p className="text-gray-400 mb-6">Start a new session to begin capturing photos.</p>
            <button onClick={() => setView("sessions")} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors">Go to Sessions</button>
          </div>
        )}
      </main>
    </div>
  );
}
