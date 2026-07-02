# BeePEE — usage conventions

BeePEE is an Electron app for editing Portal 2 Puzzle Editor packages. This bundle ships its **signage editor** surface: `SignageEditor` (a complete editor window), `SignageInfo` and `SignageStyles` (its two tab panels), plus the wrappers needed to render them.

## Wrapping and setup (required)

Every design MUST be wrapped in `BeePEETheme` — it applies the app's dark MUI theme (via MUI `ThemeProvider` + `CssBaseline`). Without it, components render in MUI's default light theme and look nothing like the app.

`SignageEditor` additionally needs `SignageProvider` and a seeded signage object, or it renders a loading spinner forever (in the real app the data arrives over IPC):

```jsx
const { SignageEditor, SignageProvider, useSignageContext, BeePEETheme } = window.BeePEE

function Seed({ signage, children }) {
    const { setSignage } = useSignageContext()
    React.useEffect(() => { setSignage(signage) }, [])
    return children
}

<BeePEETheme>
    <SignageProvider>
        <Seed signage={{ id: "SIGN_BPEE_CAKE", name: "Cake", hidden: false, secondary: "", styles: { BEE2_CLEAN: { icon: "signage/cake.png" } } }}>
            <SignageEditor />
        </Seed>
    </SignageProvider>
</BeePEETheme>
```

`SignageInfo` and `SignageStyles` are controlled panels — pass `formData` (`{ id, name, hidden, secondary, styles }`) and `onUpdate(field, value)`; `SignageInfo` also takes `availableSignages` (`[{ id, name }]`).

## Styling idiom

No CSS utility classes. Style your own layout glue with MUI's `sx` prop using **theme keys**, never hard-coded colors:

- Surfaces: `bgcolor: "background.paper"` (#2a2d30) on `background.default` (#1d1e1f)
- Accent: `primary.main` is BeePEE gold (#d2b019); `success.main` green; destructive actions use `color="error"`
- Text: `text.primary` / `text.secondary`; borders: `borderColor: "divider"`
- Font: system-ui stack — no brand webfont to load

Editor-window layout conventions (what SignageEditor itself follows): full-height column flex; a 56px vertical icon `Tabs` sidebar (`borderRight: 1`, indicator `left: 0, width: 3`) with `Tooltip placement="right"` on each `Tab`; scrollable content at `p: 2`; footer at `p: 2, borderTop: 1, borderColor: "divider"` holding `Stack direction="row" spacing={1}` with a `contained` Save and an `outlined` Close, both `sx={{ flex: 1 }}`. Form groups use `Stack spacing={2}`; section labels are `Typography variant="subtitle2" fontWeight={600}` (theme renders subtitle2 uppercase).

## Where the truth lives

- `theme` (exported on `window.BeePEE.theme`) — the full MUI theme: palette, per-component style overrides (Paper borders, Tab gold selection, Dialog styling). Read it before inventing a color.
- `styles.css` — global resets (body margin, button base, scrollbar hiding classes).
- `components/signages/<Name>.prompt.md` — per-component API and composition examples.
