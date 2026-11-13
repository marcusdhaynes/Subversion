# Uniform Auto-Update System — Spec

App: Subversion · Repo: `marcusdhaynes/Subversion` · Category: A — live (Settings menu exists)
Current version (from package.json at time of rollout): `0.0.0`

## How it works
- The app checks `https://api.github.com/repos/marcusdhaynes/Subversion/releases/latest`.
- The latest release tag is parsed as semver (`vX.Y.Z`) and compared with the
  app's current version (`CURRENT_VERSION` in the update-check module, sourced
  from `package.json` where present; otherwise recorded as `unknown`).
- If the release is newer, the user is notified in two places (below).
- On Update: download the release asset, close the current version,
  install/swap, and reopen. Web builds refresh/reload to the new build;
  Android APK builds still require the user's Android install tap.

## Placement (identical in every app)
1. **Ribbon (notification only):** a thin ribbon at the TOP CENTER of the app,
   very low height, just enough for short text like
   `Update available · vX.Y.Z`. It is styled neutrally / theme-aware (subtle,
   no loud color block) so it never clashes with the app's own theme.
   - The ribbon itself is the button: clicking it executes the update.
     There are NO Update/Later buttons on the ribbon.
   - An `×` on the ribbon's right side dismisses it PERMANENTLY for that
     version. Dismissal is persisted keyed to the version
     (localStorage key `updates:dismissed:<version>`), so the ribbon never
     reappears on later launches for the same version. A newer version shows
     the ribbon again.
   - Full details live only in Settings (below), never on the ribbon.
2. **Updates section (permanent):** at the very BOTTOM of the app's Settings
   menu — current version, available version, What's New (release notes),
   Check for updates button, and Update button. It stays there until updated.

## Future-proof rule
- If this app ALREADY has a Settings menu, the Updates section is implemented
  LIVE now, at the bottom of Settings, and the ribbon is wired in the app root.
- If this app has NO Settings menu, this code is PREPARED / DORMANT only:
  the shared Updates component/module and this spec are present in the repo,
  but nothing is imported or displayed anywhere and there is no visible UI
  change. When a Settings menu is added later, the Updates section is then
  implemented at the very bottom of that Settings menu (and the ribbon wired
  in the app root at that time). If a future Settings menu does not pick the
  block up automatically, Marcus will ask Muse to wire it.

This repo's category: **A — live (Settings menu exists)** — A Settings menu exists, so the Updates section is live at the bottom of Settings and the ribbon is wired in the app root.

## Release format (required)
- Proper GitHub Releases — commits alone are not enough.
- Tag: semver `vX.Y.Z`; release notes = What's New; build assets attached
  (web build / APK / installer as applicable for this app).

## Files
- `updates/UPDATES_SPEC.md` — this spec.
- `src/updates/updateCheck.ts` — release fetch, semver compare, dismissal
  persistence (`updates:dismissed:<version>`), and update execution.
- `src/updates/useUpdateCheck.ts` — React hook shared by ribbon + section
  (React apps only; Svelte apps use the store/logic in `updateCheck.ts`).
- `src/updates/UpdateBanner.tsx` / `.svelte` — the top-center ribbon.
- `src/updates/UpdatesSection.tsx` / `.svelte` — the Settings Updates section.
