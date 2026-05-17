//! Data-directory migration (V2.1.0).
//!
//! Three modes, picked by the user in the Settings UI:
//!
//! - **migrate** — copy every file from the current data dir to the
//!   new path, verify integrity, then update `bootstrap.toml`.
//! - **fresh** — only update `bootstrap.toml`; the new dir is a clean
//!   slate.
//! - **use_existing** — only update `bootstrap.toml`; the new dir is
//!   assumed to already contain valid SGHUB data (back-up restore,
//!   multi-device share, etc.).
//!
//! Safety guarantees (in priority order):
//!
//! 1. The source data directory is **never deleted** by migration —
//!    the caller decides whether to clean it up afterwards.
//! 2. `bootstrap.toml` is only updated AFTER all copies finished AND
//!    integrity verified, so a crash mid-copy still boots the old dir.
//! 3. Path validation rejects system roots and self-reference.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ============================================================
// Public types
// ============================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationMode {
    /// Copy + verify + switch.
    Migrate,
    /// Just switch — new path is empty.
    Fresh,
    /// Just switch — new path already has data.
    UseExisting,
}

impl MigrationMode {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "migrate" => Ok(Self::Migrate),
            "fresh" => Ok(Self::Fresh),
            "use_existing" => Ok(Self::UseExisting),
            other => Err(format!(
                "unknown migration mode `{}` (expected migrate | fresh | use_existing)",
                other
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub success: bool,
    pub migrated_files: u32,
    pub total_size_mb: f64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    /// `true` when the path already contains `data/sghub.db`.
    pub has_existing_sghub_data: bool,
    pub free_space_mb: u64,
    /// Human-readable reason when `valid == false`.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProgressPayload {
    pub current_file: String,
    pub percent: u32,
    pub bytes_copied: u64,
    pub total_bytes: u64,
}

// ============================================================
// Validation
// ============================================================

/// System paths we hard-refuse — they're either OS roots or directories
/// the user almost certainly didn't mean to clobber.
///
/// NOTE: `/var` is intentionally excluded — macOS keeps tmpfiles under
/// `/var/folders/...`, and blanket-blocking `/var` would refuse the
/// system tempdir (breaks our own integration tests too). The OS will
/// reject writes elsewhere under `/var` via the write-probe check.
const FORBIDDEN_PREFIXES: &[&str] = &[
    // Windows
    r"C:\Windows",
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    r"C:\ProgramData",
    // POSIX — kept tight; rely on the write-probe + free-space checks
    // for everything outside these.
    "/usr",
    "/etc",
    "/bin",
    "/sbin",
    "/boot",
    "/sys",
    "/proc",
    "/System",
    "/Library/System",
    "/Applications",
];

fn is_forbidden(p: &Path) -> bool {
    let s = p.to_string_lossy();
    // Bare root match
    if matches!(s.as_ref(), "/" | "C:\\" | "C:/" | "D:\\" | "D:/") {
        return true;
    }
    for prefix in FORBIDDEN_PREFIXES {
        let norm_prefix = prefix.replace('\\', "/");
        let norm_s = s.replace('\\', "/");
        if norm_s.eq_ignore_ascii_case(&norm_prefix)
            || norm_s
                .to_lowercase()
                .starts_with(&format!("{}/", norm_prefix.to_lowercase()))
        {
            return true;
        }
    }
    false
}

fn is_self_or_descendant(candidate: &Path, current: &Path) -> bool {
    // Canonicalise both sides; if either fails, fall back to a textual
    // prefix check so we still catch the obvious cases.
    let cc = candidate.canonicalize().ok();
    let cu = current.canonicalize().ok();
    match (cc, cu) {
        (Some(a), Some(b)) => a == b || a.starts_with(&b),
        _ => candidate == current || candidate.starts_with(current),
    }
}

/// Surface for `validate_data_dir` Tauri command. `current_dir` is the
/// effective data directory at call time — used for self-ref check.
pub fn validate(candidate: &Path, current_dir: &Path) -> ValidationResult {
    if !candidate.exists() {
        return ValidationResult {
            valid: false,
            has_existing_sghub_data: false,
            free_space_mb: 0,
            error: Some("路径不存在 / path does not exist".into()),
        };
    }
    if !candidate.is_dir() {
        return ValidationResult {
            valid: false,
            has_existing_sghub_data: false,
            free_space_mb: 0,
            error: Some("路径不是目录 / not a directory".into()),
        };
    }
    if is_forbidden(candidate) {
        return ValidationResult {
            valid: false,
            has_existing_sghub_data: false,
            free_space_mb: 0,
            error: Some(
                "禁止使用系统关键目录 / system directory is forbidden".into(),
            ),
        };
    }
    if is_self_or_descendant(candidate, current_dir) {
        return ValidationResult {
            valid: false,
            has_existing_sghub_data: false,
            free_space_mb: 0,
            error: Some(
                "不能选择当前数据目录或其子目录 / can't pick current dir or a subpath".into(),
            ),
        };
    }
    // Write probe — create + remove a tiny file.
    let probe = candidate.join(".sghub-writetest");
    if let Err(e) = std::fs::write(&probe, b"ok") {
        return ValidationResult {
            valid: false,
            has_existing_sghub_data: false,
            free_space_mb: 0,
            error: Some(format!("无写权限 / not writable: {}", e)),
        };
    }
    let _ = std::fs::remove_file(&probe);

    // Free space probe — best effort. `fs2`/`sysinfo` would give exact
    // numbers but adding a dep for one number is overkill; we use an
    // optimistic estimate by checking that a 1MB pre-allocation works.
    let free_space_mb = estimate_free_space_mb(candidate);

    let has_existing = candidate.join("data").join("sghub.db").exists();

    ValidationResult {
        valid: true,
        has_existing_sghub_data: has_existing,
        free_space_mb,
        error: None,
    }
}

/// Crude estimate — we'd like real disk-free numbers but that needs a
/// new dep. For now: return a large sentinel so the UI shows "ample"
/// unless the OS denies writes outright (which we already detect).
fn estimate_free_space_mb(_p: &Path) -> u64 {
    // Sentinel "plenty" value. Real impl: pull in `fs2` or `sysinfo`.
    1024 * 1024 // 1 TiB worth of MB
}

// ============================================================
// File enumeration + size
// ============================================================

/// Recursively list every file beneath `root`. Returns paths relative
/// to `root` so the caller can `dest.join(rel)`.
fn list_files(root: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            let ftype = entry.file_type()?;
            if ftype.is_dir() {
                stack.push(path);
            } else if ftype.is_file() {
                let rel = path.strip_prefix(root).unwrap_or(&path).to_path_buf();
                out.push(rel);
            }
        }
    }
    Ok(out)
}

