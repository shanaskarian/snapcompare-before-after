"use client";

import { useState, useEffect } from "react";

// ── Data Model ──

export interface TreatmentSession {
  id: string;
  beforePhoto: string | null;
  beforeDate: string | null;
  afterPhoto: string | null;
  afterDate: string | null;
  aiAnalysis: any | null;
  beforeLandmarks: import("./CameraCapture").FaceNodes | null;
  notes: string;
}

export interface ClientProfile {
  id: string;
  patientName: string;
  createdAt: string;
  sessions: TreatmentSession[];
}

// Legacy type kept for migration
export interface PhotoSession {
  id: string;
  patientName: string;
  createdAt: string;
  beforePhoto: string | null;
  afterPhoto: string | null;
  aiAnalysis: any | null;
  beforeLandmarks: import("./CameraCapture").FaceNodes | null;
}

// ── Helpers ──

export function createTreatmentSession(): TreatmentSession {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    beforePhoto: null,
    beforeDate: null,
    afterPhoto: null,
    afterDate: null,
    aiAnalysis: null,
    beforeLandmarks: null,
    notes: "",
  };
}

export function getSessionStatus(s: TreatmentSession): "needs-before" | "needs-after" | "ready" | "complete" {
  if (!s.beforePhoto) return "needs-before";
  if (!s.afterPhoto) return "needs-after";
  if (!s.aiAnalysis) return "ready";
  return "complete";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "complete":
      return <span className="app-badge app-badge-green">Complete</span>;
    case "ready":
      return <span className="app-badge app-badge-purple">Ready to Analyze</span>;
    case "needs-after":
      return <span className="app-badge app-badge-yellow">Needs After Photo</span>;
    default:
      return <span className="app-badge app-badge-coral">Needs Photos</span>;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function migrateOldSessions(): ClientProfile[] {
  try {
    const old = JSON.parse(localStorage.getItem("ba-sessions") || "[]") as PhotoSession[];
    if (old.length === 0) return [];
    const profiles: ClientProfile[] = old.map((s) => ({
      id: s.id,
      patientName: s.patientName,
      createdAt: s.createdAt,
      sessions: [{
        id: s.id + "-s1",
        beforePhoto: s.beforePhoto,
        beforeDate: s.createdAt,
        afterPhoto: s.afterPhoto,
        afterDate: s.afterPhoto ? s.createdAt : null,
        aiAnalysis: s.aiAnalysis,
        beforeLandmarks: s.beforeLandmarks,
        notes: "",
      }],
    }));
    localStorage.setItem("ba-clients", JSON.stringify(profiles));
    localStorage.removeItem("ba-sessions");
    return profiles;
  } catch { return []; }
}

// ── Main Client List Component ──

interface Props {
  onNewClient: (patientName: string) => void;
  onOpenClient: (client: ClientProfile) => void;
}

export default function SessionManager({ onNewClient, onOpenClient }: Props) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    let stored = JSON.parse(localStorage.getItem("ba-clients") || "[]") as ClientProfile[];
    if (stored.length === 0) {
      stored = migrateOldSessions();
    }
    setClients(stored);
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onNewClient(newName.trim());
    setNewName("");
    setShowNewForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = clients.filter((c) => c.id !== id);
    setClients(updated);
    localStorage.setItem("ba-clients", JSON.stringify(updated));
  };

  const getClientStatus = (c: ClientProfile) => {
    if (c.sessions.length === 0) return "needs-before";
    const latest = c.sessions[c.sessions.length - 1];
    return getSessionStatus(latest);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <h2 className="app-section-title">Client Profiles</h2>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {!showNewForm ? (
          <button onClick={() => setShowNewForm(true)} className="new-session-btn">
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Client
          </button>
        ) : (
          <div className="app-card">
            <div className="app-card-header">
              <span>New Client</span>
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
                  Create Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {clients.length === 0 && (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="empty-state-title">No Clients Yet</h3>
            <p className="empty-state-desc">Create your first client profile to get started.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {clients.map((client) => {
            const status = getClientStatus(client);
            const sessionCount = client.sessions.length;
            const latestSession = client.sessions[client.sessions.length - 1];
            const thumbnail = latestSession?.beforePhoto || null;

            return (
              <div key={client.id} className="session-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {thumbnail ? (
                      <img src={thumbnail} alt=""
                        style={{ width: "52px", height: "52px", borderRadius: "12px", objectFit: "cover", border: "2px solid var(--ink)" }}
                      />
                    ) : (
                      <div style={{
                        width: "52px", height: "52px", borderRadius: "12px",
                        background: "var(--cream-dark)", border: "2px solid var(--ink)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <svg style={{ width: "24px", height: "24px", color: "var(--text-light)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--ink)", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        {client.patientName}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
                          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
                          {new Date(client.createdAt).toLocaleDateString()}
                        </span>
                        {getStatusBadge(status)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => onOpenClient(client)} className="app-btn-secondary" style={{ padding: "8px 20px" }}>
                      Open
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      style={{ padding: "8px", background: "transparent", border: "2px solid transparent", borderRadius: "8px", color: "var(--text-light)", cursor: "pointer", transition: "all 0.15s" }}
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

// ── Client Profile View ──

interface ProfileProps {
  client: ClientProfile;
  onBack: () => void;
  onCaptureBeforePhoto: (sessionId: string) => void;
  onCaptureAfterPhoto: (sessionId: string) => void;
  onViewComparison: (sessionId: string) => void;
  onUpdateClient: (client: ClientProfile) => void;
}

export function ClientProfileView({
  client, onBack, onCaptureBeforePhoto, onCaptureAfterPhoto, onViewComparison, onUpdateClient,
}: ProfileProps) {
  const handleNewSession = () => {
    const session = createTreatmentSession();
    const updated = { ...client, sessions: [...client.sessions, session] };
    onUpdateClient(updated);
    onCaptureBeforePhoto(session.id);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = { ...client, sessions: client.sessions.filter((s) => s.id !== sessionId) };
    onUpdateClient(updated);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <button onClick={onBack} className="app-btn-secondary" style={{ padding: "8px 14px" }}>
            <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="app-section-title" style={{ marginBottom: "2px" }}>{client.patientName}</h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
              Client since {new Date(client.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <button onClick={handleNewSession} className="new-session-btn">
          <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Treatment Session
        </button>

        {client.sessions.length === 0 && (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="empty-state-title">No Sessions Yet</h3>
            <p className="empty-state-desc">Start a new treatment session to capture before photos.</p>
          </div>
        )}

        {client.sessions.map((session, i) => {
          const status = getSessionStatus(session);

          return (
            <div key={session.id} className="session-card" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: "var(--purple)", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--ink)" }}>
                      Session {i + 1}
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  style={{ padding: "6px", background: "transparent", border: "none", color: "var(--text-light)", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--coral)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-light)"; }}
                >
                  <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Photo thumbnails */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-light)", marginBottom: "6px" }}>Before</div>
                  {session.beforePhoto ? (
                    <div style={{ position: "relative" }}>
                      <img src={session.beforePhoto} alt="Before" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "10px", border: "2px solid var(--ink)" }} />
                      <div style={{ position: "absolute", bottom: "6px", left: "6px", right: "6px", background: "rgba(0,0,0,0.65)", borderRadius: "6px", padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "white", textAlign: "center" }}>
                        {formatDate(session.beforeDate)}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => onCaptureBeforePhoto(session.id)}
                      style={{ width: "100%", aspectRatio: "3/4", border: "2px dashed var(--purple)", borderRadius: "10px", background: "var(--cream)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <svg style={{ width: "24px", height: "24px", color: "var(--purple)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--purple)" }}>Take Photo</span>
                    </button>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-light)", marginBottom: "6px" }}>After</div>
                  {session.afterPhoto ? (
                    <div style={{ position: "relative" }}>
                      <img src={session.afterPhoto} alt="After" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "10px", border: "2px solid var(--ink)" }} />
                      <div style={{ position: "absolute", bottom: "6px", left: "6px", right: "6px", background: "rgba(0,0,0,0.65)", borderRadius: "6px", padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "white", textAlign: "center" }}>
                        {formatDate(session.afterDate)}
                      </div>
                    </div>
                  ) : session.beforePhoto ? (
                    <button onClick={() => onCaptureAfterPhoto(session.id)}
                      style={{ width: "100%", aspectRatio: "3/4", border: "2px dashed var(--green)", borderRadius: "10px", background: "var(--cream)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <svg style={{ width: "24px", height: "24px", color: "var(--green)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>Take After Photo</span>
                    </button>
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "3/4", border: "2px dashed #ccc", borderRadius: "10px", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
                      Take before first
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {session.beforePhoto && session.afterPhoto && (
                  <button onClick={() => onViewComparison(session.id)} className="app-btn-primary" style={{ flex: 1, fontSize: "13px", padding: "10px" }}>
                    View Comparison & Analysis
                  </button>
                )}
                {session.beforePhoto && !session.afterPhoto && (
                  <button onClick={() => onCaptureAfterPhoto(session.id)} className="app-btn-primary" style={{ flex: 1, fontSize: "13px", padding: "10px" }}>
                    Take After Photo
                  </button>
                )}
                {!session.beforePhoto && (
                  <button onClick={() => onCaptureBeforePhoto(session.id)} className="app-btn-primary" style={{ flex: 1, fontSize: "13px", padding: "10px" }}>
                    Take Before Photo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
