# SGHUB Data Directory Management (V2.1.0)

SGHUB stores every paper, Skill YAML, chat message, PDF and uploaded
attachment under a single **data directory**. By default it lives in
the OS application-data folder; you can move it elsewhere — for
example onto a faster SSD, a roomier external drive, or a cloud-sync
folder (OneDrive, Dropbox, iCloud Drive).

This document explains where it lives, how to move it safely, and
the trade-offs of the three migration modes.

## Where it lives

| OS | Default data directory |
| --- | --- |
| Windows | `%APPDATA%\com.sghub.app\data\` |
| macOS | `~/Library/Application Support/com.sghub.app/data/` |
| Linux | `~/.config/com.sghub.app/data/` |

### The bootstrap file

The directory above is the **default**. When you pick a custom
location, that override is written to a separate **bootstrap** file
(it can't live inside the data directory itself — circular
dependency: the app needs to read the file before it knows where the
data directory is):

| OS | Bootstrap file |
| --- | --- |
| Windows | `%APPDATA%\sghub-bootstrap\bootstrap.toml` |
| macOS | `~/Library/Application Support/sghub-bootstrap/bootstrap.toml` |
| Linux | `~/.config/sghub-bootstrap/bootstrap.toml` |

Format:

```toml
data_dir = "D:\\my-custom-sghub"
```

If the file is missing OR the path inside is unreachable, the app
silently falls back to the default location. Your data is never put
at risk by a broken bootstrap file.

## Layout under the data directory

```text
<data_dir>/
├── data/
│   ├── sghub.db                # SQLite — every row of metadata
│   ├── pdfs/                   # downloaded + uploaded PDFs
│   │   └── uploaded/           # papers you imported by hand
│   ├── chat_attachments/       # files you've attached in Chat
│   ├── exports/                # BibTeX exports etc.
│   └── cache/                  # transient search caches
├── skills/                     # your custom Skill YAML / .skill files
└── logs/                       # rolling log files (7-day retention)
```

## Changing the location

Open **Settings → 💾 数据管理 → 🔄 修改路径** to start the 3-step
wizard.

### Step 1 — Pick a new location

A native folder picker opens. The wizard immediately validates the
chosen path:

- ❌ The path doesn't exist or isn't a directory
- ❌ It's a system directory (`C:\Windows`, `/usr`, `/etc`, …)
- ❌ It's your current data directory (or a subfolder of it)
- ❌ The app can't write to it
- ⚠ It already contains a SGHUB data directory (`data/sghub.db`)

The last case isn't an error — you just need to pick mode
**"use existing"** in step 2.

### Step 2 — Pick a migration mode

| Mode | What it does | Use it when |
| --- | --- | --- |
| **Migrate existing data** *(default)* | Copies every file from the current location to the new path, verifies integrity, then switches. The current location is left untouched (you choose whether to delete it after restart). | Moving to a new disk, reorganising folders. |
| **Start fresh** | Just updates the bootstrap file. The new path starts empty. | Running multiple isolated SGHUB profiles. |
| **Use existing SGHUB data at the new path** *(only if detected)* | Switches without copying — you're telling SGHUB the new location already has your data. | Restoring from a backup; pointing at a sync folder shared between machines. |

### Step 3 — Confirm and run

You see a summary: old path → new path, mode, and a red warning that
the app will restart. Hit **执行迁移** and:

- **Migrate**: a progress bar shows files being copied. Each file is
  SHA-256 checked (`sghub.db`, `.yaml`, `.skill`, `.toml`) or
  byte-length checked (everything else). Any failure rolls back —
  partial copies are deleted and `bootstrap.toml` is **not** touched,
  so the next launch still loads your old data.
- **Fresh / Use existing**: just writes the new `bootstrap.toml`.

When the copy succeeds you're asked whether to delete the old
directory. **Recommendation: keep it for one app session.** Once
you've confirmed everything works, come back and remove it from your
OS file manager.

The app then **restarts** to load from the new location.

## Sharing data between machines (advanced)

You can point SGHUB at a folder that lives inside OneDrive / Dropbox
/ iCloud Drive / Syncthing:

1. On machine A: **Migrate existing data** to the synced folder.
2. Wait for the sync client to upload everything.
3. On machine B: **Use existing SGHUB data**, pick the same synced
   folder.

⚠ **Don't run two instances at once.** SQLite uses file locks; if
both machines write at the same time you'll corrupt the database.

## Recovering from a broken bootstrap

If the bootstrap file points at a path that no longer exists (you
deleted it, the external drive isn't plugged in, …), the app
auto-falls back to the OS default and logs a warning. You can also:

1. Quit SGHUB.
2. Delete `bootstrap.toml` from the bootstrap directory listed above.
3. Relaunch — you're back to the default location.

## Diagnostic commands (frontend → Tauri)

| Command | Returns |
| --- | --- |
| `get_current_data_dir()` | `{ path, is_custom, size_mb }` |
| `validate_data_dir(path)` | `{ valid, has_existing_sghub_data, free_space_mb, error }` |
| `migrate_data_dir(path, mode)` | Migration result; emits `data_migration:progress` events |
| `reset_data_dir_to_default()` | Removes the custom override |
| `delete_old_data_dir(path)` | Recursively deletes an old SGHUB data dir (refuses non-SGHUB paths) |

All paths in the API are absolute and OS-native (backslashes on
Windows, forward slashes on POSIX).
