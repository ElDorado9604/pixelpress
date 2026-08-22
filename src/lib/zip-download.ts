import JSZip from "jszip";

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name;
    let n = 1;
    while (used.has(name.toLowerCase())) {
      const dot = file.name.lastIndexOf(".");
      const base = dot > 0 ? file.name.slice(0, dot) : file.name;
      const ext = dot > 0 ? file.name.slice(dot) : "";
      name = `${base}-${n}${ext}`;
      n += 1;
    }
    used.add(name.toLowerCase());
    zip.file(name, file.blob);
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
