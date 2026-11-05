use crate::{Entry, FileError};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::{Instant, UNIX_EPOCH},
};

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    #[default]
    All,
    Folders,
    Documents,
    Images,
    Videos,
    Audio,
    Archives,
    Code,
    Other,
}

impl FileKind {
    pub fn matches(self, name: &str, directory: bool) -> bool {
        if matches!(self, Self::All) {
            return true;
        }
        if directory {
            return matches!(self, Self::Folders);
        }
        let extension = name
            .rsplit_once('.')
            .map(|(_, ext)| ext.to_ascii_lowercase())
            .unwrap_or_default();
        let group = match extension.as_str() {
            "pdf" | "txt" | "md" | "doc" | "docx" | "odt" | "rtf" | "xls" | "xlsx" | "ods"
            | "csv" | "ppt" | "pptx" | "odp" => Self::Documents,
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" | "ico" | "tif" | "tiff"
            | "heic" | "avif" => Self::Images,
            "mp4" | "mkv" | "avi" | "mov" | "webm" | "wmv" | "m4v" => Self::Videos,
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" | "opus" => Self::Audio,
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => Self::Archives,
            "rs" | "js" | "ts" | "jsx" | "tsx" | "py" | "java" | "c" | "cpp" | "h" | "cs"
            | "go" | "html" | "css" | "json" | "toml" | "yaml" | "yml" | "xml" | "sql" | "sh"
            | "ps1" => Self::Code,
            _ => Self::Other,
        };
        std::mem::discriminant(&self) == std::mem::discriminant(&group)
    }
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchBatch {
    pub entries: Vec<Entry>,
    pub scanned: u64,
    pub skipped: u64,
    pub warnings: Vec<FileError>,
    pub done: bool,
    pub cancelled: bool,
    pub limited: bool,
}

// Bounded open handles and batches. No recursion through symlinks or Windows reparse points.
pub fn search_files(
    roots: Vec<PathBuf>,
    query: &str,
    kind: FileKind,
    include_hidden: bool,
    cancel: &AtomicBool,
    mut publish: impl FnMut(SearchBatch) -> bool,
) {
    let needle = query.trim().to_lowercase();
    let mut batch = SearchBatch::default();
    let mut total = 0;
    let mut last_publish = Instant::now();
    'roots: for root in roots {
        let walker = walkdir::WalkDir::new(root)
            .follow_links(false)
            .max_open(8)
            .into_iter()
            .filter_entry(|entry| {
                if entry.depth() == 0 {
                    return true;
                }
                if !include_hidden && is_hidden(entry) {
                    return false;
                }
                !is_reparse_directory(entry)
            });
        for item in walker {
            if cancel.load(Ordering::Relaxed) {
                batch.cancelled = true;
                break 'roots;
            }
            match item {
                Err(error) => {
                    batch.skipped += 1;
                    if batch.warnings.len() < 10 {
                        let path = error
                            .path()
                            .map(|p| p.to_string_lossy().into_owned())
                            .unwrap_or_default();
                        let detail = error.to_string();
                        batch.warnings.push(FileError::from_io(
                            &path,
                            error
                                .into_io_error()
                                .unwrap_or_else(|| std::io::Error::other(detail)),
                        ));
                    }
                }
                Ok(item) => {
                    batch.scanned += 1;
                    if item.depth() != 0 {
                        let directory = item.file_type().is_dir();
                        if let (Some(name), Some(path)) =
                            (item.file_name().to_str(), item.path().to_str())
                        {
                            if name.to_lowercase().contains(&needle)
                                && kind.matches(name, directory)
                            {
                                let metadata = item.metadata();
                                let (size, modified, error) = match metadata {
                                    Ok(m) => (
                                        if m.is_file() { Some(m.len()) } else { None },
                                        m.modified()
                                            .ok()
                                            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                                            .map(|d| d.as_secs()),
                                        None,
                                    ),
                                    Err(e) => {
                                        batch.skipped += 1;
                                        let detail = e.to_string();
                                        (
                                            None,
                                            None,
                                            Some(FileError::from_io(
                                                path,
                                                e.into_io_error().unwrap_or_else(|| {
                                                    std::io::Error::other(detail)
                                                }),
                                            )),
                                        )
                                    }
                                };
                                batch.entries.push(Entry {
                                    name: name.into(),
                                    path: path.into(),
                                    is_directory: directory,
                                    is_symlink: item.file_type().is_symlink(),
                                    hidden: is_hidden(&item),
                                    size,
                                    modified,
                                    error,
                                });
                                total += 1;
                                if total >= 10_000 {
                                    batch.limited = true;
                                    break 'roots;
                                }
                            }
                        } else {
                            batch.skipped += 1;
                        }
                    }
                }
            }
            if batch.entries.len() >= 128 || last_publish.elapsed().as_millis() >= 150 {
                let next = SearchBatch {
                    scanned: batch.scanned,
                    skipped: batch.skipped,
                    ..Default::default()
                };
                if !publish(std::mem::replace(&mut batch, next)) {
                    return;
                }
                last_publish = Instant::now();
            }
        }
    }
    batch.cancelled |= cancel.load(Ordering::Relaxed);
    batch.done = true;
    publish(batch);
}

fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    if entry.file_name().to_string_lossy().starts_with('.') {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        entry.metadata().is_ok_and(|m| m.file_attributes() & 2 != 0)
    }
    #[cfg(not(windows))]
    false
}

fn is_reparse_directory(entry: &walkdir::DirEntry) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        entry.file_type().is_dir()
            && entry
                .metadata()
                .is_ok_and(|m| m.file_attributes() & 0x400 != 0)
    }
    #[cfg(not(windows))]
    {
        let _ = entry;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn searches_multiple_roots_recursively_and_filters_types() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        fs::create_dir(a.path().join("nested")).unwrap();
        fs::write(a.path().join("nested/report.PDF"), "").unwrap();
        fs::write(b.path().join("report.JPG"), "").unwrap();
        let mut found = Vec::new();
        search_files(
            vec![a.path().into(), b.path().into()],
            " REPORT ",
            FileKind::Documents,
            false,
            &AtomicBool::new(false),
            |batch| {
                found.extend(batch.entries);
                true
            },
        );
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "report.PDF");
    }

    #[test]
    fn cancellation_hidden_and_missing_roots_are_explicit() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join(".private")).unwrap();
        fs::write(temp.path().join(".private/report.txt"), "").unwrap();
        let mut final_batch = None;
        search_files(
            vec![temp.path().into(), temp.path().join("missing")],
            "report",
            FileKind::All,
            false,
            &AtomicBool::new(false),
            |batch| {
                final_batch = Some(batch);
                true
            },
        );
        let batch = final_batch.unwrap();
        assert!(batch.entries.is_empty() && batch.done && batch.skipped == 1);
        assert_eq!(batch.warnings.len(), 1);
        search_files(
            vec![temp.path().into()],
            "report",
            FileKind::All,
            true,
            &AtomicBool::new(true),
            |batch| {
                assert!(batch.cancelled && batch.done);
                true
            },
        );
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_link_cycles() {
        let temp = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(temp.path(), temp.path().join("loop")).unwrap();
        search_files(
            vec![temp.path().into()],
            "loop",
            FileKind::All,
            true,
            &AtomicBool::new(false),
            |batch| {
                assert_eq!(batch.entries.len(), 1);
                assert!(batch.done);
                true
            },
        );
    }
}