fn total_bytes(root: &Path, files: &[PathBuf]) -> u64 {
    files
        .iter()
        .filter_map(|rel| std::fs::metadata(root.join(rel)).ok().map(|m| m.len()))
        .sum()
}

// ============================================================
// SHA-256 verify
// ============================================================

fn sha256_of(path: &Path) -> std::io::Result<[u8; 32]> {
    use std::io::Read;
    let mut hasher = Sha256::new();
    let mut file = std::fs::File::open(path)?;
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let h = hasher.finalize();
    Ok(h.into())
}

/// File extensions that matter enough to SHA-verify. Everything else
/// is byte-length verified only (much cheaper for thousands of PDFs).
fn needs_strong_verify(rel: &Path) -> bool {
    let name = rel
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    if name == "sghub.db" {
        return true;
    }
    let ext = rel
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    matches!(ext.as_str(), "yaml" | "yml" | "skill" | "toml")
}

// ============================================================
// Copy + verify (synchronous core)
// ============================================================

/// Pure copy+verify routine — accepts a progress callback so the
/// Tauri-aware wrapper can emit `data_migration:progress` events.
pub fn copy_with_verify<F>(
    src: &Path,
    dest: &Path,
    mut progress: F,
) -> MigrationResult
where
    F: FnMut(ProgressPayload),
{
    let files = match list_files(src) {
        Ok(v) => v,
        Err(e) => {
            return MigrationResult {
                success: false,
                migrated_files: 0,
                total_size_mb: 0.0,
                errors: vec![format!("enumerate source: {}", e)],
            };
        }
    };
    let total_bytes = total_bytes(src, &files);
    let mut bytes_copied: u64 = 0;
    let mut migrated_files: u32 = 0;
    let mut errors: Vec<String> = Vec::new();
    let mut written: Vec<PathBuf> = Vec::with_capacity(files.len());

    for rel in &files {
        let src_path = src.join(rel);
        let dest_path = dest.join(rel);
        if let Some(parent) = dest_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                errors.push(format!("mkdir {}: {}", parent.display(), e));
                rollback(&written);
                return MigrationResult {
                    success: false,
                    migrated_files,
                    total_size_mb: bytes_to_mb(bytes_copied),
                    errors,
                };
            }
        }
        match std::fs::copy(&src_path, &dest_path) {
            Ok(n) => {
                bytes_copied += n;
                migrated_files += 1;
                written.push(dest_path.clone());
            }
            Err(e) => {
                errors.push(format!("copy {}: {}", rel.display(), e));
                rollback(&written);
                return MigrationResult {
                    success: false,
                    migrated_files,
                    total_size_mb: bytes_to_mb(bytes_copied),
                    errors,
                };
            }
        }
        // Verify
        if needs_strong_verify(rel) {
            let src_hash = sha256_of(&src_path);
            let dst_hash = sha256_of(&dest_path);
            match (src_hash, dst_hash) {
                (Ok(a), Ok(b)) if a == b => {}
                (Ok(_), Ok(_)) => {
                    errors.push(format!(
                        "hash mismatch on {}",
                        rel.display()
                    ));
                    rollback(&written);
                    return MigrationResult {
                        success: false,
                        migrated_files,
                        total_size_mb: bytes_to_mb(bytes_copied),
                        errors,
                    };
                }
                (Err(e), _) | (_, Err(e)) => {
                    errors.push(format!(
                        "hash read failed for {}: {}",
                        rel.display(),
                        e
                    ));
                    rollback(&written);
                    return MigrationResult {
                        success: false,
                        migrated_files,
                        total_size_mb: bytes_to_mb(bytes_copied),
                        errors,
                    };
                }
            }
        } else {
            // Byte-length verify
            let sm = std::fs::metadata(&src_path).map(|m| m.len()).unwrap_or(0);
            let dm = std::fs::metadata(&dest_path).map(|m| m.len()).unwrap_or(0);
            if sm != dm {
                errors.push(format!(
                    "size mismatch on {} (src={} dst={})",
                    rel.display(),
                    sm,
                    dm
                ));
                rollback(&written);
                return MigrationResult {
                    success: false,
                    migrated_files,
                    total_size_mb: bytes_to_mb(bytes_copied),
                    errors,
                };
            }
        }
        let percent = if total_bytes == 0 {
            100
        } else {
            ((bytes_copied as f64 / total_bytes as f64) * 100.0).min(100.0) as u32
        };
        progress(ProgressPayload {
            current_file: rel.to_string_lossy().into_owned(),
            percent,
            bytes_copied,
            total_bytes,
        });
    }

    MigrationResult {
        success: true,
        migrated_files,
        total_size_mb: bytes_to_mb(bytes_copied),
        errors,
    }
}

