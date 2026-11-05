import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export type FileError = {
  kind: string;
  message: string;
  suggestion: string;
  path: string;
  code: number | null;
  detail: string;
};
export type Entry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  hidden: boolean;
  size: number | null;
  modified: number | null;
  error: FileError | null;
};
export type Directory = {
  path: string;
  parent: string | null;
  entries: Entry[];
  warnings: FileError[];
};
export type Location = { name: string; path: string; kind: string };
export const fileKinds = {
  all: "Todos los tipos",
  folders: "Carpetas",
  documents: "Documentos",
  images: "Imagenes",
  videos: "Videos",
  audio: "Audio",
  archives: "Comprimidos",
  code: "Codigo",
  other: "Otros archivos",
} as const;
export type FileKind = keyof typeof fileKinds;
const extensions: Record<string, string[]> = {
  documents: [
    "pdf",
    "txt",
    "md",
    "doc",
    "docx",
    "odt",
    "rtf",
    "xls",
    "xlsx",
    "ods",
    "csv",
    "ppt",
    "pptx",
    "odp",
  ],
  images: [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "ico",
    "tif",
    "tiff",
    "heic",
    "avif",
  ],
  videos: ["mp4", "mkv", "avi", "mov", "webm", "wmv", "m4v"],
  audio: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus"],
  archives: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  code: [
    "rs",
    "js",
    "ts",
    "jsx",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "cs",
    "go",
    "html",
    "css",
    "json",
    "toml",
    "yaml",
    "yml",
    "xml",
    "sql",
    "sh",
    "ps1",
  ],
};
export function matchesKind(entry: Entry, kind: FileKind): boolean {
  if (kind === "all") return true;
  if (entry.isDirectory) return kind === "folders";
  if (kind === "folders") return false;
  const extension = entry.name.includes(".")
    ? entry.name.split(".").at(-1)!.toLowerCase()
    : "";
  return kind === "other"
    ? !Object.values(extensions).some((list) => list.includes(extension))
    : extensions[kind].includes(extension);
}
export type SearchBatch = {
  entries: Entry[];
  scanned: number;
  skipped: number;
  warnings: FileError[];
  done: boolean;
  cancelled: boolean;
  limited: boolean;
};
let searchId = Date.now();
export function searchSystem(
  query: string,
  kind: FileKind,
  includeHidden: boolean,
  onBatch: (batch: SearchBatch) => void,
  onError: (error: unknown) => void,
): () => void {
  const id = ++searchId;
  let cancelled = false;
  if (demo) {
    void (async () => {
      const pending = ["C:\\"];
      let scanned = 0;
      const results: Entry[] = [];
      while (pending.length && !cancelled) {
        const listing = await readDirectory(pending.pop()!);
        for (const entry of listing.entries) {
          scanned++;
          if (!includeHidden && entry.hidden) continue;
          if (entry.isDirectory && !entry.isSymlink) pending.push(entry.path);
          if (
            entry.name.toLowerCase().includes(query.trim().toLowerCase()) &&
            matchesKind(entry, kind)
          )
            results.push(entry);
        }
      }
      if (!cancelled)
        onBatch({
          entries: results,
          scanned,
          skipped: 0,
          warnings: [],
          done: true,
          cancelled: false,
          limited: false,
        });
    })().catch((error) => {
      if (!cancelled) onError(error);
    });
  } else {
    const channel = new Channel<SearchBatch>();
    channel.onmessage = (batch) => {
      if (!cancelled) onBatch(batch);
    };
    void invoke("search_system", {
      id,
      query,
      kind,
      includeHidden,
      onBatch: channel,
    }).catch((error) => {
      if (!cancelled) onError(error);
    });
  }
  return () => {
    cancelled = true;
    if (!demo) void invoke("cancel_search", { id }).catch(() => {});
  };
}
export const demo = typeof window === "undefined" || !isTauri();

const root = "C:\\Usuarios\\Demo";
const demoLocations: Location[] = [
  { name: "Inicio", path: root, kind: "home" },
  ...["Documentos", "Descargas", "Escritorio"].map((name) => ({
    name,
    path: `${root}\\${name}`,
    kind: "folder",
  })),
  { name: "Unidad C:", path: "C:\\", kind: "drive" },
];

