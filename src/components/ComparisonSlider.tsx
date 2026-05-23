"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  beforeSrc: string;
  afterSrc: string;
}

export default function ComparisonSlider({ beforeSrc, afterSrc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"slider" | "sideBySide" | "overlay">("slider");
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const updatePosition = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    updatePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      updatePosition(clientX);
    };
    const handleUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, updatePosition]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* View mode tabs */}
      <div className="compare-view-tabs">
        {(["slider", "sideBySide", "overlay"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`compare-tab ${viewMode === m ? "active" : ""}`}
          >
            {m === "sideBySide" ? "Side by Side" : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Slider view */}
      {viewMode === "slider" && (
        <div
          ref={containerRef}
          className="comparison-container"
          style={{
            position: "relative", borderRadius: "var(--radius)",
            overflow: "hidden", aspectRatio: "3/4", maxHeight: "70vh",
            border: "3px solid var(--ink)",
            boxShadow: "6px 6px 0 rgba(0,0,0,0.08)",
            background: "var(--ink)", cursor: "ew-resize", userSelect: "none"
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <img
            src={afterSrc}
            alt="After"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: `${sliderPos}%` }}>
            <img
              src={beforeSrc}
              alt="Before"
              style={{
                position: "absolute", inset: 0,
                width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100vw",
                height: "100%", objectFit: "cover",
                maxWidth: "none",
              }}
              draggable={false}
            />
          </div>

          {/* Slider line + handle */}
          <div
            className="comparison-slider-line-app"
            style={{ left: `${sliderPos}%` }}
          />
          <div
            className="comparison-slider-handle-app"
            style={{ left: `${sliderPos}%` }}
          >
            <svg style={{ width: "16px", height: "16px", color: "var(--purple)" }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5l-5 7 5 7V5zm8 0v14l5-7-5-7z" />
            </svg>
          </div>

          {/* Labels */}
          <span className="photo-label photo-label-before">Before</span>
          <span className="photo-label photo-label-after">After</span>
        </div>
      )}

      {/* Side by side view */}
      {viewMode === "sideBySide" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{
            position: "relative", aspectRatio: "3/4",
            borderRadius: "var(--radius)", overflow: "hidden",
            border: "3px solid var(--ink)", boxShadow: "4px 4px 0 rgba(0,0,0,0.06)"
          }}>
            <img src={beforeSrc} alt="Before" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span className="photo-label photo-label-before">Before</span>
          </div>
          <div style={{
            position: "relative", aspectRatio: "3/4",
            borderRadius: "var(--radius)", overflow: "hidden",
            border: "3px solid var(--ink)", boxShadow: "4px 4px 0 rgba(0,0,0,0.06)"
          }}>
            <img src={afterSrc} alt="After" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span className="photo-label photo-label-after">After</span>
          </div>
        </div>
      )}

      {/* Overlay view */}
      {viewMode === "overlay" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{
            position: "relative", aspectRatio: "3/4", maxHeight: "70vh",
            borderRadius: "var(--radius)", overflow: "hidden",
            border: "3px solid var(--ink)", boxShadow: "6px 6px 0 rgba(0,0,0,0.08)"
          }}>
            <img src={beforeSrc} alt="Before" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <img
              src={afterSrc}
              alt="After"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: overlayOpacity / 100 }}
            />
            <div style={{
              position: "absolute", top: "12px", left: "12px",
              fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600,
              background: "rgba(0,0,0,0.6)", color: "white",
              padding: "4px 10px", borderRadius: "6px", zIndex: 10
            }}>
              Overlay: {overlayOpacity}%
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className="overlay-slider"
          />
          <div className="overlay-labels">
            <span>Before</span>
            <span>After</span>
          </div>
        </div>
      )}
    </div>
  );
}
