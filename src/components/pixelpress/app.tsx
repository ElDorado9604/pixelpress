import {
  Download,
  FolderOpen,
  ImageIcon,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  compressImage,
  DEFAULT_SETTINGS,
  EDGE_PRESETS,
  outputName,
  type CompressSettings,
  type CompressResult,
} from "@/lib/compress";
import { cn, downloadBlob, formatBytes, formatDelta, savingsPercent, uid } from "@/lib/utils";
import { zipFiles } from "@/lib/zip-download";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CompareSlider } from "@/components/pixelpress/compare-slider";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif";

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  status: "idle" | "working" | "done" | "error";
  error?: string;
  result?: CompressResult & { url: string };
};

export function PixelpressApp() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompressSettings>(DEFAULT_SETTINGS);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gen = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;
  const itemKey = items.map((i) => i.id).join("|");

  const totals = useMemo(() => {
    const done = items.filter((i) => i.status === "done" && i.result);
    const original = done.reduce((s, i) => s + i.originalSize, 0);
    const compressed = done.reduce((s, i) => s + (i.result?.blob.size ?? 0), 0);
    return { count: done.length, original, compressed, saved: original - compressed };
  }, [items]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name),
    );
    if (incoming.length === 0) {
      toast.error("Drop JPEG, PNG, WebP, GIF, BMP, or AVIF files.");
      return;
    }
    const next: QueueItem[] = incoming.slice(0, 40).map((file) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
      status: "idle",
    }));
    setItems((prev) => [...prev, ...next].slice(0, 40));
    setActiveId((id) => id ?? next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => {
    if (!itemKey) return;
    const token = ++gen.current;
    const timer = window.setTimeout(async () => {
      const snapshot = itemsRef.current;
      for (const item of snapshot) {
        if (token !== gen.current) return;
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: "working", error: undefined } : p)),
        );
        try {
          const result = await compressImage(item.file, settings);
          if (token !== gen.current) return;
          const url = URL.createObjectURL(result.blob);
          setItems((prev) =>
            prev.map((p) => {
              if (p.id !== item.id) return p;
              if (p.result?.url) URL.revokeObjectURL(p.result.url);
              return { ...p, status: "done", result: { ...result, url } };
            }),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not compress this file.";
          setItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: message } : p)),
          );
        }
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      gen.current += 1;
    };
  }, [settings, itemKey]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.result?.url) URL.revokeObjectURL(target.result.url);
      }
      const next = prev.filter((p) => p.id !== id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        return next[0]?.id ?? null;
      });
      return next;
    });
  };

  const clearAll = () => {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    }
    setItems([]);
    setActiveId(null);
  };

  const downloadOne = (item: QueueItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, outputName(item.file.name, item.result.ext));
  };

  const downloadAll = async () => {
    const ready = items.filter((i) => i.result);
    if (ready.length === 0) return;
    if (ready.length === 1 && ready[0]) {
      downloadOne(ready[0]);
      return;
    }
    setZipping(true);
    try {
      const blob = await zipFiles(
        ready.map((i) => ({
          name: outputName(i.file.name, i.result!.ext),
          blob: i.result!.blob,
        })),
      );
      downloadBlob(blob, "pixelpress.zip");
    } catch {
      toast.error("Could not build the zip. Download files one at a time.");
    } finally {
      setZipping(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const qualityPct = Math.round(settings.quality * 100);

  return (
    <div
      className="flex min-h-dvh flex-col bg-bg"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8" />
          <div className="leading-tight">
            <p className="font-display text-lg tracking-[-0.03em] text-fg">Pixelpress</p>
            <p className="text-xs text-subtle">Compress in the browser</p>
          </div>
        </div>
        <Badge variant="accent" className="hidden sm:inline-flex">
          <Lock className="size-3" />
          Files never leave this device
        </Badge>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-8 sm:px-6">
        {items.length === 0 ? (
          <EmptyState dragging={dragging} onPick={() => inputRef.current?.click()} />
        ) : (
          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="flex min-w-0 flex-col gap-4">
              {active?.result ? (
                <CompareSlider
                  beforeSrc={active.previewUrl}
                  afterSrc={active.result.url}
                  beforeAlt={`${active.file.name} original`}
                  afterAlt={`${active.file.name} compressed`}
                />
              ) : (
                <div className="checker flex aspect-[4/3] items-center justify-center rounded-md">
                  {active?.status === "error" ? (
                    <p className="px-6 text-center text-sm text-danger">{active.error}</p>
                  ) : (
                    <LoaderCircle className="size-8 animate-spin text-muted" />
                  )}
                </div>
              )}

              {active && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{active.file.name}</p>
                    <p className="font-mono text-xs tabular-nums text-muted">
                      {formatBytes(active.originalSize)}
                      {active.result ? (
                        active.result.usedOriginal ? (
                          <>
                            {" → "}
                            {formatBytes(active.result.blob.size)}
                            <span className="text-muted"> · already smallest</span>
                          </>
                        ) : (
                          <>
                            {" → "}
                            {formatBytes(active.result.blob.size)}
                            <span
                              className={
                                savingsPercent(active.originalSize, active.result.blob.size) >= 0
                                  ? "text-success"
                                  : "text-danger"
                              }
                            >
                              {" "}
                              · {formatDelta(active.originalSize, active.result.blob.size)}
                            </span>
                          </>
                        )
                      ) : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => downloadOne(active)} disabled={!active.result}>
                      <Download className="size-4" />
                      Download
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeItem(active.id)}
                      aria-label="Remove image"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              <ul className="flex gap-2 overflow-x-auto pb-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        "relative size-16 overflow-hidden rounded-sm shadow-[var(--shadow-border)]",
                        "transition-[box-shadow,transform] duration-150",
                        item.id === active?.id && "ring-2 ring-primary",
                      )}
                    >
                      <img src={item.previewUrl} alt="" className="size-full object-cover" />
                      {item.status === "working" && (
                        <span className="absolute inset-0 grid place-items-center bg-bg/50">
                          <LoaderCircle className="size-4 animate-spin" />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="grid size-16 place-items-center rounded-sm text-muted shadow-[var(--shadow-border)] hover:text-fg"
                    aria-label="Add images"
                  >
                    <FolderOpen className="size-5" />
                  </button>
                </li>
              </ul>
            </section>

            <aside className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] lg:p-5">
              <div>
                <p className="text-xs font-medium tracking-wide text-subtle uppercase">Output</p>
                <div className="mt-2 grid grid-cols-4 gap-1 rounded-md bg-bg p-1">
                  {(["webp", "jpeg", "png", "original"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, format: fmt }))}
                      className={cn(
                        "h-9 rounded-sm text-xs font-medium capitalize",
                        "transition-[background-color,color] duration-150",
                        settings.format === fmt ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {fmt === "jpeg" ? "JPEG" : fmt === "original" ? "Keep" : fmt === "webp" ? "WebP" : "PNG"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-subtle uppercase">Mode</p>
                  <div className="flex rounded-sm bg-bg p-0.5">
                    {(["quality", "target"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, mode }))}
                        className={cn(
                          "h-8 rounded-xs px-2.5 text-xs font-medium capitalize",
                          settings.mode === mode ? "bg-surface-2 text-fg" : "text-muted",
                        )}
                      >
                        {mode === "target" ? "Target size" : "Quality"}
                      </button>
                    ))}
                  </div>
                </div>

                {settings.mode === "quality" ? (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className="text-sm text-fg">Quality</label>
                      <span className="font-mono text-xs tabular-nums text-muted">{qualityPct}%</span>
                    </div>
                    <Slider
                      min={10}
                      max={100}
                      step={1}
                      value={[qualityPct]}
                      onValueChange={([v]) => setSettings((s) => ({ ...s, quality: (v ?? 80) / 100 }))}
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className="text-sm text-fg">Aim for</label>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {formatBytes(settings.targetBytes)}
                      </span>
                    </div>
                    <Slider
                      min={20}
                      max={2000}
                      step={10}
                      value={[Math.round(settings.targetBytes / 1024)]}
                      onValueChange={([v]) =>
                        setSettings((s) => ({ ...s, targetBytes: (v ?? 200) * 1024 }))
                      }
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-subtle uppercase">Longest edge</p>
                <div className="flex flex-wrap gap-1.5">
                  {EDGE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, maxEdge: p.value }))}
                      className={cn(
                        "h-8 rounded-full px-3 text-xs font-medium",
                        "transition-[background-color,color] duration-150",
                        settings.maxEdge === p.value
                          ? "bg-primary text-primary-fg"
                          : "bg-bg text-muted hover:text-fg",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={settings.neverEnlarge}
                  onChange={(e) => setSettings((s) => ({ ...s, neverEnlarge: e.target.checked }))}
                  className="mt-0.5 size-4 accent-primary"
                />
                Skip if compression would make the file larger
              </label>

              <div className="mt-auto space-y-3 border-t border-border pt-4">
                <div>
                  <p className="font-mono text-2xl tabular-nums tracking-tight text-fg">
                    {totals.count ? formatBytes(Math.abs(totals.saved)) : "—"}
                  </p>
                  <p className="text-xs text-subtle">
                    {totals.count
                      ? `${formatDelta(totals.original, totals.compressed)} across ${totals.count} ${totals.count === 1 ? "file" : "files"}`
                      : "Waiting on the first file"}
                  </p>
                </div>
                <Button className="w-full" size="lg" onClick={downloadAll} disabled={totals.count === 0 || zipping}>
                  {zipping ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {items.length > 1 ? "Download all as zip" : "Download"}
                </Button>
                <Button className="w-full" variant="ghost" size="sm" onClick={clearAll}>
                  <X className="size-4" />
                  Clear queue
                </Button>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="px-4 py-5 text-center text-xs text-subtle sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" />
          Encoding happens on your device. Metadata is stripped. Nothing is uploaded.
        </span>
      </footer>

      {dragging && items.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-bg/70">
          <p className="font-display text-3xl tracking-tight text-fg">Drop to add</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function EmptyState({ dragging, onPick }: { dragging: boolean; onPick: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center py-6">
      <div className="rise-in mx-auto max-w-xl text-center">
        <p className="font-display text-4xl tracking-[-0.03em] text-fg sm:text-5xl">
          Smaller files. Same pictures.
        </p>
        <p className="mt-3 text-pretty text-muted">
          Drop photos to compress them to WebP, JPEG, or PNG. Quality and size stay in your control —
          the files never leave this tab.
        </p>
      </div>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "rise-in mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-3",
          "rounded-xl px-6 py-14",
          "shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-200",
          dragging
            ? "bg-surface-2 shadow-[var(--shadow-border-hover)]"
            : "bg-surface hover:shadow-[var(--shadow-border-hover)]",
        )}
        style={{ animationDelay: "80ms" }}
      >
        <span className="grid size-12 place-items-center rounded-full bg-bg text-primary">
          <ImageIcon className="size-6" />
        </span>
        <span className="text-sm font-medium text-fg">Drop images here, or browse</span>
        <span className="text-xs text-subtle">
          JPEG, PNG, WebP, GIF, BMP, AVIF · up to 40 at once · paste also works
        </span>
      </button>
      <ul
        className="rise-in mx-auto mt-10 grid w-full max-w-xl grid-cols-3 gap-3 text-center"
        style={{ animationDelay: "140ms" }}
      >
        {[
          { k: "Private", v: "No server, no account" },
          { k: "Batch", v: "Zip the whole queue" },
          { k: "Exact", v: "Quality or target KB" },
        ].map((x) => (
          <li key={x.k} className="rounded-md bg-surface px-3 py-4 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium text-fg">{x.k}</p>
            <p className="mt-1 text-xs text-subtle">{x.v}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
