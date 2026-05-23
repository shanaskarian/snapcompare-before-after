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
        body: JSON.stringify({
          beforePhoto,
          afterPhoto,
          apiKey,
          provider,
        }),
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
    <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="font-semibold">AI Analysis</h3>
        </div>
        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
          Powered by {provider === "gemini" ? "Gemini" : "OpenAI"}
        </span>
      </div>

      {/* API Key setup */}
      {!apiKey && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Connect an AI API to get intelligent analysis of your before &amp;
            after photos. The AI will analyze lighting consistency, facial
            positioning, and visible changes.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setProvider("gemini")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                provider === "gemini"
                  ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              Gemini (Recommended)
            </button>
            <button
              onClick={() => setProvider("openai")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                provider === "openai"
                  ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-indigo-500 focus:outline-none text-white placeholder-gray-500 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={saveApiKey}
              disabled={!apiKeyInput.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
              Save &amp; Analyze
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {provider === "gemini"
              ? "Get a free API key at ai.google.dev — 15 requests/min free."
              : "Get a key at platform.openai.com — pay-as-you-go pricing."}
            {" "}Your key is stored locally on this device only.
          </p>
        </div>
      )}

      {/* Analysis button (when key is set) */}
      {apiKey && !analysis && (
        <div className="space-y-3">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing photos...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="w-full py-2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Change API key
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
          {error}
          <button
            onClick={runAnalysis}
            className="ml-2 underline hover:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-3">
          <div className="prose prose-sm prose-invert max-w-none">
            <div
              className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Re-analyze
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(analysis);
              }}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAnalysis(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white'>$1</strong>")
    .replace(/^### (.*$)/gm, "<h4 class='text-indigo-300 font-semibold mt-3 mb-1'>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3 class='text-indigo-200 font-bold mt-4 mb-1'>$1</h3>")
    .replace(/^- (.*$)/gm, "<div class='pl-3 py-0.5'>• $1</div>")
    .replace(
      /Score:\s*(\d+)\/10/g,
      (_, score) => {
        const n = parseInt(score);
        const color = n >= 8 ? "text-green-400" : n >= 5 ? "text-yellow-400" : "text-red-400";
        return `<span class="${color} font-bold">Score: ${score}/10</span>`;
      }
    );
}
