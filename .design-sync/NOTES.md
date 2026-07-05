# design-sync notes - BeePEE

- BeePEE is an Electron **app**, not a component library: there is no dist/ or .d.ts. The bundle is built from the curated entry `.design-sync/ds-entry.jsx` (pass `--entry ./.design-sync/ds-entry.jsx --node-modules ./node_modules` from the repo root). To sync more components later, add exports there and pin their src paths in `componentSrcMap`.
- `BeePEETheme` (in `.design-sync/mock-providers.jsx`) wraps ThemeProvider(src/theme.js) + CssBaseline - it is `cfg.provider` and excluded from the component list via `componentSrcMap: null`.
- Components read Electron IPC (`window.package.*` / `window.electron.*`); all render-path call sites are optional-chained, so previews render without mocks. Click-triggered calls (file pickers, save) throw outside Electron - expected, render-safe.
- `SignageEditor` shows a spinner until the signage context is seeded; previews seed it via a `useSignageContext().setSignage(...)` child inside `SignageProvider` (see `previews/SignageEditor.tsx`).
- Repo install was skipped (node_modules already live from active development; repo lives in Dropbox - `npm ci` would be slow and disruptive). `package-lock.json` → `npm ci` if a fresh clone ever needs it.
- Playwright: local browser cache has chromium-1200 and chromium-1208; `playwright@1.58.0` (pins 1208) is installed in `.ds-sync/`.

- `.design-sync/templates/` holds hand-authored `.dc.html` design templates uploaded to the project's `templates/` tree OUTSIDE the converter (needs its own `finalize_plan` with `templates/**` writes - the standard plan globs don't cover it). `support.js`/`ds-base.js` are copies of the app-generated runtime from `templates/signage-editor/`.

- **Render-path guard convention**: every mount-path `window.package.*` /
  `window.electron.*` call site MUST guard the base (`window.package?.foo?.()`),
  not just the method. A 2026-07 re-sync failed `[RENDER]` on SignageEditor
  because two newly added effects accessed `window.package.onSignageDesignStaged`
  / `.getSetting` on an undefined base - fixed in app source. Check new effects
  for this before any re-sync.
- `guidelinesGlob` does not copy files out of dot-directories; design briefs
  live in `docs/guides/*.md` (covered by the default glob, no config needed).
  Current: `docs/guides/music-support.md` -> uploads as
  `guidelines/docs/guides/music-support.md`.
- Anchored diffs can report a component "unchanged" (sourceKeys) while its
  render actually changed - the driver's canary catches it (`render_churn`).
  Widespread churn -> rerun with `--force` and re-confirm all sheets.

## Known render warns

- `[FONT_MISSING] "Avenir"` - Avenir appears only as a fallback member of the `system-ui` font stack in global.css. It is Apple-proprietary, never ships, and never renders (system-ui always resolves first, including in the real app). Accepted; do not bundle a substitute.

## Re-sync risks

- The curated entry + `mock-providers.jsx` live outside `src/` - renames/moves of `src/components/SignageEditor.jsx`, `src/components/signages/*`, `src/contexts/SignageContext.jsx`, or `src/theme.js` break the entry imports; fix `.design-sync/ds-entry.jsx` paths first.
- Sample signage data in `previews/*.tsx` mirrors the shape `SignageContext`/`saveSignage` expect (`{id, name, hidden, secondary, styles: {STYLE_ID: {icon}}}`); if the signage model gains fields the editor requires, previews may render incomplete.
- `SignageEditor`'s card viewport is pinned at 960x1024 in `cfg.overrides` to match the real window size in `backend/items/itemEditor.js` - update both together.
- Build assumed node v22 and the live node_modules (MUI 7, React 19); no repo build step exists or is needed (esbuild bundles straight from src).
