# Music support — feature design brief

BeePEE is adding a **Music tab** (third main-window tab after Items and Signages) for creating and editing BEE2 music definitions. This brief is the researched spec; design screens should compose the existing BeePEE components and follow the window conventions below.

## What a BEE2 music definition is

A `Music` entry in the package's `info.json`:

- **Identity**: `ID`, `Name`, `Authors`, `Description`, `Group` (UI grouping in BEE2), `ShortName`, `Icon` (96x96 PNG) + `IconLarge` (256x192 PNG)
- **Sample**: a short OGG preview clip (`resources/music_samp/...`) used for listen-before-you-pick
- **SoundScript** — the actual tracks, one per *channel*:
  - `Base` — the ambient background track (WAV preferred, MP3 allowed)
  - `tBeam` — plays while riding an excursion funnel; has a `sync_funnel` toggle (sync timestamps with Base vs start at a random offset)
  - `BounceGel` — one or MANY tracks (`snd` list); one is picked at random per bounce
  - `SpeedGel` — plays during high-speed flings / propulsion gel
- **loop_len** (`"5:44"`) — required for MP3 base tracks (MP3 can't natively loop); BeePEE auto-fills it by decoding the file duration
- **Advanced**: `Children` (borrow a channel from another music ID), `Instance`, `Config`, `Pack`

## UI to design

### 1. Music tab (main window)
- Third icon in the 56px left sidebar (music note icon), same pattern as Items/Signages
- Content: the browser grid — 96x96 icon tiles with dashed placeholder cells filling the row, "+" tile to add
- NEW for music: each tile gets a small **play/pause button** overlay to preview the Sample clip in place
- Tooltip on tile = name; clicking opens the Music editor window

### 2. Music editor window (960x1024, standard editor layout)
- Vertical 56px icon tab rail + content area + footer (Save contained / Close outlined, flex 1 each; Delete outlined error, right-aligned)
- Tabs:
  - **Info**: Name, Authors, Description (multiline), Group, ShortName, Icon picker (96x96 preview, click to change), optional large icon
  - **Tracks**: the heart of the editor. One row/card per channel (Base, Funnel, Bounce Gel, Speed Gel). Each channel card: track file field (click to browse), inline play button, duration/`loop_len` readout, remove button. Funnel card has a "Sync with base track" toggle. Bounce Gel card holds a LIST of tracks with add/remove (random pick per bounce). Base is required; others optional/empty state = "not set" like signage style tiles
  - **Sample**: preview-clip picker with play button; hint that BEE2 shows this in its selector
  - **Advanced** (dev-mode gated): Children references, Instance, Config, Pack
- Window title carries `*` when dirty, like all editors

### 3. Add Music flow
- Same two-path pattern as Add Signage: a dialog with ChoiceCard-style options, or straight to a file picker
- Minimal path: pick an audio file (wav/mp3/ogg) → name prompt with auto-suggested name + generated ID preview (`MUSIC_BPEE_NAME_1A2B`) → creates entry with the file as Base track, loop_len auto-filled

## Conventions to respect
- Dark theme, gold primary accent, MUI components (see the synced BeePEE components: SignageEditor is the reference editor-window layout; SignageStyles shows the tile-grid + chips pattern; AddSignageDialog shows the ChoiceCard flow)
- Section labels: subtitle2 fontWeight 600; helper text: caption text.secondary
- Content padding p:2, Stack spacing 2, footer p:2 borderTop divider
- Chips for state ("not set", "pending save") at height 20, fontSize 11
