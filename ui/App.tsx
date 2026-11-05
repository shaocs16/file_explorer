import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  File,
  FileText,
  Folder,
  HardDrive,
  Home,
  Info,
  LoaderCircle,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Sun,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  asError,
  demo,
  formatSize,
  getLocations,
  openFile,
  readDirectory,
  visibleEntries,
  searchSystem,
  fileKinds,
  type FileKind,
  type SearchBatch,
  type Directory,
  type Entry,
  type FileError,
  type Location,
} from "./files";

type Tab = { id: number; history: string[]; position: number };
const date = (value: number | null) =>
  value === null
    ? "-"
    : new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(value * 1000);
const title = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).at(-1) || path;

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState(1);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FileError | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [kind, setKind] = useState<FileKind>("all");
  const [searchResult, setSearchResult] = useState<SearchBatch | null>(null);
  const [searching, setSearching] = useState(false);
  const stopSearch = useRef<(() => void) | null>(null);
  const globalSearch = query.trim().length > 0;
  const entries = globalSearch
    ? (searchResult?.entries ?? [])
    : (directory?.entries ?? []);
  const [pathInput, setPathInput] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [sort, setSort] = useState<"name" | "modified" | "size">("name");
  const [descending, setDescending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);
  const nextTab = useRef(2);
  const scroll = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const pathField = useRef<HTMLInputElement>(null);
  const tab = tabs.find((t) => t.id === active);
  const path = tab?.history[tab.position];
  // Sorting large listings must not run again for selection or each input keystroke.
  const rows = useMemo(
    () =>
      visibleEntries(
        entries,
        globalSearch ? "" : deferredQuery,
        hidden,
        sort,
        descending,
        kind,
      ),
    [
      directory,
      searchResult,
      globalSearch,
      deferredQuery,
      hidden,
      sort,
      descending,
      kind,
    ],
  );
  const current = entries.find((e) => e.path === selected);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => (compact ? 34 : 46),
    overscan: 12,
  });

  useEffect(() => {
    if (selected && !rows.some((entry) => entry.path === selected))
      setSelected(null);
  }, [rows, selected]);

  useEffect(() => {
    setSearchResult(null);
    setSelected(null);
    if (!query.trim()) {
      setSearching(false);
      return;
    }
    setSearching(true);
    let live = true;
    const timer = window.setTimeout(() => {
      stopSearch.current = searchSystem(
        query,
        kind,
        hidden,
        (batch) => {
          if (!live) return;
          setSearchResult((old) => ({
            ...batch,
            entries: [...(old?.entries ?? []), ...batch.entries],
            warnings: [...(old?.warnings ?? []), ...batch.warnings].slice(
              0,
              20,
            ),
          }));
          if (batch.done) setSearching(false);
        },
        (failure) => {
          if (live) {
            setError(asError(failure));
            setSearching(false);
          }
        },
      );
    }, 350);
    stopSearch.current = () => {
      live = false;
      window.clearTimeout(timer);
    };
    return () => {
      live = false;
      window.clearTimeout(timer);
      stopSearch.current?.();
      stopSearch.current = null;
    };
  }, [query, kind, hidden]);

  useEffect(() => {
    let disposed = false;
    getLocations()
      .then((items) => {
        if (disposed) return;
        setLocations(items);
        if (!items.length) {
          setError(asError("No se ha encontrado una ubicacion inicial."));
          setLoading(false);
          return;
        }
        const initial = items.find((l) => l.name === "Documentos") ?? items[0];
        setTabs([{ id: 1, history: [initial.path], position: 0 }]);
      })
      .catch((e) => {
        if (!disposed) {
          setError(asError(e));
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!path) return;
    const request = ++sequence.current;
    setPathInput(path);
    setLoading(true);
    setError(null);
    setDirectory(null);
    setSelected(null);
    setQuery("");
    readDirectory(path)
      .then((result) => {
        if (sequence.current !== request) return;
        setDirectory(result);
        setLoading(false);
        scroll.current?.scrollTo({ top: 0 });
      })
      .catch((e) => {
        if (sequence.current === request) {
          setError(asError(e));
          setLoading(false);
        }
      });
    return () => {
      sequence.current++;
    };
  }, [path, active, refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    virtual.measure();
  }, [compact]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        pathField.current?.focus();
        pathField.current?.select();
      }
      if (e.key === "F5") {
        e.preventDefault();
        setRefresh((n) => n + 1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function navigate(destination: string) {
    setQuery("");
    if (destination === path) {
      setRefresh((n) => n + 1);
      return;
    }
    setTabs((old) =>
      old.map((t) =>
        t.id !== active
          ? t
          : {
              ...t,
              history: [...t.history.slice(0, t.position + 1), destination],
              position: t.position + 1,
            },
      ),
    );
  }
  function history(offset: number) {
    setQuery("");
    setTabs((old) =>
      old.map((t) =>
        t.id !== active
          ? t
          : {
              ...t,
              position: Math.max(
                0,
                Math.min(t.history.length - 1, t.position + offset),
              ),
            },
      ),
    );
  }
  async function activate(entry: Entry) {
    if (entry.error) {
      setError(entry.error);
      return;
    }
    if (entry.isDirectory) navigate(entry.path);
    else {
      try {
        await openFile(entry.path);
      } catch (e) {
        setError(asError(e));
      }
    }
  }
  function sortBy(key: typeof sort) {
    if (sort === key) setDescending(!descending);
    else {
      setSort(key);
      setDescending(false);
    }
  }

  return (
    <div className="app">
      <a className="skip" href="#files">
        Ir a los archivos
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Folder size={20} />
          </span>
          <span>
            Senda<small>Archivos, sin ruido.</small>
          </span>
        </div>
        <div className="nav-label">Tus ubicaciones</div>
        <nav aria-label="Ubicaciones">
          {locations
            .filter((l) => l.kind !== "drive")
            .map((l) => (
              <button
                key={l.path}
                className={l.path === path ? "nav-item active" : "nav-item"}
                onClick={() => navigate(l.path)}
                aria-current={l.path === path ? "page" : undefined}
              >
                {l.kind === "home" ? <Home size={17} /> : <Folder size={17} />}
                <span>{l.name}</span>
              </button>
            ))}
        </nav>
        <div className="nav-label devices">Dispositivos</div>
        <nav aria-label="Unidades">
          {locations
            .filter((l) => l.kind === "drive")
            .map((l) => (
              <button
                key={l.path}
                className={l.path === path ? "nav-item active" : "nav-item"}
                onClick={() => navigate(l.path)}
              >
                <HardDrive size={17} />
                <span>{l.name}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          Local por naturaleza<small>Sin cuentas. Sin nube propia.</small>
        </div>
      </aside>
      <main>
        <div className="tabs" aria-label="Carpetas abiertas">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={t.id === active ? "tab active-tab" : "tab"}
            >
              <button
                onClick={() => setActive(t.id)}
                aria-pressed={t.id === active}
              >
                <Folder size={15} />
                {title(t.history[t.position])}
              </button>
              {tabs.length > 1 && (
                <button
                  aria-label={`Cerrar pestana ${title(t.history[t.position])}`}
                  onClick={() => {
                    setTabs((old) => old.filter((item) => item.id !== t.id));
                    if (active === t.id)
                      setActive(tabs.find((item) => item.id !== t.id)!.id);
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            className="icon-button"
            aria-label="Nueva pestana"
            disabled={!path}
            onClick={() => {
              const id = nextTab.current++;
              setTabs((old) => [...old, { id, history: [path!], position: 0 }]);
              setActive(id);
            }}
          >
            <Plus size={17} />
          </button>
          <span className="tab-spacer" />
          <button
            className="icon-button"
            aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <div className="navigation">
          <div className="history">
            <button
              className="icon-button"
              aria-label="Atras"
              disabled={!tab || tab.position === 0}
              onClick={() => history(-1)}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Adelante"
              disabled={!tab || tab.position === tab.history.length - 1}
              onClick={() => history(1)}
            >
              <ArrowRight size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Carpeta superior"
              disabled={!directory?.parent || loading}
              onClick={() => navigate(directory!.parent!)}
            >
              <ArrowUp size={17} />
            </button>
          </div>
          <form
            className="address"
            onSubmit={(e) => {
              e.preventDefault();
              if (pathInput.trim()) navigate(pathInput.trim());
            }}
          >
            <Folder size={16} />
            <input
              ref={pathField}
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              aria-label="Ruta de la carpeta"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              className="icon-button"
              aria-label="Ir a la ruta"
              type="submit"
            >
              <ChevronRight size={16} />
            </button>
          </form>
          <button
            className="icon-button"
            aria-label="Actualizar carpeta"
            disabled={!path || loading}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {demo && (
          <div className="demo-notice">
            <Info size={14} />
            <span>
              Vista de demostracion · Archivos de ejemplo. El navegador no
              accede a tu disco.
            </span>
          </div>
        )}
        <header className="heading">
          <div>
            <div className="eyebrow">ESPACIO DE TRABAJO</div>
            <h1>
              {globalSearch
                ? "Buscar en el equipo"
                : path
                  ? title(path)
                  : "Tus archivos"}
            </h1>
            <p>
              {globalSearch
                ? `Nombre: ${query.trim()} · Todas las unidades detectadas`
                : loading
                  ? "Leyendo carpeta..."
                  : directory
                    ? `${directory.entries.filter((e) => !e.hidden || hidden).length} elementos en esta ubicacion`
                    : "Explora una ubicacion para empezar"}
            </p>
          </div>
          <div className="search">
            <Search size={17} />
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                scroll.current?.scrollTo({ top: 0 });
              }}
              placeholder="Buscar en todo el equipo"
              aria-label="Buscar en todo el equipo"
            />
            <kbd>Ctrl F</kbd>
            {query && (
              <button
                className="icon-button"
                aria-label="Limpiar busqueda"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>
        <div className="toolbar">
          <span className="view-name">
            <Folder size={15} />
            {globalSearch ? "Resultados del equipo" : "Todos los archivos"}
          </span>
          <div>
            <label className="type-filter">
              Tipo
              <select
                aria-label="Filtrar por tipo"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as FileKind);
                  scroll.current?.scrollTo({ top: 0 });
                }}
              >
                {Object.entries(fileKinds).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              aria-pressed={hidden}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <Eye size={15} /> : <EyeOff size={15} />}Ocultos
            </button>
            <button
              className="text-button"
              aria-pressed={compact}
              onClick={() => setCompact(!compact)}
            >
              {compact ? "Vista comoda" : "Vista compacta"}
            </button>
            <button
              className="icon-button"
              aria-label={preview ? "Ocultar detalles" : "Mostrar detalles"}
              aria-pressed={preview}
              onClick={() => setPreview(!preview)}
            >
              {preview ? (
                <PanelRightClose size={18} />
              ) : (
                <PanelRightOpen size={18} />
              )}
            </button>
          </div>
        </div>
        {globalSearch && (
          <div className="search-progress" role="status">
            <span>
              {searching
                ? "Buscando..."
                : searchResult?.cancelled
                  ? "Busqueda cancelada"
                  : "Busqueda finalizada"}{" "}
              · {searchResult?.scanned ?? 0} elementos examinados
              {searchResult?.skipped
                ? ` · ${searchResult.skipped} errores de acceso o lectura`
                : ""}
              {searchResult?.limited
                ? " · Limite de 10.000 resultados: concreta el nombre o el tipo."
                : ""}
            </span>
            {searching && (
              <button
                className="text-button"
                onClick={() => {
                  stopSearch.current?.();
                  stopSearch.current = null;
                  setSearching(false);
                  setSearchResult((old) => ({
                    ...(old ?? {
                      entries: [],
                      scanned: 0,
                      skipped: 0,
                      warnings: [],
                      limited: false,
                    }),
                    done: true,
                    cancelled: true,
                  }));
                }}
              >
                Cancelar busqueda
              </button>
            )}
          </div>
        )}
        {error && (
          <section className="error" role="alert">
            <AlertCircle size={20} />
            <div>
              <strong>{error.message}</strong>
              <p>{error.suggestion}</p>
              {error.path && <p className="error-path">{error.path}</p>}
              <details>
                <summary>Detalles tecnicos</summary>
                <p>
                  {error.detail}
                  {error.code !== null ? ` (Windows/OS: ${error.code})` : ""}
                </p>
              </details>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setError(null);
                if (!directory) setRefresh((n) => n + 1);
              }}
            >
              {directory ? "Cerrar" : "Reintentar"}
            </button>
          </section>
        )}
        <div className="workspace">
          <section
            id="files"
            className="file-area"
            aria-label={
              globalSearch ? "Resultados de busqueda" : "Archivos de la carpeta"
            }
            aria-busy={globalSearch ? searching : loading}
            tabIndex={-1}
          >
            <div className="table-header">
              <button onClick={() => sortBy("name")}>
                Nombre
                {sort === "name" && (
                  <ArrowDown
                    size={12}
                    className={descending ? "reverse" : ""}
                  />
                )}
              </button>
              <span>Tipo</span>
              <button onClick={() => sortBy("modified")}>
                Modificado
                {sort === "modified" && (
                  <ArrowDown
                    size={12}
                    className={descending ? "reverse" : ""}
                  />
                )}
              </button>
              <button className="size" onClick={() => sortBy("size")}>
                Tamano
                {sort === "size" && (
                  <ArrowDown
                    size={12}
                    className={descending ? "reverse" : ""}
                  />
                )}
              </button>
            </div>
            <div ref={scroll} className="file-scroll">
              {!globalSearch && loading ? (
                <div className="empty">
                  <LoaderCircle className="spinner" size={24} />
                  <h2>Leyendo esta ubicacion</h2>
                  <p>Puedes cambiar de carpeta mientras termina.</p>
                </div>
              ) : !globalSearch && !directory ? (
                <div className="empty">
                  <Folder size={32} />
                  <h2>No se pudo cargar la carpeta</h2>
                  <p>Consulta el error o abre otra ubicacion.</p>
                </div>
              ) : !rows.length ? (
                <div className="empty">
                  <Search size={30} />
                  <h2>
                    {globalSearch && searching
                      ? "Buscando en las unidades"
                      : query || kind !== "all"
                        ? "Sin coincidencias"
                        : "Una carpeta despejada"}
                  </h2>
                  <p>
                    {globalSearch && searching
                      ? "Los resultados apareceran mientras se recorre el equipo."
                      : query || kind !== "all"
                        ? "Prueba otro nombre, cambia el tipo o activa los archivos ocultos."
                        : "No hay elementos visibles en esta ubicacion."}
                  </p>
                  {query && (
                    <button
                      className="text-button"
                      onClick={() => setQuery("")}
                    >
                      Limpiar busqueda
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    height: virtual.getTotalSize(),
                    position: "relative",
                  }}
                >
                  {virtual.getVirtualItems().map((item) => {
                    const entry = rows[item.index];
                    const extension = entry.name.includes(".")
                      ? entry.name.split(".").at(-1)!.toUpperCase()
                      : "Archivo";
                    return (
                      <button
                        key={entry.path}
                        className={`file-row ${selected === entry.path ? "selected" : ""} ${entry.hidden ? "hidden-entry" : ""}`}
                        style={{
                          height: item.size,
                          transform: `translateY(${item.start}px)`,
                        }}
                        aria-label={`${entry.name}, ${entry.isDirectory ? "carpeta" : extension}`}
                        aria-pressed={selected === entry.path}
                        tabIndex={
                          selected
                            ? selected === entry.path
                              ? 0
                              : -1
                            : item.index === 0
                              ? 0
                              : -1
                        }
                        onClick={() => setSelected(entry.path)}
                        onDoubleClick={() => void activate(entry)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void activate(entry);
                          }
                          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            const index = Math.max(
                              0,
                              Math.min(
                                rows.length - 1,
                                item.index + (e.key === "ArrowDown" ? 1 : -1),
                              ),
                            );
                            setSelected(rows[index].path);
                            virtual.scrollToIndex(index);
                            requestAnimationFrame(() =>
                              scroll.current
                                ?.querySelector<HTMLButtonElement>(
                                  '.file-row[aria-pressed="true"]',
                                )
                                ?.focus(),
                            );
                          }
                        }}
                      >
                        <span className="file-name">
                          <span
                            className={
                              entry.isDirectory
                                ? "file-icon folder-icon"
                                : "file-icon"
                            }
                          >
                            {entry.isDirectory ? (
                              <Folder size={21} />
                            ) : ["MD", "TXT"].includes(extension) ? (
                              <FileText size={20} />
                            ) : (
                              <File size={20} />
                            )}
                          </span>
                          <span title={globalSearch ? entry.path : entry.name}>
                            {entry.name}
                            {globalSearch && (
                              <small className="result-path">
                                {entry.path}
                              </small>
                            )}
                          </span>
                          {entry.isSymlink && <span title="Enlace">↗</span>}
                          {entry.error && <AlertCircle size={14} />}
                        </span>
                        <span className="muted file-type">
                          {entry.isDirectory ? "Carpeta" : extension}
                        </span>
                        <span className="muted file-date">
                          {date(entry.modified)}
                        </span>
                        <span className="muted size">
                          {formatSize(entry.size)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          {preview && (
            <aside className="details-pane" aria-label="Detalles del elemento">
              <div className="details-heading">
                Detalles
                <Info size={15} />
              </div>
              {current ? (
                <>
                  <div className="preview-object">
                    {current.isDirectory ? (
                      <Folder size={58} strokeWidth={1.2} />
                    ) : (
                      <FileText size={54} strokeWidth={1.2} />
                    )}
                  </div>
                  <h2>{current.name}</h2>
                  <p className="detail-kind">
                    {current.isDirectory ? "Carpeta" : "Archivo"}
                  </p>
                  <dl>
                    <dt>Tamano</dt>
                    <dd>{formatSize(current.size)}</dd>
                    <dt>Modificado</dt>
                    <dd>{date(current.modified)}</dd>
                    <dt>Ubicacion</dt>
                    <dd className="detail-path">{current.path}</dd>
                    {current.isSymlink && (
                      <>
                        <dt>Enlace</dt>
                        <dd>Si</dd>
                      </>
                    )}
                  </dl>
                  <button
                    className="open-button"
                    onClick={() => void activate(current)}
                  >
                    {current.isDirectory ? "Abrir carpeta" : "Abrir archivo"}
                    <ArrowRight size={15} />
                  </button>
                  {globalSearch && !current.isDirectory && (
                    <button
                      className="text-button"
                      onClick={() => {
                        const index = Math.max(
                          current.path.lastIndexOf("\\"),
                          current.path.lastIndexOf("/"),
                        );
                        navigate(
                          index === 2 && current.path[1] === ":"
                            ? current.path.slice(0, 3)
                            : current.path.slice(0, index) || "/",
                        );
                      }}
                    >
                      Abrir ubicacion
                    </button>
                  )}
                  <p className="preview-note">
                    {current.isDirectory
                      ? "El tamano de las carpetas no se calcula al navegar."
                      : "Se abrira con la aplicacion asociada. La vista previa de contenido llegara mas adelante."}
                  </p>
                </>
              ) : (
                <div className="details-empty">
                  <span className="outline-file">
                    <File size={36} strokeWidth={1} />
                  </span>
                  <h2>Un vistazo mas cerca</h2>
                  <p>
                    Selecciona un archivo o una carpeta para ver sus detalles.
                  </p>
                  <span className="key-hint">Enter para abrir</span>
                </div>
              )}
            </aside>
          )}
        </div>
        <footer role="status" aria-live="polite">
          <span>
            {!globalSearch && loading
              ? "Cargando..."
              : `${rows.length} elementos visibles`}
            {current && " · 1 seleccionado"}
          </span>
          <span>
            {directory?.warnings.length
              ? `${directory.warnings.length} elementos no se pudieron leer`
              : demo
                ? "Demostracion local"
                : "Lectura local"}
            <span className="status-dot" />
          </span>
        </footer>
        {!!searchResult?.warnings.length && globalSearch && (
          <details className="warnings">
            <summary>Ver ubicaciones que no se pudieron leer</summary>
            {searchResult.warnings.map((warning, i) => (
              <p key={i}>
                {warning.path}: {warning.detail}
              </p>
            ))}
          </details>
        )}
        {!!directory?.warnings.length && (
          <details className="warnings">
            <summary>Ver avisos de lectura</summary>
            {directory.warnings.map((warning, i) => (
              <p key={i}>
                {warning.path}: {warning.detail}
              </p>
            ))}
          </details>
        )}
      </main>
    </div>
  );
}
