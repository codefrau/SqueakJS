VM debugging flags
==================
The VM has gated runtime logging for targeted diagnosis. Logs are off by default and only appear when you enable the flags below in the browser console before loading the image:
- window.SqueakDebugVM = true           // enable all VM debug logs
- window.SqueakDebugStream = true       // focus on stream/indexed and primitive-failure logs
- window.SqueakDebugParser = true       // new: logs targeted sends and DNU in parser/scanner paths (charCode, typeTableAt:, scanToken, scanTokens:, next)

Examples
- Enable only parser/scanner logs:
  window.SqueakDebugParser = true
- Enable broader VM logs:
  window.SqueakDebugVM = true

What gets logged with SqueakDebugParser
- site:"send" records with selector, receiver class, argument classes, pc, and method class for:
  - charCode
  - typeTableAt:
  - scanToken
  - scanTokens:
  - next
- site:"dnuPerform" and site:"dnuPerformWithArgs" for doesNotUnderstand routes with receiver/argument classes

Node/headless environment
- You can also set environment variables before starting a headless run:
  - SQUEAK_DEBUG_VM=1
  - SQUEAK_DEBUG_PARSER=1

Debugging network issues
========================

Client-side (browser)
- Enable verbose network logs at runtime without rebuild:
  In DevTools console, set:
    window.SqueakDebugNet = true
  or set Squeak.debugNet = true before initializing SqueakJS.
- Logs include:
  - HTTP/XHR: start, status, and errors
  - Tunnel WS: open/close/errors, fallback attempts, message byte counts
  - DNS over tunnel: lookup start

Server-side
- Enable logs via environment variables when starting the dev server:
  LOG_CONNECT=1 LOG_TUNNEL=1 npm start
- LOG_CONNECT prints CONNECT proxy activity, connection timing, byte counts, and errors.
- LOG_TUNNEL prints WebSocket tunnel attach/upgrade and connection lifecycle.


Character/Byte coercion semantics
=====================================
- String and subclasses:
  - Reads return Character elements in textual access.
  - Writes require Character; SmallInteger writes are rejected.
- ByteString and other byte arrays:
  - Reads return SmallInteger 0..255 unless convertChars is requested; with convertChars, return Character.
  - Writes accept Character or SmallInteger in [0..255]; out-of-range fails.
- Stream primitives align to these rules:
  - primitiveNext (65): returns Character for String and its subclasses; for ByteString, returns SmallInteger unless routing via convertChars.
  - primitiveNextPut: requires Character for String and its subclasses; for ByteString, accepts Character or 0..255 integer.
- VM behavior now uses isKindOf(String) semantics when deciding textual behavior, not exact class equality.

How to validate coercion behavior manually
- Start the demo server:
  - npm install
  - npm start
- In browser console before loading an image:
  - window.SqueakDebugVM = true
  - window.SqueakDebugStream = true
- Load Squeak 5.0 or 6.0 image and run Update.
- Expect:
  - No “Unknown token type”, “MessageNotUnderstood: ByteString>>charCode”, or “Improper store into indexable object” during parser activity.
  - [VMDBG] prim65/prim66/objectAt/objectAtPut logs show Character when accessing String and its subclasses.

SqueakJS: A Squeak VM for the Web and Node.js
 =============================================

SqueakJS is a runtime engine for [Squeak][squeak]</a> Smalltalk written in pure JavaScript. It also works for many other OpenSmalltalk-compatible images.

Embedding a Smalltalk application in your webpage can be as simple as:

    SqueakJS.runSqueak(imageUrl);

but you probably want to give it some more options (refer to the examples).

The interpreter core is divided in a number of `vm.*.js` modules, internal plugins in `vm.plugins.*.js` modules and external plugins in the "plugins" directory. The Just-in-Time compiler is optional ("jit.js") and can be replaced with your own.