export async function getLocations(): Promise<Location[]> {
  return demo ? demoLocations : invoke("get_locations");
}

export async function readDirectory(path: string): Promise<Directory> {
  if (!demo) return invoke("read_directory", { path });
  const folders =
    path === root
      ? ["Documentos", "Descargas", "Escritorio"]
      : path.endsWith("Documentos")
        ? ["Proyectos", "Personal", "Referencias"]
        : [];
  const names = [
    ...folders,
    ...(path.endsWith("Documentos")
      ? [
          "Ideas de producto.md",
          "Presupuesto 2026.xlsx",
          "Guia de identidad.pdf",
          "Notas de la reunion.txt",
          ".config",
        ]
      : []),
  ];
  if (path === "C:\\") names.push("Usuarios");
  if (path === "C:\\Usuarios") names.push("Demo");
  const valid =
    demoLocations.some((l) => l.path === path) ||
    [
      "C:\\Usuarios",
      ...["Proyectos", "Personal", "Referencias"].map(
        (n) => `${root}\\Documentos\\${n}`,
      ),
    ].includes(path);
  if (!valid)
    throw {
      kind: "missing",
      message: "Esta ubicacion no existe en la demostracion.",
      suggestion:
        "Abre Documentos o ejecuta la aplicacion de escritorio para acceder a tus archivos.",
      path,
      code: null,
      detail: "El navegador no tiene acceso al sistema de archivos.",
    } satisfies FileError;
  return {
    path,
    parent:
      path === "C:\\" ? null : path.slice(0, path.lastIndexOf("\\")) || "C:\\",
    warnings: [],
    entries: names.map((name, index) => ({
      name,
      path: `${path.endsWith("\\") ? path.slice(0, -1) : path}\\${name}`,
      isDirectory:
        folders.includes(name) || ["Usuarios", "Demo"].includes(name),
      isSymlink: false,
      hidden: name.startsWith("."),
      size:
        folders.includes(name) || ["Usuarios", "Demo"].includes(name)
          ? null
          : ([0, 0, 0, 2400, 18600, 480000, 860, 0][index] ?? 0),
      modified: 1793790000 - index * 86400,
      error: null,
    })),
  };
}

export async function openFile(path: string): Promise<void> {
  if (demo)
    throw {
      kind: "demo",
      message: "Este archivo es un ejemplo de interfaz.",
      suggestion:
        "Ejecuta Senda en escritorio para abrir archivos reales con su aplicacion asociada.",
      path,
      code: null,
      detail: "No se ha abierto ningun archivo.",
    } satisfies FileError;
  return invoke("open_file", { path });
}

export function visibleEntries(
  entries: Entry[],
  query: string,
  hidden: boolean,
  sort: "name" | "modified" | "size",
  descending: boolean,
  kind: FileKind = "all",
): Entry[] {
  const needle = query.trim().toLocaleLowerCase();
  return entries
    .filter(
      (e) =>
        (hidden || !e.hidden) &&
        e.name.toLocaleLowerCase().includes(needle) &&
        matchesKind(e, kind),
    )
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      const order =
        sort === "name"
          ? a.name.localeCompare(b.name, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          : (a[sort] ?? -1) - (b[sort] ?? -1);
      return (descending ? -order : order) || a.name.localeCompare(b.name);
    });
}

export function formatSize(size: number | null): string {
  if (size === null) return "-";
  const unit =
    size < 1024 ? 0 : Math.min(3, Math.floor(Math.log(size) / Math.log(1024)));
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: unit ? 1 : 0 }).format(size / 1024 ** unit)} ${["B", "KB", "MB", "GB"][unit]}`;
}

export function asError(error: unknown): FileError {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "suggestion" in error
  )
    return error as FileError;
  return {
    kind: "internal",
    message: "No se pudo completar la accion.",
    suggestion: "Reintenta y consulta los detalles.",
    path: "",
    code: null,
    detail: String(error),
  };
}
