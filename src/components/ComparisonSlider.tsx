"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  beforeSrc: string;
  afterSrc: string;
}

export default function ComparisonSlider({ beforeSrc, afterSrc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50); // percentage
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
    <div className="space-y-3">
      {/* View mode tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
        {(["slider", "sideBySide", "overlay"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === m
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {m === "sideBySide" ? "Side by Side" : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Slider view */}
      {viewMode === "slider" && (
        <div
          ref={containerRef}
          className="comparison-container relative rounded-xl overflow-hidden aspect-[3/4] max-h-[70vh] bg-gray-900"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* After image (full width behind) */}
          <img
            src={afterSrc}
            alt="After"
            className="absolute inset-0 w-full h-full object-cover select-none"
            draggable={false}
          />

          {/* Before image (clipped by slider) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={beforeSrc}
              alt="Before"
              className="absolute inset-0 w-full h-full object-cover select-none"
              style={{
                width: containerRef.current
                  ? `${containerRef.current.offsetWidth}px`
                  : "100vw",
                maxWidth: "none",
              }}
              draggable={false}
            />
          </div>

          {/* Slider line + handle */}
          <div
            className="comparison-slider-line"
            style={{ left: `${sliderPos}%` }}
          />
          <div
            className="comparison-slider-handle"
            style={{ left: `${sliderPos}%` }}
          >
            <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5l-5 7 5 7V5zm8 0v14l5-7-5-7z" />
            </svg>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 bg-blue-600/80 px-2 py-1 rounded text-xs font-semibold z-20">
            Before
          </div>
          <div className="absolute top-3 right-3 bg-emerald-600/80 px-2 py-1 rounded text-xs font-semibold z-20">
            After
          </div>
        </div>
      )}

      {/* Side by side view */}
      {viewMode === "sideBySide" && (
        <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
          <div className="relative aspect-[3/4] bg-gray-900">
            <img src={beforeSrc} alt="Before" className="w-full h-full object-cover" />
            <span className="absolute top-2 left-2 bg-blue-600/80 px-2 py-1 rounded text-xs font-semibold">
              Before
            </span>
          </div>
          <div className="relative aspect-[3/4] bg-gray-900">
            <img src={afterSrc} alt="After" className="w-full h-full object-cover" />
            <span className="absolute top-2 right-2 bg-emerald-600/80 px-2 py-1 rounded text-xs font-semibold">
              After
            </span>
          </div>
        </div>
      )}

      {/* Overlay view */}
      {viewMode === "overlay" && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden aspect-[3/4] max-h-[70vh] bg-gray-900">
            <img src={beforeSrc} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
            <img
              src={afterSrc}
              alt="After"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: overlayOpacity / 100 }}
            />
            <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-xs font-semibold z-10">
              Overlay: {overlayOpacity}%
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Before</span>
            <span>After</span>
          </div>
        </div>
      )}
    </div>
  );
}
