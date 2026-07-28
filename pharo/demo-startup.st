"SqueakJS Pharo demo — opens a small self-contained Morphic app at boot so visitors
see a real Pharo application running (and animating smoothly) in the browser, not just
the IDE. Pure core Morphic: no FFI, no network. Runs from the image's working directory
via Pharo's startup.st mechanism."
[
| title subtitle balls world |
world := World.

"Start from a clean desktop: close the Welcome window (and any other window) so the
demo is the star. The IDE is still one menu-bar click away."
(world submorphs select: [:m | m isSystemWindow]) do: [:w | w delete].

"Caption, placed to the right of Pharo's own desktop logo (top-left) so both read.
Dark text on the light desktop."
title := StringMorph contents: 'running in your browser'.
title font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 26).
title color: (Color r: 0.11 g: 0.15 b: 0.33).
title position: 440 @ 44.
title openInWorld.
subtitle := StringMorph contents: 'a live Morphic app — no plugins, no server, just SqueakJS.'.
subtitle font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 14).
subtitle color: (Color r: 0.33 g: 0.36 b: 0.45).
subtitle position: 442 @ 82.
subtitle openInWorld.

"A handful of bouncing balls (the classic Smalltalk 'atoms' demo)."
balls := (1 to: 14) collect: [:i | | m |
    m := EllipseMorph new.
    m color: (Color random alpha: 0.85).
    m extent: (28 + 24 atRandom) asPoint.
    m position: (60 + 500 atRandom) @ (70 + 380 atRandom).
    m setProperty: #vx toValue: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
    m setProperty: #vy toValue: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
    m openInWorld.
    m].

"Animate from a process just below the UI so it always gets scheduled between UI
cycles; each ball invalidates its own region so the World redraws it."
[[true] whileTrue: [
    balls do: [:m | | p vx vy w h |
        vx := m valueOfProperty: #vx. vy := m valueOfProperty: #vy.
        w := m width. h := m height.
        p := m position + (vx @ vy).
        (p x < 0 or: [p x > (world width - w)]) ifTrue: [vx := vx negated. m setProperty: #vx toValue: vx].
        (p y < 0 or: [p y > (world height - h)]) ifTrue: [vy := vy negated. m setProperty: #vy toValue: vy].
        m position: (p x max: 0) @ (p y max: 0).
        m changed].
    world changed.
    (Delay forMilliseconds: 25) wait]] forkAt: Processor userSchedulingPriority - 1.
] on: Error do: [:e | Transcript showln: 'demo failed: ', e messageText].
