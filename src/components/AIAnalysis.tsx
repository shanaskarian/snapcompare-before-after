"use client";

import { useState } from "react";

// ── Type Definitions ──

interface OverallProgress {
  score: number;
  improvementPct: number;
  grade: string;
}

interface PhotoQuality {
  lighting: number;
  angle: number;
  framing: number;
  background: number;
  overall: number;
  notes: string;
}

interface Symmetry {
  score: number;
  leftRightDeviation: number;
  thirdRatios: { upper: number; middle: number; lower: number };
  notes: string;
}

interface SkinScores {
  hydration: number;
  elasticity: number;
  texture: number;
  toneEvenness: number;
  radiance: number;
  clarity: number;
}

interface SkinHealth {
  before: SkinScores;
  after: SkinScores;
}

interface ZoneChange {
  zone: string;
  beforeScore: number;
  afterScore: number;
  improvementPct: number;
  description: string;
  detectedTreatment: string;
  treatmentConfidence: string;
  treatmentEffectiveness: number;
  estimatedCostRange: string;
}

interface CostEstimate {
  totalRange: string;
  totalLow: number;
  totalHigh: number;
  breakdown: Record<string, string>;
}

interface NextStep {
  treatment: string;
  targetZone: string;
  estimatedCost: string;
  priority: string;
  timeframe: string;
}

interface Timeline {
  estimatedTimeSinceTreatment: string;
  recommendedFollowUp: string;
  nextSteps: NextStep[];
}

interface AnalysisReport {
  overallProgress: OverallProgress;
  photoQuality: PhotoQuality;
  symmetry: Symmetry;
  skinHealth: SkinHealth;
  zoneChanges: ZoneChange[];
  costEstimate: CostEstimate;
  timeline: Timeline;
  narrative: string;
  disclaimer: string;
}

interface Props {
  beforePhoto: string;
  afterPhoto: string;
  cachedAnalysis: string | AnalysisReport | null;
  onAnalysisComplete: (analysis: any) => void;
}

// ── Zone colors ──
const ZONE_COLORS: Record<string, string> = {
  "Forehead": "#FF6B6B",
  "Glabella / Brow": "#FF8C42",
  "Periorbital / Eye Area": "#FFD93D",
  "Cheeks / Midface": "#6C63FF",
  "Nasolabial Region": "#00B4D8",
  "Lips": "#FF006E",
  "Jawline / Lower Face": "#06D6A0",
  "Chin": "#C77DFF",
  "Neck": "#48BFE3",
  "Overall Skin Surface": "#E0AAFF",
};

