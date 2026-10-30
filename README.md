# Daily Slide

A sliding-tile puzzle with one new puzzle every day, built for YouTube Playables. Original code, original generated art, no third-party assets.

**Status: prepared build with unverified platform integration.** It has been tested against a mock of the Playables SDK in desktop Chrome (headless) only. It has NOT been run through YouTube's official test suite, the Developer Portal, the YouTube app, Safari, Firefox or Edge. Do not treat it as certified or ready to publish until the official suite passes.

## Play

- Tap, click or swipe a tile next to the gap to slide it into the gap. Only the tile touching the gap moves, one tile per move.
- Keyboard: an arrow key moves the tile that can move in that direction (Left moves the tile on the right of the gap to the left). Enter or Space press the focused button. Esc closes a dialog.
- Daily puzzle: seeded from the local date (YYYYMMDD), the same puzzle for everyone on a given day, solvable by construction. Size by weekday: Mon and Tue 3x3, Wed to Fri 4x4, Sat and Sun 5x5. Only Monday 3x3 and Sunday 5x5 were specified, so Tue to Sat is a design choice you can change in `sizeForDay` (logic.js).
- Stars: 3 at or under par, 2 up to 1.5x par, otherwise 1. Score = total stars over distinct solved daily puzzles. Practice games (3x3, 4x4, 5x5) never change the score.

## Files

| File | Purpose |
|---|---|
| `src/index.html` | Loads the YouTube SDK first, then the game scripts. |
| `src/sdk.js` | Wrapper around `ytgame`. In-memory stubs when the SDK is missing or `IN_PLAYABLES_ENV` is false. |
| `src/strings.js` | All UI text in one `STRINGS` object (English). Add a language by adding a key. |
| `src/logic.js` | Seeded scramble, solvability, par, stars, streaks. Pure functions. |
| `src/save.js` | Versioned save (v2), migrations, validation, size cap. |
| `src/audio.js` | Synthesized sound effects, gated by the YouTube audio setting. |
| `src/art.js` | Procedural board art from a seed. |
| `src/ui.js` | Layout, board drawing, dialogs. |
| `src/game.js` | Boot sequence, input, timer, pause, saving, score. |
| `tools/build.js` | Builds `dist/daily-slide.zip` with `index.html` at the ZIP root and checks the bundle rules. |
| `tools/preview.html` | Live preview of all nine aspect ratios side by side. |
| `tests/unit.test.js` | Logic, save and migration tests (portable, Node only). |
| `tests/browser/` | The Chrome DevTools scripts used for the browser checks (see Tests). |

## Build

```
node tools/build.js
```

Node 18 or newer, no dependencies. Output: `dist/daily-slide.zip` (10 files, about 20 KB zipped). The script fails if a file name has characters outside letters, digits, `_`, `-`, `.`, if the SDK script is not the first script, if any reference is absolute or external (other than the SDK URL), or if a forbidden storage API shows up in the source.

## Preview all nine ratios

Open `tools/preview.html` from the project folder in a browser. It shows 9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9 and 32:9 side by side, each a live game at a real pixel size scaled to fit. The sliders change the short side and display scale. Outside YouTube nothing is saved between reloads, by design.

To run one ratio by hand, open `src/index.html` and resize the window or use the browser's device toolbar. When the SDK script cannot load (offline) the game uses its stubs.

## Requirements matrix

Sources: https://developers.google.com/youtube/gaming/playables/certification/requirements_design , .../requirements_integration , .../requirements_stability , .../requirements_monetization (all read 2026-10-30), and the SDK reference https://developers.google.com/youtube/gaming/playables/reference/sdk .

"Test" names the check I ran. "Official suite" means the item still has to be confirmed there.

### Design

