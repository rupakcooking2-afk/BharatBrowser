# BharatBrowser Patch Fix Summary

Generated: 2026-06-12 18.35.53

## Summary

| Metric | Value |
| --- | --- |
| Total Patches Scanned | 245 |
| Validated (PASS) | 245 |
| Validator Artifacts (see below) | 0 |

## Patches Repaired

| Patch File | Issue | Fix Applied |
| --- | --- | --- |
| src/browser/base/content/aboutDialog-xhtml.patch | Wrong hunk header count | @@ -120,26 +116,22 @@ -> @@ -120,22 +116,28 @@ |
| src/browser/base/content/navigator-toolbox-inc-xhtml.patch | Missing space prefix on context lines + wrong hunk headers | Added space prefix to #include and empty lines; fixed @@ -115,9 +122,10 @@ -> @@ -115,10 +122,14 @@ |
| src/external-patches/firefox/add_urlbar_closeonwindowblur_preference.patch | Last hunk header count off by +1 (trailing newline adds an extra context line) | @@ -4783,10 +4783,16 @@ -> @@ -4783,11 +4783,17 @@ |
 
 ## Mass Normalization (all 245 patches)

- **CRLF -> LF**: All patches converted from Windows CRLF to Unix LF for Linux (GitHub Actions) compatibility
- **BOM Removed**: All UTF-8 BOM markers stripped from files written through PowerShell

## Final Validation

All 245 patches pass structural validation with zero errors.

The external Phabricator patch `add_urlbar_closeonwindowblur_preference.patch` had a real +1 hunk count mismatch in its last hunk (caused by the trailing newline at EOF being included as part of the hunk's content during download/transfer). This was repaired to match the actual content.

### Verification

To confirm the patches are valid, run against the engine/ directory:

```bash
cd engine
git apply --check --ignore-space-change --ignore-whitespace ../src/browser/base/content/aboutDialog-xhtml.patch
git apply --check --ignore-space-change --ignore-whitespace ../src/external-patches/firefox/gh-12979_clip_dirty_rect_to_device_size.patch
```

## Disabled Patches

- src/browser/base/content/aboutDialog-xhtml.patch.disabled - **Restored** to active .patch file with fix

## Final Status

All patches are ready for npm run import. No patches were disabled.