function getZoneColor(zone: string): string {
  return ZONE_COLORS[zone] || Object.values(ZONE_COLORS)[
    Math.abs(zone.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % Object.values(ZONE_COLORS).length
  ];
}

// ── Main Component ──

export default function AIAnalysis({
  beforePhoto,
  afterPhoto,
  cachedAnalysis,
  onAnalysisComplete,
}: Props) {
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(
    cachedAnalysis && typeof cachedAnalysis === "object" ? cachedAnalysis as AnalysisReport : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "zones" | "plan">("overview");

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

  // Loading state
  if (loading) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>&#x2728;</span>
            <span>AI Progress Report</span>
          </div>
          <span className="app-badge app-badge-purple">Gemini</span>
        </div>
        <div className="ai-panel-body" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ marginBottom: "16px" }}>
            <svg style={{ width: "40px", height: "40px", animation: "spin 1.2s linear infinite" }} viewBox="0 0 24 24" fill="none">
              <circle style={{ opacity: 0.15 }} cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="3" />
              <path style={{ opacity: 0.8 }} fill="var(--purple)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--ink)", marginBottom: "6px" }}>
            Analyzing your photos...
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)" }}>
            Comparing symmetry, skin health, zone changes & more
          </div>
        </div>
      </div>
    );
  }

  // Not yet run
  if (!analysis) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>&#x2728;</span>
            <span>AI Progress Report</span>
          </div>
          <span className="app-badge app-badge-purple">Gemini</span>
        </div>
        <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
          <button
            onClick={runAnalysis}
            className="app-btn-purple"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
          >
            <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run AI Progress Report
          </button>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", textAlign: "center", lineHeight: 1.6 }}>
            Comprehensive analysis: symmetry, skin health radar, zone-by-zone changes, cost estimates, treatment timeline & clinical narrative
          </div>
        </div>
      </div>
    );
  }

  // ── Report View ──
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Hero Score Card */}
      <HeroScore progress={analysis.overallProgress} />

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: "4px",
        background: "var(--cream)", borderRadius: "10px", padding: "4px",
      }}>
        {(["overview", "zones", "plan"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "10px 8px",
              borderRadius: "8px", border: "none", cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: "12px",
              fontWeight: activeTab === tab ? 700 : 500,
              letterSpacing: "0.5px", textTransform: "uppercase",
              background: activeTab === tab ? "white" : "transparent",
              color: activeTab === tab ? "var(--purple)" : "var(--text-light)",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s",
            }}
          >
            {tab === "overview" ? "Overview" : tab === "zones" ? "Zones" : "Plan"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <>
          <PhotoQualityCard quality={analysis.photoQuality} />
          <SymmetryCard symmetry={analysis.symmetry} />
          <SkinHealthRadar skinHealth={analysis.skinHealth} />
          <NarrativeCard narrative={analysis.narrative} />
        </>
      )}

      {activeTab === "zones" && (
        <>
          <ZoneChangesCard zones={analysis.zoneChanges} />
          <CostEstimateCard cost={analysis.costEstimate} zones={analysis.zoneChanges} />
        </>
      )}

      {activeTab === "plan" && (
        <>
          <TimelineCard timeline={analysis.timeline} />
          <TopImprovementsCard zones={analysis.zoneChanges} />
        </>
      )}

      {/* Disclaimer */}
      <div style={{
        background: "rgba(108,99,255,0.06)",
        border: "1px solid rgba(108,99,255,0.2)",
        borderRadius: "10px",
        padding: "14px",
        fontFamily: "var(--font-mono)", fontSize: "11px",
        color: "var(--purple)", lineHeight: 1.6, fontStyle: "italic",
      }}>
        {analysis.disclaimer}
      </div>

      {/* Re-analyze + Copy */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button onClick={runAnalysis} disabled={loading} className="app-btn-secondary" style={{ flex: 1 }}>
          Re-analyze
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(analysis.narrative || "")}
          className="app-btn-secondary"
          style={{ flex: 1 }}
        >
          Copy Summary
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════

function HeroScore({ progress }: { progress: OverallProgress }) {
  const scoreColor = progress.score >= 75 ? "var(--green)" : progress.score >= 50 ? "var(--yellow-check)" : "var(--coral)";

  return (
    <div className="ai-panel" style={{ overflow: "hidden" }}>
      <div style={{
        background: `linear-gradient(135deg, ${scoreColor}15, ${scoreColor}05)`,
        padding: "24px 20px",
        display: "flex", alignItems: "center", gap: "20px",
      }}>
        {/* Score circle */}
        <div style={{ position: "relative", width: "80px", height: "80px", flexShrink: 0 }}>
          <svg viewBox="0 0 80 80" style={{ width: "80px", height: "80px", transform: "rotate(-90deg)" }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="#eee" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={scoreColor} strokeWidth="6"
              strokeDasharray={`${(progress.score / 100) * 213.6} 213.6`}
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {progress.score}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
              /100
            </span>
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--ink)", marginBottom: "4px" }}>
            Overall Progress
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: scoreColor,
            }}>
              +{progress.improvementPct}% improvement
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
              background: scoreColor + "20", color: scoreColor,
              padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase",
            }}>
              {progress.grade}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ width: "100%", height: "6px", borderRadius: "3px", background: "#eee" }}>
            <div style={{
              width: `${progress.score}%`, height: "6px", borderRadius: "3px",
              background: scoreColor, transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}


function PhotoQualityCard({ quality }: { quality: PhotoQuality }) {
  const metrics = [
    { label: "Lighting", value: quality.lighting },
    { label: "Angle", value: quality.angle },
    { label: "Framing", value: quality.framing },
    { label: "Background", value: quality.background },
  ];

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F4F7;</span>
          <span>Photo Quality</span>
        </div>
        <span className="app-badge app-badge-purple">{quality.overall}/10</span>
      </div>
      <div className="ai-panel-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", marginBottom: "4px" }}>
                  {m.label}
                </div>
                <div style={{ width: "100%", height: "5px", borderRadius: "3px", background: "#eee" }}>
                  <div style={{
                    width: `${m.value * 10}%`, height: "5px", borderRadius: "3px",
                    background: m.value >= 8 ? "var(--green)" : m.value >= 5 ? "var(--yellow-check)" : "var(--coral)",
                  }} />
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600, color: "var(--ink)", minWidth: "20px", textAlign: "right" }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
        {quality.notes && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)", lineHeight: 1.6 }}>
            {quality.notes}
          </div>
        )}
      </div>
    </div>
  );
}


