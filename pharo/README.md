# Pharo support for SqueakJS

Two startup scripts live here. Both use Pharo's own mechanism: name the file `startup.st`,
place it next to the `.image`, and `StartupPreferencesLoader` runs it at boot. The hosted
zip bundles ship them that way.

State of Pharo support (see `../ESTADO.md` for the full picture):

- **32-bit** — boots clean and is fully interactive.
- **64-bit** — boots clean and is interactive too (menus, list selection, dragging
  windows), provided `startup-compat64.st` ships next to the image as `startup.st`.

Pharo's git integration (Iceberg → libgit2 through native FFI) used to open a post-mortem
debugger over an otherwise healthy world on *both* builds. The VM now neuters
`LGitLibrary class>>startUp:` (see `hackImage` in `../vm.interpreter.js`), so Pharo runs
git-less — exactly as on a machine without libgit2. No image patching needed.

## `startup-compat64.st`

Restores, at image startup, the classic VM display/input classes that Pharo's **64-bit**
builds no longer ship (they render exclusively through SDL2/OSWindow via native FFI,
which does not exist in the browser):

- `EventSensorConstants`, `InputEventHandler`, `InputEventSensor`, `InputEventFetcher`
  (classic VM event polling), the classic `HandMorph` event-queue methods,
- the classic `DisplayScreen` protocol (`beDisplay`, `forceToScreen:` …),
- `VMWorldRenderer` + its update modes (rendering via Display/BitBlt),
- cursor primitives (`beCursor`, `beCursorWithMask:`),

all extracted verbatim from the Pharo 10 32-bit build (which still ships them), then
reinstalls the UI (`UIManager default:` after clearing `MainWorldRenderer`).

**Usage:** ships inside `Pharo64.zip`. 32-bit images don't need it.

**Also restores `DisplayScreen>>deferUpdates:`** (instance and class side, plus its
`DeferringUpdates` class variable). The 64-bit build's own version never reaches primitive 126,
so nothing was ever batched: each BitBlt hit the screen on its own and Pharo's fading notifications
redrew ~300 times a second, reading as a flicker. With it, drawing matches 32-bit exactly — one
frame per Morphic cycle.

**Gotcha worth keeping:** the script also has to `addSharedPool: EventSensorConstants` to
`HandMorph` *before* compiling the methods it injects there. Those methods reference pool
variables (`EventTypeMouse`, `EventKeyDown`, …); without the pool they compile as undeclared
globals — silently `nil`, since the compiler does not fail — so every event was classified
`#invalid` and the world rendered but ignored all input. Injecting methods into an existing
class does not bring along the scope they need. See `../ESTADO.md` §4.2.

## `demo-startup.st`

A small self-contained Morphic app, so visitors see a real Pharo application running (and
animating) in the browser rather than just the IDE. Closes the Welcome window, draws a
caption next to Pharo's desktop logo, and bounces 14 balls around the world. Core Morphic
only — no FFI, no network. The full IDE stays one menu-bar click away.

**Usage:** publish `Pharo-demo.zip` = the contents of `Pharo.zip` plus this file renamed to
`startup.st` at the root of the zip.

**Also restores `DisplayScreen>>deferUpdates:`** (instance and class side, plus its
`DeferringUpdates` class variable). The 64-bit build's own version never reaches primitive 126,
so nothing was ever batched: each BitBlt hit the screen on its own and Pharo's fading notifications
redrew ~300 times a second, reading as a flicker. With it, drawing matches 32-bit exactly — one
frame per Morphic cycle.

**Gotcha worth keeping:** the animation process must run at `userSchedulingPriority - 1` and
invalidate explicitly (`m changed` per ball, then `world changed` per frame). Forking it at
`userBackgroundPriority` never got scheduled — the balls rendered once and stayed frozen.
