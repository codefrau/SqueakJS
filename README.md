SqueakJS: A Lively Squeak VM
============================

This GitHub repository contains mainly the interpreter. The HTML user interface is written using the Lively Kernel.
The "demo" directory contains a bare-bones html page, just enough to run the VM, and a "mini.image" (a stripped-down Squeak 2.2).
The "etoys" directory has an html page to run an Etoys image from an external server, and "scratch" runs a Scratch image.
Please visit the [project home page][homepage]!

Running it
----------
**Simplest**

* [click here][simple] to run a minimal version. This is the simple demo included in this repo.
* or [click here][etoys] to run Etoys. Everything except the image is in this repo.
* or [here][scratch] for Scratch, also in here.
* Go to the [full SqueakJS][full] page with the Lively interface.

**Run your own Squeak image**

* Drag an image from your local files into the [simple][simple] or [Lively][full] page.

**Which Browser**

All modern browsers should work (Chrome, Safari, IE, FireFox), though Chrome performs best currently. Safari on iPad works somewhat. YMMV.
Fixes to improve browser compatibility are highly welcome!


Installing locally
------------------
**Without Lively (simpler)**

* download and unpack the [ZIP archive][zip] (or clone the [github repo][repo])
* serve the SqueakJS directory using a local web server.
  TIP:If you have python try out something like
  ```python
  python -m SimpleHTTPServer 9090
  ```        
  
* in your web browser, open the SqueakJS/demo/simple.html file

Now Squeak should be running.
The reason for having to run from a web server is because the mini.image is loaded with an XMLHttpRequest which does not work with a file URL.

**In Lively (nicer)**

* install [Lively][lively]
* inside the Lively directory, make a "users/bert" folder and put the SqueakJS directory there
* open the blank.html page using your web browser
* get a Squeak morph from the PartsBin
* save the world under a different name 

How to modify it
----------------
**In Lively**

* if you installed with Lively, use that to change the code
* all changes take effect immediately

**Without Lively**

* use any text editor
* you have to reload the page for your changes to take effect

How to share your changes
-------------------------
* easiest for me is if you create a [pull request][pullreq]
* otherwise, send me patches, or a Lively Changeset

Contributions are very welcome! 

Things to work on
-----------------
SqueakJS is intended to run any Squeak image. It can already load anything from the original 1996 Squeak release to the latest 2014 release. But many pieces (primitives in various plugins) are still missing, in particular media support (sound in/output, MIDI, 3D graphics, Scratch effects) and networking (Socket plugin). 

As for optimizing I think the way to go is an optimizing JIT compiler. Since we can't access or manipulate the JavaScript stack, we might want that compiler to inline as much as possible, but keep the call sequence flat so we can return to the browser at any time. To make BitBlt fast, we could probably use WebGL. Besides, there is the obvious not-yet-implemented primitives which fall back to slow Smalltalk code (LargeIntegers, compression/decompression, string search etc).

There's also interesting stuff I probably won't be working on. Like a kind-of FFI that lets you call Javascript libraries directly. Or a plugin that gives you access to the DOM (I do have the mechanism for VM plugins in place already). With that you could write a native HTML UI which would certainly be much faster than BitBlt.

Networking would be interesting, too. How about implementing the SocketPlugin via WebSockets? Parallelize the VM with WebWorkers?

There's a gazillion exciting things to do :)

  --  Bert Freudenberg, September 2014

  [repo]:     https://github.com/bertfreudenberg/SqueakJS
  [homepage]: http://bertfreudenberg.github.io/SqueakJS/
  [simple]:   http://bertfreudenberg.github.io/SqueakJS/demo/simple.html
  [etoys]:    http://bertfreudenberg.github.io/SqueakJS/etoys/
  [scratch]:  http://bertfreudenberg.github.io/SqueakJS/scratch/
  [full]:     http://lively-web.org/users/bert/squeak.html
  [zip]:      https://github.com/bertfreudenberg/SqueakJS/archive/master.zip
  [lively]:   https://github.com/LivelyKernel/LivelyKernel
  [pullreq]:  https://help.github.com/articles/using-pull-requests


Changelog
---------
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
    2013-12-14: colored bitblt
    2013-12-03: first pixels on screen
    2013-11-29: GC
    2013-11-22: runs 43 byte codes and 8 sends successfully
    2013-11-07: initial commit