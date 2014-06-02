SqueakJS: A Lively Squeak VM
============================

This GitHub repository contains mainly the interpreter. The HTML user interface is written using the Lively Kernel.
The "demo" directory contains a simplified version of the interface, just enough to run the VM.
Please visit the [project home page][homepage]!

Which web browser
-----------------
Chrome and Safari work best for development at the moment (mostly due to Lively Kernel restrictions), on both desktop and mobile. For running simple version without the Lively Kernel, you might find that Firefox and even IE11 sometimes outperform Chrome, though. We have only the included tinyBenchmarks to back this up, but better benchmarks are forthcoming.
Fixes to improve browser compatibility are highly welcome! 

Running locally
---------------

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
My personal medium-term goal is running an Etoys image. It will be very slow at first, but there certainly are ways to optimize.

But one reason for releasing it at this early stage is to allow people to work on what they think is needed. Like running a current Squeak image - beyond the stuff needed for Etoys it should really just be a handful changes to correctly interpret closures.

As for optimizing I think the way to go is a JIT compiler that creates actual Javascript functions from Squeak methods. And to make BitBlt fast, we could probably use WebGL.

There's also interesting stuff I probably won't be working on. Like a kind-of FFI that lets you call Javascript libraries directly. Or a plugin that gives you access to the DOM (I do have the mechanism for VM plugins in place already). With that you could write a native HTML UI which would certainly be much faster than BitBlt.

Networking would be interesting, too. How about implementing the SocketPlugin via WebSockets? Or file access using the browser's local storage API? Parallelize the VM with WebWorkers?

There's a gazillion exciting things to do :)

  --  Bert Freudenberg, December 2013

  [repo]:     https://github.com/bertfreudenberg/SqueakJS
  [homepage]: http://bertfreudenberg.github.io/SqueakJS/
  [zip]:      https://github.com/bertfreudenberg/SqueakJS/archive/master.zip
  [lively]:   https://github.com/LivelyKernel/LivelyKernel
  [pullreq]:  https://help.github.com/articles/using-pull-requests
