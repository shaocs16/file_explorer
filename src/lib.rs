use serde::Serialize;
pub mod search;
use std::{fs, io, path::Path, time::UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileError {
    pub kind: &'static str,
    pub message: &'static str,
    pub suggestion: &'static str,
    pub path: String,
    pub code: Option<i32>,
    pub detail: String,
}

impl FileError {
    pub fn internal(detail: String) -> Self {
        Self {
            kind: "internal",
            message: "No se pudo completar la accion.",
            suggestion: "Reintenta la accion y consulta los detalles si vuelve a fallar.",
            path: String::new(),
            code: None,
            detail,
        }
    }

    pub fn from_io(path: &str, error: io::Error) -> Self {
        let (kind, message, suggestion) = match error.kind() {
            io::ErrorKind::PermissionDenied => (
                "permission",
                "No tienes permiso para acceder a esta ubicacion.",
                "Comprueba los permisos de la carpeta. La aplicacion no eleva privilegios automaticamente.",
            ),
            io::ErrorKind::NotFound => (
                "missing",
                "Esta ubicacion ya no esta disponible.",
                "Comprueba la ruta o vuelve a conectar la unidad y reintenta.",
            ),
            io::ErrorKind::NotADirectory => (
                "notDirectory",
                "La ruta corresponde a un archivo, no a una carpeta.",
                "Introduce la ruta de una carpeta.",
            ),
            _ if cfg!(windows) && matches!(error.raw_os_error(), Some(32 | 33)) => (
                "inUse",
                "Windows indica que el recurso esta en uso.",
                "Cierra las aplicaciones que puedan estar usandolo y reintenta. Aun no se ha identificado el proceso responsable.",
            ),
            _ => (
                "io",
                "No se pudo leer esta ubicacion.",
                "Comprueba la conexion, la ruta y los permisos antes de reintentar.",
            ),
        };
        Self {
            kind,
            message,
            suggestion,
            path: path.into(),
            code: error.raw_os_error(),
            detail: error.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub hidden: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub error: Option<FileError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Directory {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
    pub warnings: Vec<FileError>,
}

#[derive(Debug, Serialize)]
pub struct Location {
    pub name: String,
    pub path: String,
    pub kind: String,
}

// Do not round-trip a lossy path into a filesystem operation.
fn exact_path(path: &Path) -> Result<String, FileError> {
    path.to_str().map(str::to_owned).ok_or_else(|| {
        FileError::internal(
            "La ruta contiene caracteres que esta version no puede representar de forma segura."
                .into(),
        )
    })
}

pub fn list_directory(input: &str) -> Result<Directory, FileError> {
    let requested = Path::new(input);
    if !requested.is_absolute() {
        return Err(FileError::internal("Introduce una ruta absoluta.".into()));
    }
    let path = exact_path(requested)?;
    let reader = fs::read_dir(requested).map_err(|e| FileError::from_io(&path, e))?;
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    for item in reader {
        let item = match item {
            Ok(item) => item,
            Err(e) => {
                warnings.push(FileError::from_io(&path, e));
                continue;
            }
        };
        let item_path = match exact_path(&item.path()) {
            Ok(path) => path,
            Err(e) => {
                warnings.push(e);
                continue;
            }
        };
        let name = item.file_name().to_string_lossy().into_owned();
        let metadata = item.metadata();
        let file_type = item.file_type().ok();
        let is_symlink = file_type.as_ref().is_some_and(|t| t.is_symlink());
        // Follow a link only for this entry's attributes; never recursively traverse it.
        let metadata = if is_symlink {
            fs::metadata(item.path())
        } else {
            metadata
        };
        let (metadata, error) = match metadata {
            Ok(metadata) => (Some(metadata), None),
            Err(e) => (None, Some(FileError::from_io(&item_path, e))),
        };
        let is_directory = metadata.as_ref().is_some_and(|m| m.is_dir());
        let mut hidden = name.starts_with('.');
        #[cfg(windows)]
        if let Some(m) = &metadata {
            use std::os::windows::fs::MetadataExt;
            hidden |= m.file_attributes() & 2 != 0;
        }
        #[cfg(not(windows))]
        let _ = &mut hidden;
        entries.push(Entry {
            name,
            path: item_path,
            is_directory,
            is_symlink,
            hidden,
            size: metadata.as_ref().filter(|m| m.is_file()).map(|m| m.len()),
            modified: metadata
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
            error,
        });
    }
    Ok(Directory {
        path,
        parent: requested
            .parent()
            .and_then(|p| p.to_str())
            .map(str::to_owned),
        entries,
        warnings,
    })
}

pub fn locations() -> Vec<Location> {
    let mut result = Vec::new();
    if let Some(home) = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        let home = std::path::PathBuf::from(home);
        for (name, suffix, kind) in [
            ("Inicio", "", "home"),
            ("Escritorio", "Desktop", "folder"),
            ("Documentos", "Documents", "folder"),
            ("Descargas", "Downloads", "folder"),
        ] {
            let path = home.join(suffix);
            if path.is_dir()
                && let Ok(path) = exact_path(&path)
            {
                result.push(Location {
                    name: name.into(),
                    path,
                    kind: kind.into(),
                });
            }
        }
    }
    #[cfg(windows)]
    {
        // GetLogicalDrives enumerates drive letters without probing every remote drive.
        let mask = unsafe { windows_sys::Win32::Storage::FileSystem::GetLogicalDrives() };
        for index in 0..26 {
            if mask & (1 << index) != 0 {
                let letter = char::from(b'A' + index);
                result.push(Location {
                    name: format!("Unidad {letter}:"),
                    path: format!("{letter}:\\"),
                    kind: "drive".into(),
                });
            }
        }
    }
    #[cfg(not(windows))]
    result.push(Location {
        name: "Sistema de archivos".into(),
        path: "/".into(),
        kind: "drive".into(),
    });
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_files_folders_hidden_and_sizes() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("carpeta")).unwrap();
        fs::write(temp.path().join("notas.txt"), b"hola").unwrap();
        fs::write(temp.path().join(".oculto"), b"").unwrap();
        let listing = list_directory(temp.path().to_str().unwrap()).unwrap();
        assert_eq!(listing.entries.len(), 3);
        assert!(
            listing
                .entries
                .iter()
                .any(|e| e.name == "carpeta" && e.is_directory && e.size.is_none())
        );
        assert!(
            listing
                .entries
                .iter()
                .any(|e| e.name == "notas.txt" && e.size == Some(4))
        );
        assert!(
            listing
                .entries
                .iter()
                .any(|e| e.name == ".oculto" && e.hidden)
        );
        assert!(listing.warnings.is_empty());
    }

    #[test]
    fn empty_missing_and_file_paths_are_distinct() {
        let temp = tempfile::tempdir().unwrap();
        assert!(
            list_directory(temp.path().to_str().unwrap())
                .unwrap()
                .entries
                .is_empty()
        );
        let missing = temp.path().join("missing");
        assert_eq!(
            list_directory(missing.to_str().unwrap()).unwrap_err().kind,
            "missing"
        );
        let file = temp.path().join("file");
        fs::write(&file, "").unwrap();
        assert_eq!(
            list_directory(file.to_str().unwrap()).unwrap_err().kind,
            "notDirectory"
        );
    }

    #[test]
    fn rejects_relative_paths_and_explains_permissions() {
        assert!(list_directory("relative").is_err());
        let error = FileError::from_io("test", io::Error::from(io::ErrorKind::PermissionDenied));
        assert_eq!(error.kind, "permission");
        assert!(!error.suggestion.is_empty());
    }

    #[test]
    fn preserves_unicode_names() {
        let temp = tempfile::tempdir().unwrap();
        let name = "informe-\u{00f1}-\u{65e5}.txt";
        fs::write(temp.path().join(name), "").unwrap();
        assert_eq!(
            list_directory(temp.path().to_str().unwrap())
                .unwrap()
                .entries[0]
                .name,
            name
        );
    }

    #[cfg(unix)]
    #[test]
    fn reports_links_without_traversing_them() {
        let temp = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(temp.path(), temp.path().join("loop")).unwrap();
        let listing = list_directory(temp.path().to_str().unwrap()).unwrap();
        assert_eq!(listing.entries.len(), 1);
        assert!(listing.entries[0].is_symlink && listing.entries[0].is_directory);
    }
}
