// V2.2.1 Session-fix — single source for the displayed app version.
//
// Read at build-time from package.json (which Tauri's `app.package_info()`
// also derives from via tauri.conf.json). Both fields are kept in sync
// by convention — bump them together in release commits.
//
// Sidebar reads APP_VERSION; the Settings UpdaterCard reads
// `status.current_version` from the backend, which derives from the
// same package_info — so the two displays stay aligned.

import pkg from "../../package.json";

export const APP_VERSION: string = (pkg as { version: string }).version;
