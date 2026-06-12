# BharatBrowser Import Validation Report

Generated: 2026-06-12

## Import Result

**npm run import:** SUCCESS

| Metric | Value |
| --- | --- |
| Folder patches applied | 809 |
| Git patches applied | 245 |
| Total patches | 1054 |
| Patch failures | 0 |
| Warnings | 0 |

## Patches Repaired

Three patches had structural errors preventing application:

| Patch | Issue | Fix |
| --- | --- | --- |
| `src/browser/base/content/aboutDialog-xhtml.patch` | Wrong hunk header count (old=26→22, new=22→28 in hunk 2) | `@@ -120,26 +116,22 @@` → `@@ -120,22 +116,28 @@` |
| `src/browser/base/content/navigator-toolbox-inc-xhtml.patch` | Missing space prefixes on context lines + wrong hunk 5 header | Added ` ` prefix to bare `#include`/empty lines; `@@ -115,9 +122,10 @@` → `@@ -115,10 +122,14 @@` |
| `src/external-patches/firefox/add_urlbar_closeonwindowblur_preference.patch` | Last hunk header count off by +1 (trailing newline artifact) | `@@ -4783,10 +4783,16 @@` → `@@ -4783,11 +4783,17 @@` |

## Mass Normalization

- **CRLF → LF**: All 245 git patch files converted from Windows CRLF to Unix LF for Linux compatibility
- **BOM Removed**: Stripped from all files

## Disabled Patches

| Patch | Reason | Status |
| --- | --- | --- |
| `src/browser/base/content/browser-box-inc-xhtml.patch.disabled` | Corrupt — was disabled in prior commit `c417400` | Intentionally kept disabled |

Previously disabled `aboutDialog-xhtml.patch.disabled` has been **restored** as an active, repaired `.patch` file and the `.disabled` backup removed.

## Files Committed

- 243 modified patch files (CRLF→LF + content fixes)
- 1 new file: `src/browser/base/content/aboutDialog-xhtml.patch` (restored from `.disabled`, repaired)
- 1 deleted file: `src/browser/base/content/aboutDialog-xhtml.patch.disabled` (replaced by fixed version)
- 3 report files: `PATCH_AUDIT_REPORT.md`, `PATCH_FIX_SUMMARY.md`, `IMPORT_VALIDATION_REPORT.md`
