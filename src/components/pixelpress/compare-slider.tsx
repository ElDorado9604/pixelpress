import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CompareSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

export function CompareSlider({ beforeSrc, afterSrc, beforeAlt, afterAlt }: CompareSliderProps) {
  const [pos, setPos] = useState(52);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frame.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, next)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={frame}
      className={cn(
        "checker relative isolate overflow-hidden rounded-md",
        "aspect-[4/3] w-full select-none touch-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="Compare original and compressed"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
      }}
    >
      <img
        src={afterSrc}
        alt={afterAlt}
        draggable={false}
        className="absolute inset-0 size-full object-contain outline outline-1 -outline-offset-1 outline-fg/10"
      />
      <img
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        className="absolute inset-0 size-full object-contain outline outline-1 -outline-offset-1 outline-fg/10"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="absolute inset-y-0 z-10 w-px bg-fg/80" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-fg text-bg shadow-md">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M5 3 2 7l3 4M9 3l3 4-3 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <span className="absolute bottom-3 left-3 rounded-full bg-bg/70 px-2.5 py-1 text-xs font-medium tracking-wide text-fg backdrop-blur-sm">
        Original
      </span>
      <span className="absolute right-3 bottom-3 rounded-full bg-bg/70 px-2.5 py-1 text-xs font-medium tracking-wide text-fg backdrop-blur-sm">
        Compressed
      </span>
    </div>
  );
}
