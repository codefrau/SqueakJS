# Running the SqueakJS Debugger in Lively

## Prerequisites

You need to have [git](https://git-scm.com/) and
[docker](https://docs.docker.com/install/) available on the machine that should
host Lively. See [Lively Docker](https://github.com/LivelyKernel/lively-docker) for more details.


## Install and Run Lively

Now build and run Lively:

```sh
./start.sh
```

The script will first build a docker image using the Dockerfile in this directory.
To rebuild it, run `docker build --rm -t squeakjs-lively .`

Then the script creates a directory LivelyKernel in the base folder if no such
folder exists yet and will clone the [LivelyKernel](https://github.com/LivelyKernel/LivelyKernel) repository into it.
Additionally, it will pull down the PartsBin from
[lively-web.org](https://lively-web.org). If you want to use an existing Lively
install just copy it into this LivelyKernel folder before running `start.sh`.

_Please note:_ the `start.sh` script will take a few minutes to run the first
time around. This is completly normal, just hang on ;)

After the setup steps are done (a message along the lines of `Lively server
starting...` appears in the command output) you will be able to access Lively at http://localhost:9001/welcome.html

## Run and Debug SqueakJS

The whole SqueakJS directory is mapped into the LivelyKernel directory
at users/SqueakJS/

Open http://localhost:9001/users/SqueakJS/lively/squeak.html to run the visual debugger. Use Lively's System Browser to modify the VM source code by navigating to users/SqueakJS. When you accept a method in the browser, the file on your disk will be modified.

## How it works

All the SqueakJS VM files are loaded into Lively by the squeak_lively.js entry point. This is a module that gets loaded by the SqueakMorph's loadSqueakJS() script in lively/squeak.html.
That morph implements the platform support code similar to the stand-alone squeak.js one, but using Lively facilities.