There are a number of interfaces:
* browser: the regular HTML interface lets you use SqueakJS on your own web page. Just include "squeak.js".
* headless browser: a headless VM. It lets you use SqueakJS in your browser without a direct UI (you can create your own UI with a plugin). Include "squeak_headless.js" and add an "imageName" parameter to your website URL (eg. https://example.com/my/page.html?imageName=./example.image) or call the Javascript function "fetchImageAndRun('https://example.com/my/example.image')" to start the specified image.
* Node.js: another headless VM. It lets you use SqueakJS as a Node.js application via "node squeak_node.js <image name>".

For discussions, please use the [vm-dev mailing list][vm-dev]. Also, please visit the [project home page][homepage]!

Running it
----------
**Simplest**

* [Run a minimal image][mini]. This is the simple demo included in this repo.
* Or run [Etoys][etoys]. Everything except the image and template files is in this repo.
* Or similarly, [Scratch][scratch], also in here.

**Run your own Squeak image in the browser**

* Drag an image from your local files into the [launcher][run].
* ... and all the other demo pages (see above) accept dropped images, too.

**Run your own Squeak image from the command line**

* Install a recent version of Node.js
* Run example image: `node squeak_node.js headless/headless.image`

**Run an interactive shell based on WebSocket communication with Cuis image**

* Install a recent version of Node.js
* Go to [ws][ws] and execute `start_server.sh` in a first shell and `start_client.sh` in a second shell.
* After initialization it should be possible to issue Smalltalk statements which will be executed in the Smalltalk image.
* Try commands like: `Object allSubclasses size` `1837468731248764723 * 321653125376153761` `Collection allSubclasses collect: [ :c | c name ]`

**Which Browser**

All modern desktop browsers should work. Mobile browsers work too, but most Squeak images assume a keyboard and mouse. YMMV.

Fixes to improve browser compatibility are highly welcome!

If your browser does not support ES6 modules try the full or headless SqueakJS VM as a single file (aka bundle) in the [Distribution][dist] directory.


Installing locally
------------------
* clone the [github repo][repo]:
  ```
  git clone https://github.com/codefrau/SqueakJS.git
  ```
  or download and unpack the [ZIP archive][zip]
* serve the SqueakJS directory using a local web server.

  TIP: If you have Node.js, try
  ```
  cd SqueakJS
  npx serve
  ```
  which will run a webserver on port 3000.
  Or run the bundled demo server (with TCP tunnel support) via
  ```
  npm install
  npm start
  ```
  which serves the repository on http://localhost:3000/run/ with a same-origin tunnel at both /tcp-tunnel and /run/tcp-tunnel, plus an HTTP CONNECT proxy endpoint on the same origin.
* in a web browser, open http://localhost:3000/run/ and pick one of the images, or drag and drop your own

Now Squeak should be running.
The reason for having to run from a web server is because the image is loaded with an XMLHttpRequest which does not work with a file URL. Alternatively, you could just open SqueakJS/run/index.html and drop in a local image.

Using (self contained) bundled files
------------------------------------
* select your preferred type of interface (browser or headless)
* use the appropriate file (`squeak_bundle.js` resp. `squeak_headless_bundle.js`) from the [Distribution][dist] directory
* you can also build minified bundles using `npm run build`

WebAssembly prototype artifacts
--------------------------------
* `npm run build` now also writes WebAssembly artifacts into `dist/wasm/`:
  * `interpreter-prototype.wasm` (binary)
  * `interpreter-prototype.wat` (text form)
  * `interpreter-prototype.json` (metadata)
* Host these files alongside your bundles and serve them with the `application/wasm` MIME type so browsers can use streaming compilation.
* The loader automatically detects Cache Storage support and will cache the binary for subsequent loads. You can override the asset location at runtime via `Squeak.Execution.assets.configureWasmPrototypeAsset({ baseURL: "/my/custom/path/" })`.
* Content-Security-Policy headers must allow WebAssembly compilation. Add either `wasm-unsafe-eval` (preferred) or `unsafe-eval` to the relevant `script-src` directive when the prototype backend is enabled.

Memory configuration
--------------------
SqueakJS images can now tune their memory budget without rebuilding the VM. Memory options may be supplied in several ways:

* Query parameters that use dotted keys, for example:<br>`?memory.headroomMB=256&memory.youngPercent=20&memory.gcThresholdMB=16`
* A JSON blob in the query string:<br>`?memory={"headroomMB":256,"youngSpaceBytes":16777216,"gcThresholdMB":8}`
* Programmatic callers (including `WorkerVMController`) can pass a `memory` object alongside the usual VM options.

Supported fields:

* `headroomMB`, `headroomBytes`, or `headroom` &mdash; increases the heap headroom beyond the image size (defaults to 100 MB). Values can be numbers or strings with `kb/mb/gb` suffixes.
* `youngSpaceRatio`, `youngRatio`, `youngPercent`, or `youngSpacePercent` &mdash; sets the fraction (up to 0.5) of total memory that the allocator may use for new objects before triggering a partial GC. You can also force an absolute limit via `youngSpaceBytes` / `youngSpaceMB`.
* `gcThresholdMB`, `gcThresholdBytes`, `lowSpaceMB`, or `lowSpaceBytes` &mdash; adjusts the low-space warning threshold that raises the image semaphore (defaults to 1 MB).

The VM tracks new and young allocations against these limits. When the configured budget is exceeded it schedules a partial GC from JavaScript, and the interpreter uses the updated low-space threshold when notifying the Smalltalk image. All memory counters reported through `vmParameterAt:` and `primitiveBytesLeft` reflect the new accounting so tooling inside the image stays in sync.

Memory telemetry
----------------
Memory usage snapshots are now collected while the VM runs. Telemetry is enabled by default in both browser and worker configurations and can be tuned (or disabled) via the same option sources as the memory budget:

* `memoryTelemetry=false` &mdash; disables periodic sampling entirely.
* `memoryTelemetry.intervalMs` &mdash; sampling cadence in milliseconds (defaults to 2000). Set to `0` to keep telemetry available without scheduling an interval.
* `memoryTelemetry.maxSamples` &mdash; cap on the in-memory history buffer (defaults to 120 samples).
* `memoryTelemetry.logEvery` &mdash; write a console summary every _N_ samples (defaults to 30, set to `0` to disable logging).
* `memoryTelemetry.lowSpaceWarnMultiple`, `memoryTelemetry.freeWarnRatio`, `memoryTelemetry.heapWarnRatio` &mdash; thresholds that control when browser warnings are emitted as the VM approaches its configured limits.

Smalltalk code can query the data via `vmParameterAt:`:

* `Smalltalk vmParameterAt: 68` &mdash; returns the latest snapshot as an Array.
* `Smalltalk vmParameterAt: 69` &mdash; returns the bounded history as an Array of Arrays (most recent sample last).

Each snapshot array follows this layout:

Streaming image loading
-----------------------
Large images no longer require a full download before the VM begins bootstrapping. When the host supports Fetch streaming, SqueakJS consumes the response as an async iterator, hydrates objects while bytes arrive, and reuses the same flow when the VM runs inside a worker.

* Streaming is enabled by default for `.image` downloads. Disable it with `streamImages=false` if you need the legacy XHR path.
* The loader falls back to XHR automatically when Fetch streaming is unavailable or a request fails mid-flight.
* A secondary tee stream persists the image into the browser file store after it finishes downloading so subsequent launches can reuse the cached buffer.

1. Timestamp (milliseconds since epoch)
2. `totalBytes`
3. `oldSpaceBytes`
4. `youngSpaceBytes`
5. `newSpaceBytes`
6. `usedBytes`
7. `freeBytes`
8. `youngAllocatedBytes`
9. Configured `headroomBytes` (or nil)
10. Configured `lowSpaceBytes` (or nil)
11. Configured `newSpaceLimit` (or nil)
12. Configured `youngSpaceRatio` (or nil)
13. Explicit young-space byte limit (or nil)
14. Browser `usedJSHeapSize` (if `performance.memory` is available)
15. Browser `totalJSHeapSize` (if available)
16. Browser `jsHeapSizeLimit` (if available)
17. `navigator.deviceMemory` in gigabytes (if available)
18. Sample reason (string)

When telemetry is active the VM emits warnings as it nears configured low-space thresholds or when the host JavaScript heap approaches its limit, helping large images react before browser GC intervention.

Adaptive memory management
--------------------------
The VM now monitors free space and host heap pressure to adjust its allocation headroom on the fly. When enabled, the adaptive manager expands the JavaScript-side heap when free space becomes tight and the browser still has headroom, and contracts the allocation budget when the browser heap approaches its quota so the image can shed memory before the tab is terminated.

Adaptive behaviour is on by default and can be tuned (or disabled) alongside the other memory options:

* `memoryAdaptive=false` &mdash; disables adaptive headroom management entirely.
* `memoryAdaptive.intervalMs` &mdash; evaluation cadence in milliseconds (defaults to 2500). Set to `0` to only react when `poke`d manually.
* `memoryAdaptive.growStepMB` / `memoryAdaptive.shrinkStepMB` &mdash; size of each expansion or contraction step (defaults to 8 MB / 6 MB).
* `memoryAdaptive.minimumFreeMB` &mdash; guard space that must remain available for new allocations after a shrink (defaults to 2 MB).
* `memoryAdaptive.hostPressureRatio` / `memoryAdaptive.hostCriticalRatio` &mdash; browser heap usage ratios that trigger shrink decisions or mandatory partial GCs (defaults to 0.88 / 0.94).
* `memoryAdaptive.hostUsageCapRatio` &mdash; maximum fraction of the browser heap the VM will claim, ensuring at least ~10 % remains free for the host runtime (defaults to 0.9).
* `memoryAdaptive.hostReserveRatio` / `memoryAdaptive.hostReserveBytes` &mdash; extra guard bands that are always kept free in addition to the usage cap.
* `memoryAdaptive.maxHeadroomMB` / `memoryAdaptive.minHeadroomMB` &mdash; absolute bounds the adaptive manager will respect, useful for images with known working-set limits.

Each adjustment records its latest decision on `vm.memoryAdaptive.lastDecision`, making it easy to diagnose why the VM grew or shrank the heap during long-running sessions or when running automated regression suites.

How to modify it
----------------
* use any text editor
* you have to reload the page for your changes to take effect

How to share your changes
-------------------------
* easiest for me is if you create a [pull request][pullreq]
* otherwise, send me patches

Contributions are very welcome!

Same-origin TCP tunnel
----------------------
SqueakJS can tunnel TCP-like sockets over a same-origin WebSocket so images can use networking seamlessly in the browser.

Client options (enabled by default):
- enableTcpTunnel: set to false to disable tunneling
- tcpTunnelPath: WebSocket endpoint path (default "/tcp-tunnel"); clients hosted under a subpath like "/run/" will also work out of the box due to the server mounting the tunnel at both /tcp-tunnel and /run/tcp-tunnel, with or without a trailing slash
- proxy: optional HTTP proxy URL; when set to same-origin, HTTPS requests may use the HTTP CONNECT proxy exposed by the demo server

HTTP-over-tunnel fallback:
- For HTTP(S) requests issued via SocketPlugin’s HTTP path, SqueakJS first uses fetch/XMLHttpRequest (with a proxy retry).
- If those fail and tunneling is enabled, SqueakJS automatically falls back to sending the raw HTTP request over the same-origin tunnel and streams the response back.
- This makes Smalltalk image self-updates work seamlessly without CORS changes.

Same-origin and protocol:
- The tunnel WebSocket always targets the app’s origin host:port and uses the same scheme (https -> wss, http -> ws).

Example:
- SqueakJS.runSqueak(imageUrl, canvas, { enableTcpTunnel: true, tcpTunnelPath: "/tcp-tunnel" })

Server example:
- A minimal Node.js tunnel server is provided at tools/tcp-tunnel.js. It exposes a WebSocket endpoint that bridges to a TCP socket on the server.
- The bundled demo server (run/server.js) mounts the WebSocket tunnel on both /tcp-tunnel and /run/tcp-tunnel to support subpath hosting, and also exposes an HTTP CONNECT proxy on the same origin for HTTPS tunneling.
- Start the standalone tunnel with:
  - TUNNEL_PORT=8081 TUNNEL_PATH=/tcp-tunnel node tools/tcp-tunnel.js
- Security and allowlists:
  - Same-origin only (deploy under your app’s origin and use wss in production)
  - Allowlist configurable server-side via TUNNEL_ALLOW_HOSTS and TUNNEL_ALLOW_PORTS
  - Defaults allow all hosts and ports; set TUNNEL_ALLOW_HOSTS to a comma-separated list to restrict (use "*" to allow all), and TUNNEL_ALLOW_PORTS (e.g., "80,443") to restrict ports.

Wire protocol:
- Client sends a JSON text frame: {"t":"c","h":"host","p":port}
- Server replies with {"t":"ok"} or {"t":"err",...}
- Raw data is exchanged as binary WebSocket frames
- Remote close is signaled via {"t":"rc"}

Path resolution and fallback:
- tcpTunnelPath can be:
  - a fully-qualified ws:/wss: URL (advanced), which will be used as-is
  - an absolute path like "/tcp-tunnel"
  - a relative path like "tcp-tunnel", resolved against the app’s base path (document.baseURI or the directory of location.pathname)
- Default is a relative "tcp-tunnel", so when the app is served under a subpath (e.g., "/squeak/"), the tunnel resolves to "/squeak/tcp-tunnel".
- If the initial tunnel URL fails to upgrade (e.g., 404), the client will retry once against the default absolute "/tcp-tunnel". The demo server accepts both on the same origin (/run/tcp-tunnel and /tcp-tunnel), with or without trailing slash, to make this fallback seamless.
HTTP CONNECT proxy:
- The demo server also implements an HTTP CONNECT proxy on the same origin. Point SqueakJS.options.proxy to the same-origin URL (e.g., `http://localhost:3000`) to allow HTTPS requests to tunnel via CONNECT when needed.
- Defaults allow proxying to any host and port; restrict using TUNNEL_ALLOW_HOSTS and TUNNEL_ALLOW_PORTS in production.

Things to work on
-----------------
DNS-over-tunnel:
- DNS name resolution is performed via the same-origin tunnel server, avoiding browser DoH/CORS/TLS issues.
- Completely transparent to the Smalltalk image; results are cached client-side with TTL as before.
SqueakJS is intended to run any Squeak image. It can already load any image from the original 1996 Squeak release to the latest Cog-Spur release, including 64-bit and Sista variants. But various pieces (primitives in various plugins) are still missing, in particular 3D graphics and networking (however, see [Croquet][jasmine] which supports both, but should be generalized). Also, we should make pre-Spur 64 bit images load. And, it would be nice to make it work on as many browsers as possible, especially on mobile touch devices.

As for optimizing the way to go is an optimizing JIT compiler. The current JIT is very simple and does not optimize at all, it only eloiminates the interpreter's instruction decoding overhead. Since we can't access or manipulate the JavaScript stack, we might want that compiler to inline as much as possible, but keep the call sequence flat so we can return to the browser at any time. Even better (but potentially more complicated) is actually using the JavaScript stack, just like Eliot's Stack VM uses the C stack. I have done some [advanced JIT mockups][jit]. To make BitBlt fast, we could probably use WASM or even WebGL.

To make SqueakJS useful beyond running existing Squeak images, we should use the JavaScript bridge to write a native HTML UI which would certainly be much faster than BitBlt (Craig Latta has done some interesting work towards that in [Caffeine][caffeine]).

Better Networking would be interesting, too. The SocketPlugin currently does allows HTTP(S) requests and WebSockets. How about implementing low level Socket support based on HTTP-tunneling? The VM can run in a WebWorker. How about parallelizing the VM with WebWorkers?

Also interesting would be wrapping it in a native app, maybe via [Electron][electron] similar to [Sugarizer][sugarizer], which uses SqueakJS to run Etoys.

There's a gazillion exciting things to do :)

  --  Vanessa Freudenberg (codefrau)

  [squeak]:   https://squeak.org/
  [repo]:     https://github.com/codefrau/SqueakJS
  [vm-dev]:   http://lists.squeakfoundation.org/mailman/listinfo/vm-dev
  [homepage]: https://squeak.js.org/
  [run]:      https://squeak.js.org/run/
  [mini]:     https://squeak.js.org/demo/simple.html
  [etoys]:    https://squeak.js.org/etoys/
  [scratch]:  https://squeak.js.org/scratch/
  [jasmine]:  https://github.com/codefrau/jasmine
  [caffeine]: https://caffeine.js.org/
  [jit]:      https://squeak.js.org/docs/jit.md.html
  [ws]:       https://github.com/codefrau/SqueakJS/tree/main/ws
  [dist]:     https://github.com/codefrau/SqueakJS/tree/main/dist
  [zip]:      https://github.com/codefrau/SqueakJS/archive/main.zip
  [pullreq]:  https://help.github.com/articles/using-pull-requests
  [electron]: https://www.electronjs.org
  [sugarizer]: https://github.com/llaske/sugarizer


Changelog
---------
    2025-05-04: 1.3.3 minor FFI, OpenGL, and other fixes/improvements
    2025-04-06: 1.3.2 use our own CORS proxy, add welcome=false option, minor fixes
    2025-03-29: 1.3.1 add 'w', 'h', 'embedded' canvas options, minor fixes
    2025-03-28: 1.3.0 add OpenGL support, canvas is optional, fix socket plugin bug
    2025-02-19: 1.2.4 fix isAssociation for JS Bridge, optimize loading image with many objects
    2024-09-28: 1.2.3 fix primitiveInputSemaphore, fix iOS keyboard
    2024-06-22: 1.2.2 make copy/paste work on mobile
    2024-05-27: 1.2.1 add virtual cmd button, fix touch events
    2024-03-25: 1.2.0 add FFI and MIDI plugins, JIT for Sista bytecodes, JPEG write prim, fix keyboard input, copy/paste, scroll wheel, highdpi, allow ES6 in source
    2023-11-24: 1.1.2 fixed BitBlt bug (symptom reported 9 years ago, thanks to Agustin Martinez for narrowing it down), add object pinning, support keyboard in ancient Scratch images
    2023-10-24: 1.1.1 workarounds for Cuis 6
    2023-10-23: 1.1.0 implement Etoys project saving (image segment export), drag-n-drop directories
    2023-09-30: 1.0.6 fixes
    2022-11-19: 1.0.5 fixes, add highdpi mode, add image format for Squeak 6
    2021-05-31: 1.0.4 fixes
    2021-03-21: 1.0.3 headless fixes (Erik Stel); fixes object-as-method
    2021-02-07: 1.0.2 new one-way become prim (Christoph Tiede); JIT-compile Array at:/at:put:
    2021-01-05: 1.0.1 fixes some primitives to properly pop the stack
    2020-12-20: 1.0 supports 64 bits and Sista
    2020-06-20: renamed "master" branch to "main"
    2020-06-20: 0.9.9 JSBridge additions (Bill Burdick), fixes
    2020-04-08: renamed github account to "codefrau"
    2020-01-26: 0.9.8 split into modules (Erik Stel), fixes
    2019-01-03: 0.9.7 minor fixes
    2018-03-13: 0.9.6 minor fixes
    2016-11-08: 0.9.5 more fixes
    2016-10-20: 0.9.4 fixes
    2016-09-08: 0.9.3 add partial GC (5x faster become / allInstances)
    2016-08-25: 0.9.2 add keyboard on iOS
    2016-08-03: 0.9.1 fixes
    2016-07-29: 0.9 Spur support, stdout, SpeechPlugin, zipped images
    2016-06-28: 0.8.3 add SocketPlugin for http/https connections
    2016-04-07: 0.8.2 better touch handling, debugging, CORS, lint
    2016-01-08: 0.8.1 windows keyboard fixes, 'new' operator fixed
    2015-11-24: 0.8 minor fixes
    2015-08-13: 0.7.9 make work on iOS again
    2015-07-18: 0.7.8 fix keyboard
    2015-06-09: 0.7.7 fix thisContext
    2015-04-27: 0.7.6 revert JIT, minor fixes
    2015-04-14: 0.7.5 JIT optimizations by HPI students (reverted in 0.7.6)
    2015-02-18: 0.7.4 make pre-release image work
    2015-01-30: 0.7.3 JSBridge: fix closure callbacks
    2015-01-25: 0.7.2 JSBridge: add asJSObject
    2014-12-22: 0.7.1 cursor shapes
    2014-12-04: 0.7 support finalization of weak references
    2014-11-28: 0.6.8 JSBridge with callbacks
    2014-11-20: 0.6.7 implement JavaScriptPlugin
    2014-11-18: 0.6.6 implement DropPlugin
    2014-11-14: 0.6.5 add generated Balloon2D plugin
    2014-11-06: 0.6.4 add generic run page
    2014-10-28: 0.6.3 pass options via URL
    2014-10-27: add JPEG plugin
    2014-10-25: add template files
    2014-10-23: 0.6.2 fixes
    2014-10-21: 0.6.1 add image segment loading
    2014-10-18: 0.6 move squeak.js out of lib dir
    2014-10-13: 0.5.9 microphone support
    2014-10-09: 0.5.8 fixes
    2014-10-07: 0.5.7 even more plugins generated
    2014-10-07: 0.5.6 add quitSqueak and onQuit
    2014-10-07: 0.5.5 generated ScratchPlugin
    2014-10-06: 0.5.4 replace BitBltPlugin by generated
    2014-10-06: 0.5.3 SoundGenerationPlugin, Matrix2x3Plugin, FloatArrayPlugin
    2014-10-05: ZipPlugin
    2014-10-04: MiscPrimitivePlugin
    2014-10-03: VMMakerJS generates LargeIntegersPlugin
    2014-09-30: 0.5.2 more JIT
    2014-09-28: 0.5.1 JIT fixes
    2014-09-26: 0.5 add JIT compiler
    2014-09-22: v8 optimizations
    2014-09-20: 0.4.6 sound output support
    2014-09-13: 0.4.5 clipboartd fixes
    2014-09-12: 0.4.4 cut/copy/paste in stand-alone
    2014-09-09: 0.4.3 some scratch prims
    2014-09-09: 0.4.2 idle fixes
    2014-09-05: 0.4.1 scratch fixes
    2014-09-04: 0.4.0 runs scratch
    2014-08-31: switch old/new primitives
    2014-08-27: event-based input
    2014-08-21: exception handling
    2014-07-25: 0.3.3 fullscreen support
    2014-07-18: 0.3.2 benchmarking (timfel)
    2014-07-18: 0.3.1 deferred display
    2014-07-16: 0.3.0 closure support
    2014-07-14: 0.2.3 IE optimization (timfel)
    2014-07-11: 0.2.2 drag-n-drop
    2014-07-07: 0.2.1 fixes for IE11 (timfel)
    2014-07-04: 0.2 runs Etoys
    2014-06-27: Balloon2D (krono)
    2014-06-03: stand-alone version
    2014-05-29: 0.1 added version number
    2014-05-27: WarpBlt
    2014-05-07: image saving
    2014-04-23: file support
    2013-12-20: public release
    2013-12-14: colored bitblt
    2013-12-03: first pixels on screen
    2013-11-29: GC
    2013-11-22: runs 43 byte codes and 8 sends successfully
    2013-11-07: initial commit
