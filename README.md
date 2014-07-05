SqueakJS: A Lively Squeak VM
============================

This GitHub repository contains mainly the interpreter. The HTML user interface is written using the Lively Kernel.
The "demo" directory contains a bare-bones html page, just enough to run the VM, and a "mini.image" (a stripped-down Squeak 2.2).
The "etoys" directory has an html page to run an Etoys image from an external server.
Please visit the [project home page][homepage]!

Running it
----------
**Simplest**

* [click here][simple] to run a minimal version. This is the simple demo included in this repo.
* or [click here][etoys] to run Etoys. Also included in this repo.

**Run your own Squeak image**

* Go to the [full SqueakJS][full] page. Drag an image from your local files into the Lively page. Click "Run".

Chrome works best for development at the moment. But current Safari and IE versions outperform Chrome and Firefox by a significant margin. YMMV.
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
Running a current Squeak image would be nice - beyond the stuff needed for Etoys it should really just be a handful changes to correctly interpret closures.

As for optimizing I think the way to go is a JIT compiler that creates actual Javascript functions from Squeak methods. And to make BitBlt fast, we could probably use WebGL.

There's also interesting stuff I probably won't be working on. Like a kind-of FFI that lets you call Javascript libraries directly. Or a plugin that gives you access to the DOM (I do have the mechanism for VM plugins in place already). With that you could write a native HTML UI which would certainly be much faster than BitBlt.

Networking would be interesting, too. How about implementing the SocketPlugin via WebSockets? Parallelize the VM with WebWorkers?

There's a gazillion exciting things to do :)

  --  Bert Freudenberg, July 2014

  [repo]:     https://github.com/bertfreudenberg/SqueakJS
  [homepage]: http://bertfreudenberg.github.io/SqueakJS/
  [simple]:   http://bertfreudenberg.github.io/SqueakJS/demo/simple.html
  [etoys]:    http://bertfreudenberg.github.io/SqueakJS/demo/simple.html
  [full]:     http://lively-web.org/users/bert/squeak.html
  [zip]:      https://github.com/bertfreudenberg/SqueakJS/archive/master.zip
  [lively]:   https://github.com/LivelyKernel/LivelyKernel
  [pullreq]:  https://help.github.com/articles/using-pull-requests
