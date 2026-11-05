import { describe, expect, it } from "vitest";
import { formatSize, visibleEntries, matchesKind, type Entry } from "./files";

const entry = (name: string, overrides: Partial<Entry> = {}): Entry => ({
  name,
  path: name,
  isDirectory: false,
  isSymlink: false,
  hidden: false,
  size: 0,
  modified: null,
  error: null,
  ...overrides,
});
describe("directory presentation", () => {
  it("groups extensions case-insensitively and separates folders and unknown types", () => {
    expect(matchesKind(entry("informe.PDF"), "documents")).toBe(true);
    expect(matchesKind(entry("foto.JPG"), "images")).toBe(true);
    expect(matchesKind(entry("foto.JPG"), "documents")).toBe(false);
    expect(
      matchesKind(entry("carpeta.pdf", { isDirectory: true }), "documents"),
    ).toBe(false);
    expect(
      matchesKind(entry("carpeta.pdf", { isDirectory: true }), "folders"),
    ).toBe(true);
    expect(matchesKind(entry("programa.exe"), "other")).toBe(true);
    expect(matchesKind(entry("README"), "other")).toBe(true);
  });
  it("filters names without changing them and keeps folders first", () => {
    const rows = [
      entry("archivo10.txt"),
      entry("archivo2.txt"),
      entry("Archivo", { isDirectory: true }),
      entry(".archivo", { hidden: true }),
    ];
    expect(
      visibleEntries(rows, " ARCHIVO ", false, "name", false).map(
        (e) => e.name,
      ),
    ).toEqual(["Archivo", "archivo2.txt", "archivo10.txt"]);
    expect(rows).toHaveLength(4);
  });
  it("sorts descending within types and includes hidden on request", () => {
    expect(
      visibleEntries(
        [
          entry("a", { size: 1 }),
          entry("b", { size: 10 }),
          entry(".c", { hidden: true, isDirectory: true }),
        ],
        "",
        true,
        "size",
        true,
      ).map((e) => e.name),
    ).toEqual([".c", "b", "a"]);
  });
  it("does not invent a folder size", () => {
    expect(formatSize(null)).toBe("-");
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1024)).toBe("1 KB");
  });
});
