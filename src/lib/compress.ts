export type OutputFormat = "webp" | "jpeg" | "png";

export type CompressMode = "quality" | "target";

export type CompressSettings = {
  quality: number;
  format: OutputFormat | "original";
  maxEdge: number;
  mode: CompressMode;
  targetBytes: number;
  neverEnlarge: boolean;
};

export type CompressResult = {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  mime: string;
  ext: string;
  usedOriginal: boolean;
};

const MIME: Record<OutputFormat, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

const EXT: Record<OutputFormat, string> = {
  webp: "webp",
  jpeg: "jpg",
  png: "png",
};

const MAX_CANVAS = 8192;

function sniffFormat(file: File): OutputFormat | null {
  const t = file.type.toLowerCase();
  if (t.includes("webp")) return "webp";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpeg";
  if (t.includes("png")) return "png";
  const name = file.name.toLowerCase();
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpeg";
  if (name.endsWith(".png")) return "png";
  return null;
}

export function resolveFormat(file: File, setting: CompressSettings["format"]): OutputFormat {
  if (setting !== "original") return setting;
  return sniffFormat(file) ?? "webp";
}

export function outputName(originalName: string, ext: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode this image."));
        el.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function targetSize(width: number, height: number, maxEdge: number) {
  let w = width;
  let h = height;
  const cap = maxEdge > 0 ? Math.min(maxEdge, MAX_CANVAS) : MAX_CANVAS;
  const longest = Math.max(w, h);
  if (longest > cap) {
    const scale = cap / longest;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  return { width: w, height: h };
}

function drawToCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  flatten: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: !flatten });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (flatten) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Could not encode ${mime}. Try a different format.`));
      },
      mime,
      quality,
    );
  });
}

async function encodeAtQuality(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const mime = MIME[format];
  const q = format === "png" ? undefined : Math.min(1, Math.max(0.08, quality));
  try {
    return await canvasToBlob(canvas, mime, q);
  } catch (err) {
    if (format === "webp") {
      return canvasToBlob(canvas, MIME.jpeg, q);
    }
    throw err;
  }
}

async function encodeToTarget(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  targetBytes: number,
): Promise<Blob> {
  if (format === "png") {
    return encodeAtQuality(canvas, format, 1);
  }
  let lo = 0.08;
  let hi = 0.96;
  let best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const blob = await encodeAtQuality(canvas, format, q);
    if (!best || Math.abs(blob.size - targetBytes) < Math.abs(best.size - targetBytes)) {
      best = blob;
    }
    if (blob.size > targetBytes) hi = q;
    else lo = q;
  }
  return best ?? encodeAtQuality(canvas, format, 0.7);
}

export async function compressImage(file: File, settings: CompressSettings): Promise<CompressResult> {
  const bitmap = await loadBitmap(file);
  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    if (originalWidth < 1 || originalHeight < 1) {
      throw new Error("This image has no readable pixels.");
    }
    const size = targetSize(originalWidth, originalHeight, settings.maxEdge);
    const format = resolveFormat(file, settings.format);
    const flatten = format === "jpeg";
    const canvas = drawToCanvas(bitmap, size.width, size.height, flatten);

    let blob: Blob;
    if (settings.mode === "target" && format !== "png") {
      blob = await encodeToTarget(canvas, format, Math.max(8 * 1024, settings.targetBytes));
    } else {
      blob = await encodeAtQuality(canvas, format, settings.quality);
    }

    let usedOriginal = false;
    if (settings.neverEnlarge && blob.size >= file.size) {
      blob = file;
      usedOriginal = true;
    }

    const actualMime = usedOriginal ? file.type || MIME[format] : blob.type || MIME[format];
    const ext = usedOriginal
      ? (file.name.split(".").pop() || EXT[format]).replace(/jpeg/i, "jpg")
      : actualMime.includes("jpeg")
        ? "jpg"
        : EXT[format];

    return {
      blob,
      width: size.width,
      height: size.height,
      originalWidth,
      originalHeight,
      mime: actualMime,
      ext,
      usedOriginal,
    };
  } finally {
    bitmap.close();
  }
}

export const EDGE_PRESETS = [
  { label: "Original", value: 0 },
  { label: "4K", value: 3840 },
  { label: "1440p", value: 2560 },
  { label: "1080p", value: 1920 },
  { label: "720p", value: 1280 },
  { label: "800px", value: 800 },
] as const;

export const DEFAULT_SETTINGS: CompressSettings = {
  quality: 0.8,
  format: "webp",
  maxEdge: 0,
  mode: "quality",
  targetBytes: 200 * 1024,
  neverEnlarge: true,
};
