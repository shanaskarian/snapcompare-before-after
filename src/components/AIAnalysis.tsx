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

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforePhoto, afterPhoto }),
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
        <span className="app-badge app-badge-purple">Gemini</span>
      </div>

      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Analysis button */}
        {!analysis && (
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