function SymmetryCard({ symmetry }: { symmetry: Symmetry }) {
  const scoreColor = symmetry.score >= 80 ? "var(--green)" : symmetry.score >= 60 ? "var(--yellow-check)" : "var(--coral)";

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F50D;</span>
          <span>Facial Symmetry</span>
        </div>
        <span className="app-badge" style={{ background: scoreColor + "20", color: scoreColor }}>{symmetry.score}/100</span>
      </div>
      <div className="ai-panel-body">
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "var(--cream)", borderRadius: "10px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "20px", color: scoreColor }}>
              {symmetry.leftRightDeviation}%
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
              L/R Deviation
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
            {(["upper", "middle", "lower"] as const).map((third) => (
              <div key={third} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", width: "48px", textTransform: "capitalize" }}>
                  {third}
                </span>
                <div style={{ flex: 1, height: "5px", borderRadius: "3px", background: "#eee" }}>
                  <div style={{
                    width: `${symmetry.thirdRatios[third]}%`, height: "5px", borderRadius: "3px",
                    background: "var(--purple)",
                  }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink)", fontWeight: 600, minWidth: "28px", textAlign: "right" }}>
                  {symmetry.thirdRatios[third]}%
                </span>
              </div>
            ))}
          </div>
        </div>
        {symmetry.notes && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)", lineHeight: 1.6 }}>
            {symmetry.notes}
          </div>
        )}
      </div>
    </div>
  );
}


