"use client";

import { useState } from "react";

interface Props {
  beforePhoto: string;
  afterPhoto: string;
  cachedAnalysis: string | null;
  onAnalysisComplete: (analysis: string) => void;
}

export default function AIAnalysis({
  beforePhoto,
  afterPhoto,
  cachedAnalysis,
  onAnalysisComplete,
}: Props) {
  const [analysis, setAnalysis] = useState<string | null>(cachedAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ba-gemini-key");
    }
    return null;
  });
  const [provider, setProvider] = useState<"gemini" | "openai">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ba-ai-provider") as "gemini" | "openai") || "gemini";
    }
    return "gemini";
  });

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("ba-gemini-key", apiKeyInput.trim());
    localStorage.setItem("ba-ai-provider", provider);
    setApiKey(apiKeyInput.trim());
    setApiKeyInput("");
  };

  const runAnalysis = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforePhoto, afterPhoto, apiKey, provider }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      onAnalysisComplete(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>&#x2728;</span>
          <span>AI Analysis</span>
        </div>
        <span className="app-badge app-badge-purple">
          {provider === "gemini" ? "Gemini" : "OpenAI"}
        </span>
      </div>

      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* API Key setup */}
        {!apiKey && (
          <>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-light)", lineHeight: 1.7 }}>
              Connect an AI API to get intelligent analysis of your before &amp;
              after photos. The AI will analyze lighting consistency, facial
              positioning, and visible changes.
            </p>

            <div className="provider-toggle">
              <button
                onClick={() => setProvider("gemini")}
                className={`provider-btn ${provider === "gemini" ? "active" : ""}`}
              >
                Gemini (Recommended)
              </button>
              <button
                onClick={() => setProvider("openai")}
                className={`provider-btn ${provider === "openai" ? "active" : ""}`}
              >
                OpenAI GPT-4o
              </button>
            </div>

            <input
              type="password"
              placeholder={
                provider === "gemini"
                  ? "Paste your Gemini API key..."
                  : "Paste your OpenAI API key..."
              }
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
              className="app-input"
            />
            <button onClick={saveApiKey} disabled={!apiKeyInput.trim()} className="app-btn-purple" style={{ width: "100%" }}>
              Save &amp; Analyze
            </button>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
              {provider === "gemini"
                ? "Get a free API key at ai.google.dev — 15 requests/min free."
                : "Get a key at platform.openai.com — pay-as-you-go pricing."}
              {" "}Your key is stored locally on this device only.
            </p>
          </>
        )}

        {/* Analysis button (when key is set) */}
        {apiKey && !analysis && (
          <>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="app-btn-purple"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
            >
              {loading ? (
                <>
                  <svg style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing photos...
                </>
              ) : (
                <>
                  <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run AI Analysis
                </>
              )}
            </button>

            <button
              onClick={() => {
                localStorage.removeItem("ba-gemini-key");
                localStorage.removeItem("ba-ai-provider");
                setApiKey(null);
              }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: "12px",
                color: "var(--text-light)", textDecoration: "underline",
                padding: "4px"
              }}
            >
              Change API key
            </button>
          </>
        )}

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

        {/* Analysis results */}
        {analysis && (
          <>
            <div
              className="ai-results-text"
              style={{ whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }}
            />
            <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
              <button onClick={runAnalysis} disabled={loading} className="app-btn-secondary" style={{ flex: 1 }}>
                Re-analyze
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(analysis)}
                className="app-btn-secondary"
                style={{ flex: 1 }}
              >
                Copy to Clipboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatAnalysis(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    .replace(/^- (.*$)/gm, "<div style='padding-left: 12px; padding: 2px 0 2px 12px;'>&#x2022; $1</div>")
    .replace(
      /Score:\s*(\d+)\/10/g,
      (_, score) => {
        const n = parseInt(score);
        const color = n >= 8 ? "var(--green)" : n >= 5 ? "var(--yellow-check)" : "var(--coral)";
        return `<span style="color:${color};font-weight:700;">Score: ${score}/10</span>`;
      }
    );
}
