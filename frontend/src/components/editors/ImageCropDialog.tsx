import { useEffect, useRef, useState } from "react";

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob, name: string) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECTS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
];

const MIN_SIZE = 24;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function ImageCropDialog({ file, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize" | "select"; startX: number; startY: number; orig: Rect } | null>(null);
  const objectUrlRef = useRef("");

  useEffect(() => {
    objectUrlRef.current = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const nw = image.naturalWidth || 1;
      const nh = image.naturalHeight || 1;
      const maxW = Math.min(window.innerWidth * 0.9, 900);
      const maxH = window.innerHeight * 0.52;
      const scale = Math.min(maxW / nw, maxH / nh, 1);
      const dw = Math.round(nw * scale);
      const dh = Math.round(nh * scale);
      setNatural({ w: nw, h: nh });
      setDisplay({ w: dw, h: dh });
      setCrop({ x: 0, y: 0, w: dw, h: dh });
      setImg(image);
    };
    image.src = objectUrlRef.current;
    return () => URL.revokeObjectURL(objectUrlRef.current);
  }, [file]);

  const fitAspect = (box: Rect, a: number | null): Rect => {
    if (!a) return box;
    const maxW = display.w - box.x;
    const maxH = display.h - box.y;
    let w = clamp(box.w, MIN_SIZE, maxW);
    let h = w / a;
    if (h > maxH) {
      h = maxH;
      w = h * a;
    }
    if (w < MIN_SIZE) {
      w = MIN_SIZE;
      h = w / a;
    }
    return { x: box.x, y: box.y, w, h };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const inside =
      px >= crop.x - 6 && px <= crop.x + crop.w + 6 && py >= crop.y - 6 && py <= crop.y + crop.h + 6;
    let mode: "move" | "resize" | "select" = "select";
    if (inside) {
      const onHandle = px >= crop.x + crop.w - 16 && py >= crop.y + crop.h - 16;
      mode = onHandle ? "resize" : "move";
    }
    dragRef.current = { mode, startX: px, startY: py, orig: { ...crop } };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clamp(e.clientX - rect.left, 0, display.w);
    const py = clamp(e.clientY - rect.top, 0, display.h);
    const dx = px - drag.startX;
    const dy = py - drag.startY;
    let next: Rect = { ...drag.orig };
    if (drag.mode === "move") {
      next.x = clamp(drag.orig.x + dx, 0, display.w - drag.orig.w);
      next.y = clamp(drag.orig.y + dy, 0, display.h - drag.orig.h);
    } else if (drag.mode === "resize") {
      const rawW = clamp(drag.orig.w + dx, MIN_SIZE, display.w - drag.orig.x);
      const rawH = clamp(drag.orig.h + dy, MIN_SIZE, display.h - drag.orig.y);
      if (aspect) {
        let w = rawW;
        let h = w / aspect;
        if (h > display.h - drag.orig.y) {
          h = display.h - drag.orig.y;
          w = h * aspect;
        }
        if (w < MIN_SIZE) {
          w = MIN_SIZE;
          h = w / aspect;
        }
        next = { ...drag.orig, w, h };
      } else {
        next = { ...drag.orig, w: rawW, h: rawH };
      }
    } else {
      const x0 = Math.min(drag.orig.x, px);
      const y0 = Math.min(drag.orig.y, py);
      const w0 = Math.abs(px - drag.orig.x);
      const h0 = Math.abs(py - drag.orig.y);
      next = fitAspect({ x: x0, y: y0, w: Math.max(w0, MIN_SIZE), h: Math.max(h0, MIN_SIZE) }, aspect);
      next.x = clamp(next.x, 0, display.w - next.w);
      next.y = clamp(next.y, 0, display.h - next.h);
    }
    setCrop(next);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const applyAspect = (a: number | null) => {
    setAspect(a);
    let w = display.w;
    let h = display.h;
    if (a) {
      if (w / h > a) {
        w = h * a;
      } else {
        h = w / a;
      }
    }
    setCrop({ x: Math.round((display.w - w) / 2), y: Math.round((display.h - h) / 2), w, h });
  };

  const reset = () => {
    setAspect(null);
    setCrop({ x: 0, y: 0, w: display.w, h: display.h });
  };

  const handleApply = () => {
    if (!img || !display.w || !display.h) return;
    setSaving(true);
    const scaleX = natural.w / display.w;
    const scaleY = natural.h / display.h;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sw = crop.w * scaleX;
    const sh = crop.h * scaleY;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(sw));
    canvas.height = Math.max(2, Math.round(sh));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const isJpg = /\.jpe?g$/i.test(file.name);
    const type = isJpg ? "image/jpeg" : "image/png";
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) {
          const name = file.name.replace(/\.[^.]+$/, isJpg ? ".jpg" : ".png");
          onConfirm(blob, name);
        }
      },
      type,
      isJpg ? 0.92 : undefined,
    );
  };

  const cropW = Math.round((crop.w * natural.w) / (display.w || 1));
  const cropH = Math.round((crop.h * natural.h) / (display.h || 1));

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.88)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ background: "var(--bg)", padding: "1rem", maxWidth: "94vw", width: "fit-content" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Crop Image</h3>
          {img ? (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {cropW} × {cropH}px
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading…</span>
          )}
        </div>

        {img ? (
          <>
            <div
              ref={containerRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: "relative", width: display.w, height: display.h,
                cursor: "crosshair", touchAction: "none", userSelect: "none",
                background: "#000", borderRadius: "var(--radius)", overflow: "hidden",
              }}
            >
              <img
                src={objectUrlRef.current}
                alt="Crop preview"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              />
              <div
                style={{
                  position: "absolute", left: crop.x, top: crop.y, width: crop.w, height: crop.h,
                  border: "2px solid var(--accent)", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                  cursor: "move", pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    position: "absolute", right: -6, bottom: -6, width: 14, height: 14,
                    background: "var(--accent)", borderRadius: 3, boxShadow: "0 0 0 2px rgba(255,255,255,0.5)",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.75rem", alignItems: "center" }}>
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  className={aspect === a.value ? "btn-accent" : "btn-secondary"}
                  onClick={() => applyAspect(a.value)}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                >
                  {a.label}
                </button>
              ))}
              <button className="btn-secondary" onClick={reset} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                Reset
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem", flexWrap: "wrap" }}>
              <button className="btn-secondary" onClick={() => onConfirm(file, file.name)} disabled={saving}>
                Use original
              </button>
              <button className="btn-secondary" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
              <button className="btn-accent" onClick={handleApply} disabled={saving}>
                {saving ? "Uploading…" : "Apply & Upload"}
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>Loading image…</p>
        )}
      </div>
    </div>
  );
}