function SkinHealthRadar({ skinHealth }: { skinHealth: SkinHealth }) {
  const dimensions: (keyof SkinScores)[] = ["hydration", "elasticity", "texture", "toneEvenness", "radiance", "clarity"];
  const labels: Record<string, string> = {
    hydration: "Hydration",
    elasticity: "Elasticity",
    texture: "Texture",
    toneEvenness: "Tone",
    radiance: "Radiance",
    clarity: "Clarity",
  };

  // Radar chart geometry
  const cx = 100, cy = 100, r = 70;
  const angleStep = (2 * Math.PI) / dimensions.length;

  const getPoint = (dim: keyof SkinScores, scores: SkinScores): [number, number] => {
    const i = dimensions.indexOf(dim);
    const angle = i * angleStep - Math.PI / 2;
    const val = (scores[dim] / 10) * r;
    return [cx + val * Math.cos(angle), cy + val * Math.sin(angle)];
  };

  const makePolygon = (scores: SkinScores): string =>
    dimensions.map((d) => getPoint(d, scores).join(",")).join(" ");

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F31F;</span>
          <span>Skin Health Radar</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--coral)" }}>&#x25CF; Before</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--purple)" }}>&#x25CF; After</span>
        </div>
      </div>
      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: "280px" }}>
          {/* Grid lines */}
          {gridLevels.map((level) => (
            <polygon
              key={level}
              points={dimensions.map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const dist = level * r;
                return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`;
              }).join(" ")}
              fill="none" stroke="#e0e0e0" strokeWidth="0.5"
            />
          ))}
          {/* Axis lines */}
          {dimensions.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            return (
              <line key={i}
                x1={cx} y1={cy}
                x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
                stroke="#e0e0e0" strokeWidth="0.5"
              />
            );
          })}
          {/* Before polygon */}
          <polygon
            points={makePolygon(skinHealth.before)}
            fill="rgba(255,107,107,0.12)" stroke="#FF6B6B" strokeWidth="1.5"
          />
          {/* After polygon */}
          <polygon
            points={makePolygon(skinHealth.after)}
            fill="rgba(108,99,255,0.12)" stroke="#6C63FF" strokeWidth="1.5"
          />
          {/* Labels */}
          {dimensions.map((dim, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const lx = cx + (r + 18) * Math.cos(angle);
            const ly = cy + (r + 18) * Math.sin(angle);
            return (
              <text key={dim} x={lx} y={ly}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fill="#888" fontFamily="var(--font-mono)"
              >
                {labels[dim]}
              </text>
            );
          })}
          {/* Data points — after */}
          {dimensions.map((dim) => {
            const [px, py] = getPoint(dim, skinHealth.after);
            return <circle key={dim} cx={px} cy={py} r="3" fill="#6C63FF" />;
          })}
        </svg>

        {/* Score comparison table */}
        <div style={{ width: "100%", marginTop: "12px" }}>
          {dimensions.map((dim) => {
            const diff = skinHealth.after[dim] - skinHealth.before[dim];
            return (
              <div key={dim} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 0", borderBottom: "1px solid #f0f0f0",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)", flex: 1 }}>
                  {labels[dim]}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--coral)", width: "24px", textAlign: "center" }}>
                  {skinHealth.before[dim]}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)" }}>&#x2192;</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--purple)", width: "24px", textAlign: "center", fontWeight: 600 }}>
                  {skinHealth.after[dim]}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
                  color: diff > 0 ? "var(--green)" : diff < 0 ? "var(--coral)" : "var(--text-light)",
                  width: "32px", textAlign: "right",
                }}>
                  {diff > 0 ? `+${diff}` : diff === 0 ? "—" : diff}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function ZoneChangesCard({ zones }: { zones: ZoneChange[] }) {
  const sorted = [...zones].sort((a, b) => b.improvementPct - a.improvementPct);
  const maxDelta = Math.max(...sorted.map(z => Math.abs(z.improvementPct)), 1);

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F4CA;</span>
          <span>Zone-by-Zone Changes</span>
        </div>
      </div>
      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {sorted.map((zone, i) => {
          const color = getZoneColor(zone.zone);
          const barWidth = Math.max((Math.abs(zone.improvementPct) / maxDelta) * 100, 4);
          return (
            <ZoneRow
              key={i}
              zone={zone}
              color={color}
              barWidth={barWidth}
            />
          );
        })}
      </div>
    </div>
  );
}

function ZoneRow({ zone, color, barWidth }: { zone: ZoneChange; color: string; barWidth: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #f0f0f0" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 0", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink)", flex: "0 0 120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {zone.zone}
        </span>
        <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "#eee" }}>
          <div style={{
            width: `${barWidth}%`, height: "6px", borderRadius: "3px",
            background: color, transition: "width 0.3s ease",
          }} />
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
          color: zone.improvementPct > 0 ? "var(--green)" : zone.improvementPct < 0 ? "var(--coral)" : "var(--text-light)",
          minWidth: "40px", textAlign: "right",
        }}>
          {zone.improvementPct > 0 ? "+" : ""}{zone.improvementPct}%
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          &#x25BE;
        </span>
      </div>
      {expanded && (
        <div style={{ padding: "0 0 12px 18px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text)", lineHeight: 1.6 }}>
            {zone.description}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <MiniTag label={`Before: ${zone.beforeScore}/10`} color="var(--coral)" />
            <MiniTag label={`After: ${zone.afterScore}/10`} color="var(--purple)" />
            {zone.detectedTreatment && zone.detectedTreatment !== "None" && (
              <MiniTag label={zone.detectedTreatment} color={color} />
            )}
            {zone.treatmentConfidence && (
              <MiniTag label={`${zone.treatmentConfidence} confidence`} color="var(--text-light)" />
            )}
            {zone.estimatedCostRange && zone.estimatedCostRange !== "$0" && (
              <MiniTag label={zone.estimatedCostRange} color="var(--green)" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
      background: color + "18", color: color,
      padding: "2px 8px", borderRadius: "4px",
    }}>
      {label}
    </span>
  );
}


function CostEstimateCard({ cost, zones }: { cost: CostEstimate; zones: ZoneChange[] }) {
  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F4B0;</span>
          <span>Estimated Cost</span>
        </div>
      </div>
      <div className="ai-panel-body">
        <div style={{
          textAlign: "center", padding: "16px", background: "var(--cream)", borderRadius: "10px",
          marginBottom: "12px",
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", color: "var(--purple)" }}>
            {cost.totalRange}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>
            Estimated Total Treatment Cost
          </div>
        </div>
        {/* Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Object.entries(cost.breakdown).map(([key, value]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-light)", textTransform: "capitalize" }}>
                {key}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink)", fontWeight: 600 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
        {/* Per-zone costs for zones with cost */}
        <div style={{ marginTop: "12px", borderTop: "1px solid #f0f0f0", paddingTop: "12px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            Per-Zone Breakdown
          </div>
          {zones.filter(z => z.estimatedCostRange && z.estimatedCostRange !== "$0").map((z, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: getZoneColor(z.zone) }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text)" }}>{z.zone}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink)", fontWeight: 600 }}>
                {z.estimatedCostRange}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function TimelineCard({ timeline }: { timeline: Timeline }) {
  const priorityColor = (p: string) => {
    if (p === "high") return "var(--coral)";
    if (p === "medium") return "var(--yellow-check)";
    return "var(--green)";
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F4C5;</span>
          <span>Treatment Timeline</span>
        </div>
      </div>
      <div className="ai-panel-body">
        {/* Time since treatment */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: 1, padding: "12px", background: "var(--cream)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--purple)" }}>
              {timeline.estimatedTimeSinceTreatment}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
              Since Treatment
            </div>
          </div>
          <div style={{ flex: 1, padding: "12px", background: "var(--cream)", borderRadius: "10px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", color: "var(--green)" }}>
              {timeline.recommendedFollowUp}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px" }}>
              Follow-Up
            </div>
          </div>
        </div>

        {/* Next steps */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--purple)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
          Recommended Next Steps
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {timeline.nextSteps.map((step, i) => (
            <div key={i} style={{
              padding: "12px", borderRadius: "10px",
              border: "2px solid #eee", display: "flex", flexDirection: "column", gap: "6px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "22px", height: "22px", borderRadius: "50%",
                    background: "var(--purple)", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", color: "var(--ink)" }}>
                    {step.treatment}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600,
                  background: priorityColor(step.priority) + "20",
                  color: priorityColor(step.priority),
                  padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase",
                }}>
                  {step.priority}
                </span>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
                  &#x1F3AF; {step.targetZone}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)", fontWeight: 600 }}>
                  {step.estimatedCost}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-light)" }}>
                  &#x23F0; {step.timeframe}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function TopImprovementsCard({ zones }: { zones: ZoneChange[] }) {
  const top = [...zones]
    .filter(z => z.improvementPct > 0)
    .sort((a, b) => b.improvementPct - a.improvementPct)
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F3C6;</span>
          <span>Top Improvements</span>
        </div>
      </div>
      <div className="ai-panel-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {top.map((zone, i) => {
          const color = getZoneColor(zone.zone);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 12px", borderRadius: "10px",
              background: i === 0 ? color + "10" : "transparent",
              border: i === 0 ? `2px solid ${color}30` : "none",
            }}>
              <span style={{
                width: "26px", height: "26px", borderRadius: "50%",
                background: i === 0 ? color : i === 1 ? "var(--purple)" : "var(--text-light)",
                color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--ink)" }}>
                  {zone.zone}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)" }}>
                  {zone.detectedTreatment} — {zone.estimatedCostRange}
                </div>
              </div>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color: "var(--green)",
              }}>
                +{zone.improvementPct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function NarrativeCard({ narrative }: { narrative: string }) {
  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>&#x1F4DD;</span>
          <span>Clinical Summary</span>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(narrative)}
          style={{
            background: "none", border: "1px solid #e0e0e0", borderRadius: "6px",
            padding: "4px 10px", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-light)",
          }}
        >
          Copy
        </button>
      </div>
      <div className="ai-panel-body">
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text)",
          lineHeight: 1.8, fontStyle: "italic",
        }}>
          {narrative}
        </div>
      </div>
    </div>
  );
}
