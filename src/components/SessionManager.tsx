"use client";

import { useState, useEffect } from "react";
export interface PhotoSession {
  id: string;
  patientName: string;
  createdAt: string;
  beforePhoto: string | null;
  afterPhoto: string | null;
  aiAnalysis: string | null;
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

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* New session button */}
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Patient Session
        </button>
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <input
            type="text"
            placeholder="Patient name or ID..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-indigo-500 focus:outline-none text-white placeholder-gray-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewForm(false)}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              Start Session
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>No sessions yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((session) => {
          const status = getStatus(session);
          return (
            <div
              key={session.id}
              className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  {session.beforePhoto ? (
                    <img
                      src={session.beforePhoto}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}

                  <div>
                    <h3 className="font-medium">{session.patientName}</h3>
                    <p className="text-xs text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString()} &middot;{" "}
                      <span
                        className={
                          status === "complete"
                            ? "text-green-400"
                            : "text-yellow-400"
                        }
                      >
                        {status === "complete"
                          ? "Complete"
                          : status === "needs-after"
                          ? "Needs after photo"
                          : "Needs photos"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoadSession(session)}
                    className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