| Requirement | Implementation | Test |
|---|---|---|
| Responsive in all aspect ratios (9:32, 9:21, 9:16, 3:4, 1:1, 4:3, 16:9, 21:9, 32:9) | `ui.js layout()` picks portrait (HUD above, tools below) or landscape (HUD left, tools right), whichever gives the larger square board, and reflows panels into rows or columns. | Automated geometry check at all nine ratios, short side 360, 240, 160 and 120 px, daily 4x4 and 5x5: nothing outside the viewport, no overlaps, board square, text not clipped. Also menu, stats and results dialogs. Screenshots reviewed at 360. Where the board cannot be at least 44 px per tile, the game uses a scroll mode with a minimum board of 44 px per tile, so the layout fits the window only above that size. The automated check has been run down to a 120 px short side and passes everything except the expected sideways overflow in scroll mode. |
| Fill the viewport or center with pillarbox or letterbox | Board is a centered square, panels at the edges. | Same check, plus the screenshots. |
| No orientation or posture lock | No orientation APIs used. | Source grep. |
| Keep state on resize | Resize only re-lays-out and redraws. | Resized live between six sizes with a move made and a setting changed: board, move count and setting preserved, no reload. |
| Touch, mouse and keyboard for all interactions | Pointer events (tap, swipe, mouse), arrow keys, native buttons. | A full daily solved with mixed touch taps, mouse swipes and arrow keys. Enter and Space activate focused buttons. |
| Don't delay or ignore input | Moves apply instantly; animation is visual only. | Rapid input in the solve runs. |
| No errors or unexpected UI behavior | Errors go to `health.logError`/`logWarning`. | No console errors in every run. Bug found and fixed: the tap that finished a puzzle clicked through to the results dialog. |
| Esc closes dialogs, never `preventDefault` on Esc | Esc handler closes dialogs and does not prevent default. | Test confirms the dialog closes and `defaultPrevented` is false. |
| Crisp text and graphics | Canvas is sized by `devicePixelRatio`; DOM text for everything else. | Visual review at DPR 2. Not tested on other densities. |
| Content completion message | After the daily puzzle: "That is all of today's daily puzzles" and a countdown. Practice is unlimited. | Visual and text check. |
| No sharing, external links, extra agreements | None exist. | Source grep: no `<a>`, no `href`, no `window.open`, no navigator.share, no clipboard. |
| No buttons identical to Playables actions, no exit or quit | The button that returns to the start screen is labeled "Home". There is no exit, quit, close or mute button. | UI inspection. Whether "Home" is acceptable is for the official review. |
| No branding or logos | None. | Visual. |
| Haptics toggle if used | No haptics. | Source grep. |

### Integration

| Requirement | Implementation | Test |
|---|---|---|
| SDK loaded before any game code | First script in `<head>`. | Check on the DOM, and `tools/build.js` enforces it. |
| `firstFrameReady` on a loading screen | Called after the splash in the HTML has painted, before the save loads. | Call order in the mock log. |
| `gameReady` only when interactive, once | Called once after the main menu is shown. If loading hangs, the menu appears after 4 s. | Call order, once only, menu visible at that moment, within 5 s when `loadData` hangs. |
| Scores: `sendScore` per spec, best sent matches best saved | Integer total stars, sent only after the matching save succeeded; `bestScoreSent` is recorded after the send resolves. A failed send is retried at the next launch. | Value equals saved total; send follows save; failure and retry; no resend when already sent. |
| Cloud save with `saveData`/`loadData`, no other storage | One JSON string, v2, under 2 KB in practice (capped at 100 KB). Saved after each solve, setting change and daily move, never on unload. No localStorage, sessionStorage, cookies or IndexedDB. | Storage empty after play; source grep; save content checks. |
| Await `loadData` before `saveData` | The wrapper refuses to save until a load succeeded. | Load failure and hang tests: no saves. |
| Use old save versions without errors | `save.js` migrates v1, validates every field and drops invalid progress. Unknown newer versions are read, shown, and never overwritten. | Unit tests (hostile values, corrupt JSON, v1, future v9) and browser tests. |
| Audio follows `isAudioEnabled` and `onAudioEnabledChange`, no unexpected sound | Context created only after a user gesture and only when enabled; sound only after a user move or a win. No mute button. | AudioContext count: 0 before a gesture; 0 with audio off; sound allowed after the callback turns it on. |
| Pause: stop all execution on `onPause`, resume only on `onResume`, no Page Visibility | Pause cancels the frame loop, stops the puzzle timer, suspends audio, ignores input, and blocks SDK calls. One save starts at the moment of pause (the docs say SHOULD save on pause). | No frames, draws, timers or SDK calls while paused; input ignored; paused time not counted; blur, visibilitychange and pagehide do not pause; pause during boot, and with a save or score in flight. |