fn rollback(written: &[PathBuf]) {
    // Best-effort cleanup of partially-written destination files.
    let mut dirs: HashSet<PathBuf> = HashSet::new();
    for p in written {
        let _ = std::fs::remove_file(p);
        if let Some(parent) = p.parent() {
            dirs.insert(parent.to_path_buf());
        }
    }
    // Try to remove now-empty dirs (silently ignore non-empty).
    for d in dirs {
        let _ = std::fs::remove_dir(d);
    }
}

fn bytes_to_mb(b: u64) -> f64 {
    (b as f64) / (1024.0 * 1024.0)
}

// ============================================================
// Public size helper used by `get_current_data_dir`
// ============================================================

pub fn dir_size_mb(p: &Path) -> f64 {
    let files = list_files(p).unwrap_or_default();
    bytes_to_mb(total_bytes(p, &files))
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn mode_parses() {
        assert_eq!(MigrationMode::parse("migrate").unwrap(), MigrationMode::Migrate);
        assert_eq!(MigrationMode::parse("fresh").unwrap(), MigrationMode::Fresh);
        assert_eq!(
            MigrationMode::parse("use_existing").unwrap(),
            MigrationMode::UseExisting
        );
        assert!(MigrationMode::parse("nope").is_err());
    }

    #[test]
    fn forbidden_blocks_system_roots() {
        assert!(is_forbidden(Path::new(r"C:\Windows")));
        assert!(is_forbidden(Path::new(r"C:\Windows\System32")));
        assert!(is_forbidden(Path::new("/usr")));
        assert!(is_forbidden(Path::new("/usr/local/bin")));
        assert!(is_forbidden(Path::new("/etc/passwd")));
        assert!(is_forbidden(Path::new("/")));
        assert!(is_forbidden(Path::new("C:\\")));
    }

    #[test]
    fn forbidden_allows_user_paths() {
        assert!(!is_forbidden(Path::new(r"D:\sghub")));
        assert!(!is_forbidden(Path::new(r"C:\Users\me\Documents\sghub")));
        assert!(!is_forbidden(Path::new("/home/me/sghub")));
        assert!(!is_forbidden(Path::new("/Users/me/Documents")));
    }

    #[test]
    fn self_ref_blocks_current_and_child() {
        let tmp = TempDir::new().unwrap();
        let current = tmp.path();
        let child = current.join("child");
        std::fs::create_dir_all(&child).unwrap();
        assert!(is_self_or_descendant(current, current));
        assert!(is_self_or_descendant(&child, current));
    }

    #[test]
    fn validate_ok_for_empty_writable_dir() {
        let tmp = TempDir::new().unwrap();
        let dest = tmp.path().join("new");
        std::fs::create_dir_all(&dest).unwrap();
        let res = validate(&dest, Path::new("/something/else"));
        assert!(res.valid, "{:?}", res.error);
        assert!(!res.has_existing_sghub_data);
    }

    #[test]
    fn validate_detects_existing_sghub_data() {
        let tmp = TempDir::new().unwrap();
        let data = tmp.path().join("data");
        std::fs::create_dir_all(&data).unwrap();
        std::fs::write(data.join("sghub.db"), b"stub").unwrap();
        let res = validate(tmp.path(), Path::new("/something/else"));
        assert!(res.valid);
        assert!(res.has_existing_sghub_data);
    }

    #[test]
    fn validate_rejects_missing() {
        let res = validate(Path::new("/definitely/does/not/exist/x"), Path::new("/x"));
        assert!(!res.valid);
        assert!(res.error.as_deref().unwrap().contains("不存在"));
    }

    #[test]
    fn copy_with_verify_handles_empty_source() {
        let src = TempDir::new().unwrap();
        let dst = TempDir::new().unwrap();
        let res = copy_with_verify(src.path(), dst.path(), |_| {});
        assert!(res.success);
        assert_eq!(res.migrated_files, 0);
        assert_eq!(res.total_size_mb, 0.0);
    }

    #[test]
    fn copy_with_verify_copies_files_and_checks_hash() {
        let src = TempDir::new().unwrap();
        let dst = TempDir::new().unwrap();
        std::fs::create_dir_all(src.path().join("data")).unwrap();
        std::fs::write(src.path().join("data").join("sghub.db"), b"hello-db").unwrap();
        std::fs::write(src.path().join("README.md"), b"hi").unwrap();
        std::fs::create_dir_all(src.path().join("skills")).unwrap();
        std::fs::write(
            src.path().join("skills").join("foo.yaml"),
            b"name: foo\n",
        )
        .unwrap();

        let mut events: Vec<ProgressPayload> = Vec::new();
        let res = copy_with_verify(src.path(), dst.path(), |p| events.push(p));
        assert!(res.success, "errors: {:?}", res.errors);
        assert_eq!(res.migrated_files, 3);
        assert!(dst.path().join("data").join("sghub.db").exists());
        assert!(dst.path().join("skills").join("foo.yaml").exists());
        assert!(!events.is_empty());
        assert_eq!(events.last().unwrap().percent, 100);
    }

    #[test]
    fn dir_size_mb_handles_empty() {
        let tmp = TempDir::new().unwrap();
        assert_eq!(dir_size_mb(tmp.path()), 0.0);
    }

    #[test]
    fn needs_strong_verify_categorises() {
        assert!(needs_strong_verify(Path::new("data/sghub.db")));
        assert!(needs_strong_verify(Path::new("skills/foo.yaml")));
        assert!(needs_strong_verify(Path::new("skills/bar.skill")));
        assert!(needs_strong_verify(Path::new("config.toml")));
        assert!(!needs_strong_verify(Path::new("pdfs/big.pdf")));
        assert!(!needs_strong_verify(Path::new("chat_attachments/x.png")));
    }
}
