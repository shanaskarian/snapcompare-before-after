"use client";

import { useState, useEffect } from "react";
export interface PhotoSession {
  id: string;
  patientName: string;
  createdAt: string;
  beforePhoto: string | null;
  afterPhoto: string | null;
  aiAnalysis: any | null;
  beforeLandmarks: import("./CameraCapture").FaceNodes | null;
}

interface Props {
  onNewSession: (patientName: string) => void;
  onLoadSession: (session: PhotoSession) => void;
}

export default function SessionManager({ onNewSession, onLoadSession }: Props) {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem("ba-sessions") || "[]"
    ) as PhotoSession[];
    setSessions(stored);
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onNewSession(newName.trim());
    setNewName("");
    setShowNewForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    localStorage.setItem("ba-sessions", JSON.stringify(updated));
  };

  const getStatus = (s: PhotoSession) => {
    if (s.beforePhoto && s.afterPhoto) return "complete";
    if (s.beforePhoto) return "needs-after";
    return "needs-before";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <span className="app-badge app-badge-green">Complete</span>;
      case "needs-after":
        return <span className="app-badge app-badge-yellow">Needs After</span>;
      default:
        return <span className="app-badge app-badge-coral">Needs Photos</span>;
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Section title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <h2 className="app-section-title">Patient Sessions</h2>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* New session button / form */}
        {!showNewForm ? (
          <button onClick={() => setShowNewForm(true)} className="new-session-btn">
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Patient Session
          </button>
        ) : (
          <div className="app-card">
            <div className="app-card-header">
              <span>New Session</span>
              <span style={{ fontSize: "12px", opacity: 0.6, fontFamily: "var(--font-mono)" }}>Enter patient info</span>
            </div>
            <div className="app-card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="text"
                placeholder="Patient name or ID..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
                className="app-input"
              />
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setShowNewForm(false)} className="app-btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()} className="app-btn-primary" style={{ flex: 1 }}>
                  Start Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="empty-state-title">No Sessions Yet</h3>
            <p className="empty-state-desc">Create your first session to get started.</p>
          </div>
        )}

        {/* Session list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sessions.map((session) => {
            const status = getStatus(session);
            return (
              <div key={session.id} className="session-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {/* Thumbnail */}
                    {session.beforePhoto ? (
                      <img
                        src={session.beforePhoto}
                        alt=""
                        style={{
                          width: "52px", height: "52px",
                          borderRadius: "12px", objectFit: "cover",
                          border: "2px solid var(--ink)"
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "52px", height: "52px",
                        borderRadius: "12px",
                        background: "var(--cream-dark)",
                        border: "2px solid var(--ink)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <svg style={{ width: "24px", height: "24px", color: "var(--text-light)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}

                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--ink)", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        {session.patientName}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
                          {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                        {getStatusBadge(status)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => onLoadSession(session)} className="app-btn-secondary" style={{ padding: "8px 20px" }}>
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      style={{
                        padding: "8px",
                        background: "transparent",
                        border: "2px solid transparent",
                        borderRadius: "8px",
                        color: "var(--text-light)",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--coral)"; e.currentTarget.style.borderColor = "var(--coral)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-light)"; e.currentTarget.style.borderColor = "transparent"; }}
                    >
                      <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
