import { memo } from "react";
import { GUTTER_W, RULER_H, THEME } from "./constants";
import { majorStepFor, rulerLabel } from "./utils";

interface Props {
  width: number;
  pxPerSec: number;
  duration: number;
  markers: number[];
  ticksRef?: React.RefObject<HTMLDivElement | null>;
  onScrubStart: () => void;
  onScrubMove: (clientX: number) => void;
  onMarkerToggle: (time: number) => void;
}

function RulerInner({
  width,
  pxPerSec,
  duration,
  markers,
  ticksRef,
  onScrubStart,
  onScrubMove,
  onMarkerToggle,
}: Props) {
  const step = majorStepFor(pxPerSec);
  const minorCount = step >= 1 ? 4 : 5;
  const minor = step / minorCount;
  const total = Math.ceil((duration + 4) / minor);
  const ticks: { x: number; major: boolean; sec: number }[] = [];
  for (let i = 0; i <= total; i++) {
    const sec = i * minor;
    const x = sec * pxPerSec;
    if (x > width + 60) break;
    ticks.push({ x, major: i % minorCount === 0, sec });
  }

  const beginScrub = (e: React.PointerEvent) => {
    e.preventDefault();
    onScrubStart();
    onScrubMove(e.clientX);
    const move = (ev: PointerEvent) => onScrubMove(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 13,
        display: "flex",
        height: RULER_H,
        background: THEME.bg,
        borderBottom: `1px solid ${THEME.separator}`,
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "sticky",
          left: 0,
          zIndex: 52,
          width: GUTTER_W,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          background: THEME.bg,
          borderRight: `1px solid ${THEME.separator}`,
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke={THEME.muted}
          strokeWidth="2.4"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "#6f6f7a",
            fontFamily:
              "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          TIMELINE
        </span>
      </div>
      <div
        ref={ticksRef}
        style={{
          position: "relative",
          width,
          flexShrink: 0,
          overflow: "hidden",
          cursor: "ew-resize",
          touchAction: "none",
        }}
        onPointerDown={beginScrub}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const t = Math.max(0, (e.clientX - rect.left) / pxPerSec);
          onMarkerToggle(Math.round(t * 100) / 100);
        }}
      >
        {ticks.map((tk, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: tk.x,
              bottom: 0,
              top: tk.major ? 17 : 25,
              width: 1,
              background: tk.major ? "#474751" : "#36363f",
              pointerEvents: "none",
            }}
          >
            {tk.major && (
              <span
                style={{
                  position: "absolute",
                  top: -18,
                  left: 4,
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: THEME.muted,
                  whiteSpace: "nowrap",
                  fontFamily:
                    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {rulerLabel(tk.sec, step)}
              </span>
            )}
          </div>
        ))}
        {markers.map((m, i) => (
          <div
            key={`mk${i}`}
            title="Marker — double-click nearby to remove"
            style={{
              position: "absolute",
              left: m * pxPerSec - 4,
              top: 4,
              width: 8,
              height: 8,
              transform: "rotate(45deg)",
              background: "#ffb84d",
              borderRadius: 1,
              boxShadow: "0 0 6px rgba(255,184,77,0.45)",
              pointerEvents: "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const Ruler = memo(RulerInner);