### Stability

| Requirement | Implementation | Test |
|---|---|---|
| Bundle size, file size, file count | 10 files, about 57 KB unzipped, largest file 21 KB. | `tools/build.js` output. |
| Load in under 5 s | Small bundle, no assets. | `gameReady` about 20 ms after load in the mock. Real network and device not measured. |
| Relative paths, safe file names | Relative references only. | `tools/build.js` checks. |
| JS heap under 512 MB, no leaks | One canvas, reused arrays, no per-frame allocation to speak of. | 30 practice puzzles solved through real input: heap about 0.9 MB and unchanged DOM node count after the 10th puzzle (+~50 KB from puzzle 10 to 30). |
| Standard web APIs, all supported browsers, YouTube Android and iOS app | ES5-style JavaScript, Canvas 2D, Pointer Events. | Chrome only. Not run on Safari, Firefox, Edge or the YouTube app. |
| Date rollover while playing | The puzzle in progress keeps its own date and can be finished; the results dialog then offers the new daily. The menu refreshes at midnight and on resume. | Rolled midnight mid-puzzle, finished it, started the next day's puzzle: streak 2, score correct. Rollover during pause handled on resume. |
| Corrupt save | Reset to defaults with a note. | Unit and browser tests. |

### Monetization and safety

No ads, purchases, accounts, external links, clipboard, or network requests (the only request is the SDK script). Confirmed in the source and in the request log of every run.

## Known conflicts and limits

- **Touch target size on small viewports.** Buttons (Undo, Target, 123, Home, menu buttons) are always at least 44 px tall. Tiles are touch targets too, and a tile is board size divided by the grid size. The layout therefore never lets the board go below 44 px per tile (220 px for 5x5, 176 px for 4x4, 132 px for 3x3). When the window is too small to fit that, the game switches to a scroll mode: the page scrolls (down, and sideways if the window is narrower than the board plus margins) instead of shrinking tiles. Examples from the layout code: a 360x360 window fits a 236 px board without scrolling (5x5 tile 47 px); a 240x240 window scrolls with a 220 px 5x5 board (tile 44 px) and the HUD and tool rows below it. Below about 236 px wide a 5x5 board is wider than the window and has to be panned sideways, and then the HUD and board are not visible together. Swipes on the board play the game, so panning there uses the page scrollbar or a drag that starts outside the board. This is a documented limitation for extremely small windows, not a pass. Not re-measured on a real phone.

- `health.logError()` and `logWarning()` take no arguments in the SDK reference, so they only signal that something happened. Caught errors and failed SDK calls call them.
- The docs' example falls back to localStorage outside Playables. This game does not, as specified. In a normal browser nothing is saved across reloads.
- `onPause` fires for all pauses, including exit, and the docs say a resume is not guaranteed. Progress is therefore saved after every change, and the pause-time save is a bonus, not the plan.
- If loading the save fails or hangs, the game still opens but saving is off for that session, so a good save is never overwritten by an empty one. A save written by a newer game version is shown but never overwritten either.
- One boot-only timeout (4 s) exists. If a pause arrives first, its result is applied after resume.
- The frame loop is the only recurring driver; there are no intervals.
- Day sizes Tue to Sat are my choice.
- Only English strings are shipped. `getLanguage()` selects a language if one is added; unknown languages use English.
- Not verified: the official test suite, Developer Portal bundle analyzer, real SDK behavior, Safari, Firefox, Edge, the YouTube app on Android or iOS, other pixel densities, low-end devices, and real-network load time.

## Tests

- `node tests/unit.test.js` (portable). About 47,800 assertions.
- `tests/browser/` holds the DevTools-protocol scripts that were run: functional play, pause and audio, saves and async edge cases, layout at the nine ratios, date rollover, memory. They need Chrome and Node 22, intercept the SDK URL to serve `mock-sdk.js`, and use paths under `/tmp/v2`, so edit those before reuse. Results at the last run: functional 38 checks, pause and audio 22, saves 33, layout 66, rollover 10, memory 4, all passing.
