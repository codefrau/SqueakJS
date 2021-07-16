SqueakJS: A Squeak VM for the Web and Node.js
=============================================

SqueakJS is an HTML5 runtime engine for [Squeak][squeak]</a> Smalltalk written in pure JavaScript. It also works for many other OpenSmalltalk-compatible images.

Embedding a Smalltalk application in your webpage can be as simple as:

    SqueakJS.runSqueak(imageUrl, canvas, { fullscreen: true });

The interpreter core is divided in a number of `vm.*.js` modules, internal plugins in `vm.plugins.*.js` modules and external plugins in the "plugins" directory. The Just-in-Time compiler is optional ("jit.js") and can be easily replaced with your own.

There are a number of interfaces:
* browser: the regular HTML interface lets you use SqueakJS on your own web page. Just include "squeak.js".
* headless browser: a headless VM. It lets you use SqueakJS in your browser without a direct UI (you can create your own UI with a plugin). Include "squeak_headless.js" and add an "imageName" parameter to your website URL (eg. https://example.com/my/page.html?imageName=./example.image) or call the Javascript function "fetchImageAndRun('https://example.com/my/example.image')" to start the specified image.
* Node.js: another headless VM. It lets you use SqueakJS as a Node.js application. Just run "node squeak_node.js <image name>".

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

All modern browsers should work (Chrome, Safari, IE, FireFox), though Chrome performs best currently. Safari on iPad works somewhat. YMMV.
Fixes to improve browser compatibility are highly welcome!

If your browser does not support ES6 modules try the full or headless SqueakJS VM as a single file (aka bundle) in the [Distribution][dist] directory.


Installing locally
------------------
* download and unpack the [ZIP archive][zip] (or clone the [github repo][repo])
* serve the SqueakJS directory using a local web server.

  TIP: If you have python try out something like
  ```
  python -m SimpleHTTPServer 9090
  ```
* in your web browser, open the SqueakJS/demo/simple.html file

Now Squeak should be running.
The reason for having to run from a web server is because the image is loaded with an XMLHttpRequest which does not work with a file URL. Alternatively, you could just open SqueakJS/run/index.html and drop in a local image.

Using (self contained) bundled files
------------------------------------
* select your preferred type of interface (browser or headless)
* use the appropriate file (`squeak_bundle.js` resp. `squeak_headless_bundle.js`) from the [Distribution][dist] directory

How to modify it
----------------
* use any text editor
* you have to reload the page for your changes to take effect

How to share your changes
-------------------------
* easiest for me is if you create a [pull request][pullreq]
* otherwise, send me patches

Contributions are very welcome!

Things to work on
-----------------
SqueakJS is intended to run any Squeak image. It can already load any image from the original 1996 Squeak release to the latest Cog-Spur release, including 64-bit and Sista variants. But various pieces (primitives in various plugins) are still missing, in particular media support (MIDI, 3D graphics). Also, we should make pre-Spur 64 bit images load, and add a JIT for SISTA bytecodes. And, it would be nice to make it work on as many browsers as possible, especially on mobile touch devices.

As for optimizing I think the way to go is an optimizing JIT compiler. The current JIT is very simple and does not optimize at all. Since we can't access or manipulate the JavaScript stack, we might want that compiler to inline as much as possible, but keep the call sequence flat so we can return to the browser at any time. Even better (but potentially more complicated) is actually using the JavaScript stack, just like Eliot's Stack VM uses the C stack. To make BitBlt fast, we could probably use WebGL.

To make SqueakJS useful beyond running existing Squeak images, we should use the JavaScript bridge to write a native HTML UI which would certainly be much faster than BitBlt.

Better Networking would be interesting, too. The SocketPlugin currently does allows HTTP(S) requests and WebSockets. How about implementing low level Socket support based on HTTP-tunneling? The VM can run in a WebWorker. How about parallelizing the VM with WebWorkers?

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
  [ws]:       https://github.com/codefrau/SqueakJS/tree/main/ws
  [dist]:     https://github.com/codefrau/SqueakJS/tree/main/dist
  [zip]:      https://github.com/codefrau/SqueakJS/archive/main.zip
  [pullreq]:  https://help.github.com/articles/using-pull-requests


Changelog
---------
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
