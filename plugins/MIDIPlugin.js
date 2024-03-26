"use strict";

/*
 * Copyright (c) 2013-2024 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


function MIDIPlugin() {
    "use strict";

    const MIDI = midiParameterConstants();

    return {
        debug: false,
        vmProxy: null,
        vm: null,
        prims: null,
        timeOffset: 0,
        midi: null, // WebMIDI access or false if not supported
        midiPromise: null,
        ports: new Map(), // indexed by Squeak port number

        getModuleName() { return 'MIDIPlugin (SqueakJS)'; },
        setInterpreter(vmProxy) {
            this.vmProxy = vmProxy;
            this.vm = vmProxy.vm;
            this.prims = vmProxy.vm.primHandler;
            return true;
        },
        initialiseModule() {
            this.debug = this.vm.options.debugMIDI;
            if (!navigator.requestMIDIAccess) {
                console.log('MIDIPlugin: WebMIDI not supported');
                this.vmProxy.success(false);
                return;
            }
            if (!this.midiPromise) {
                this.midiPromise = navigator.requestMIDIAccess({
                    software: true, // because why not
                    sysex: false,   // if you change this, tweak the running status handling
                })
                .then(access => {
                    this.midi = access;
                    this.initMIDI(access);
                })
                .catch(err => {
                    console.error('MIDIPlugin: ' + err);
                    this.midi = false;
                });
            }
            if (performance.timeOrigin) this.timeOffset = performance.timeOrigin - this.vm.startupTime;
        },
        initMIDI(access) {
            const allPorts = [...access.inputs.values(), ...access.outputs.values()];
            for (const port of allPorts) this.portChanged(port);
            access.onstatechange = (event) => {
                const port = event.port;
                let { name, manufacturer, state } = port;
                if (manufacturer && !name.includes(manufacturer)) name += ` (${manufacturer})`;
                const sqPort = this.portChanged(port);
                const isNew = !port.sqPort;
                if (isNew) port.sqPort = sqPort;
                if (isNew || state === 'disconnected' || this.debug) {
                    console.log(`MIDIPlugin: ${name} ${state} (port ${sqPort.handle} ${port.type} ${port.connection})`);
                }
            };
            console.log(`MIDIPlugin: WebMIDI initialized (ports: ${this.ports.size})`);
            for (const [portNumber, port] of this.ports) {
                const dir = port.dir === 3 ? 'in+out' : port.dir === 2 ? 'out' : 'in';
                const names = [];
                if (port.input) names.push(port.input.name);
                if (port.output) names.push(port.output.name);
                console.log(`MIDIPlugin: port ${portNumber} ${dir} (${names.join(', ')})`);
            }
        },
        portChanged(port) {
            // Squeak likes combined input/output ports so we create sqPorts with input+output here
            let { name, manufacturer } = port;
            // strip input / output designation
            name = name.replace(/(\b(in|out)(put)?\b)/i, '').replace(/(\(\)|\[\])/, '').replace(/  /, " ").trim();
            if (manufacturer && !name.includes(manufacturer)) name += ` (${manufacturer})`;
            // find existing port or create new one
            let sqPort;
            for (const existingPort of this.ports.values()) {
                if (existingPort.name === name) {
                    sqPort = existingPort;
                    break;
                }
            }
            if (!sqPort) {
                const handle = this.ports.size;
                sqPort = {
                    handle,
                    name,
                    dir: 0,
                    input: null,
                    output: null,
                    runningStatus: 0,
                    receivedMessages: [],
                };
                this.ports.set(handle, sqPort);
            }
            // dir: 1=input, 2=output, 3=input+output
            if (port.state === "connected") {
                sqPort[port.type] = port;
                sqPort.dir |=  port.type === 'input' ? 1 : 2;
            } else {
                sqPort[port.type] = null;
                sqPort.dir &= port.type === 'input' ? ~1 : ~2;
            }
            return sqPort;
        },
        primitiveMIDIGetPortCount(argCount) {
            // we rely on this primitive to be called first
            // so the other primitives can be synchronous
            const returnCount = () => this.vm.popNandPush(argCount + 1, this.ports.size);
            if (this.midi === null) {
                const unfreeze = this.vm.freeze();
                this.midiPromise
                    .then(returnCount)
                    .catch(err => {
                        console.error('MIDIPlugin: ' + err);
                        returnCount();
                    })
                    .finally(unfreeze);
            } else {
                returnCount();
            }
            return true;
        },
        primitiveMIDIGetPortName(argCount) {
            if (!this.midi) return false;
            const portNumber = this.prims.stackInteger(0);
            const port = this.ports.get(portNumber);
            if (!port) return false;
            let name = port.name;
            if (port.dir === 0) name += ' [disconnected]';
            return this.prims.popNandPushIfOK(argCount + 1, this.prims.makeStString(name));
        },
        primitiveMIDIGetPortDirectionality(argCount) {
            if (!this.midi) return false;
            const portNumber = this.prims.stackInteger(0);
            const port = this.ports.get(portNumber);
            if (!port) return false;
            return this.prims.popNandPushIfOK(argCount + 1, port.dir);
        },
        primitiveMIDIGetClock(argCount) {
            if (!this.midi) return false;
            const clock = this.prims.millisecondClockValue();
            return this.prims.popNandPushIfOK(argCount + 1, clock);
        },
        primitiveMIDIParameterGetOrSet(argCount) {
            if (!this.midi) return false;
            const parameter = this.prims.stackInteger(argCount - 1);
            // const newValue = argCount > 1 ? this.prims.stackInteger(0) : null;
            let value;
            // mostly untested, because I found no Squeak app that actually uses these
            switch (parameter) {
                case MIDI.Installed:
                    value = 1; break
                case MIDI.Version:
                    value = 1; break;
                case MIDI.HasBuffer:
                case MIDI.HasDurs:
                case MIDI.CanSetClock:
                case MIDI.CanUseSemaphore:
                case MIDI.EchoOn:
                case MIDI.UseControllerCache:
                case MIDI.EventsAvailable:
                case MIDI.FlushDriver:
                    value = 0; break;
                case MIDI.ClockTicksPerSec:
                    value = 1000; break;
                case MIDI.HasInputClock:
                    value = 1; break;
                default: return false;
            }
            return this.prims.popNandPushIfOK(argCount + 1, value);
        },
        primitiveMIDIOpenPort(argCount) {
            const portNumber = this.prims.stackInteger(2);
            // const readSemaIndex = this.prims.stackInteger(1);       // ignored
            // const interfaceClockRate = this.prims.stackInteger(0);  // ignored
            let port;
            const checkPort = () => {
                port = this.ports.get(portNumber);
                if (!port) console.error(`MIDIPlugin: invalid port ${portNumber}`);
                else if (!port.dir) {
                    console.error(`MIDIPlugin: port ${portNumber} ${port.name} is disconnected`);
                    port = null;
                }
            };
            const openPort = unfreeze => {
                const promises = []; // wait for MIDI initialization first
                if (port.input)
                    if (port.input.connection === "closed") promises.push(port.input.open());
                    else console.warn(`MIDIPlugin: input port ${portNumber} is ${port.input.connection}`);
                if (port.output)
                    if (port.output.connection === "closed") promises.push(port.output.open());
                    else console.warn(`MIDIPlugin: output port ${portNumber} is ${port.output.connection}`);
                port.runningStatus = 0;
                port.receivedMessages = [];
                Promise.all(promises)
                    .then(() => {
                        if (port.input) port.input.onmidimessage = event => {
                            const time = Math.round(event.timeStamp + this.timeOffset);
                            const bytes = new Uint8Array(event.data);
                            port.receivedMessages.push({time, bytes});
                            if (this.debug) console.log('MIDIPlugin: received', time, [...bytes]);
                        };
                    })
                    .catch(err => console.error('MIDIPlugin: ' + err))
                    .finally(unfreeze);
            };
            // if already initialized, report failure immediately
            if (this.midi) {
                checkPort();
                if (!port) return false;
            }
            // otherwise, we wait for initialization
            const unfreeze = this.vm.freeze();
            this.midiPromise
                .then(() => {
                    if (!port) checkPort();
                    if (port) openPort(unfreeze);
                    else unfreeze();
                });
            return this.prims.popNIfOK(argCount);
        },
        primitiveMIDIClosePort(argCount) {
            // ok to close even if not initialized
            if (this.midi) {
                const portNumber = this.prims.stackInteger(0);
                const port = this.ports.get(portNumber);
                if (!port) return false;
                const promises = [];
                if (port.input && port.input.connection === 'open') {
                    promises.push(port.input.close());
                    port.input.onmidimessage = null;
                    port.receivedMessages.length = 0;
                }
                if (port.output && port.output.connection === 'open') {
                    promises.push(port.output.close());
                }
                if (promises.length) {
                    const unfreeze = this.vm.freeze();
                    Promise.all(promises)
                        .catch(err => console.error('MIDIPlugin: ' + err))
                        .finally(unfreeze);
                }
            }
            return this.prims.popNIfOK(argCount);
        },
        primitiveMIDIWrite(argCount) {
            if (!this.midi) return false;
            const portNumber = this.prims.stackInteger(2);
            let data = this.prims.stackNonInteger(1).bytes;
            const timestamp = this.prims.stackInteger(0);
            const port = this.ports.get(portNumber);
            if (!port || !port.output || !data) return false;
            if (port.output.connection !== 'open') {
                console.error('MIDIPlugin: primitiveMIDIWrite error (port not open)');
                return this.prims.popNandPushIfOK(argCount + 1, 0);
            }
            // this could be simple if it were not for the running status
            // WebMIDI insists the first byte is a status byte
            // so we need to keep track of it, and prepend it if necessary
            if (data[0] < 0x80) {
                if (port.runningStatus === 0) {
                    console.error('MIDIPlugin: no running status byte');
                    return false;
                }
                const newData = new Uint8Array(data.length + 1);
                newData[0] = port.runningStatus;
                newData.set(data, 1);
                data = newData;
            }
            try {
                if (this.debug) console.log('MIDIPlugin: send', [...data], timestamp);
                // send or schedule data
                if (timestamp === 0) port.output.send(data);
                else port.output.send(data, timestamp);
                // find last status byte in data, but ignore real-time messages (0xF8-0xFF)
                // system common messages (0xF0-0xF7) reset the running status
                for (let i = data.length - 1; i >= 0; i--) {
                    if (data[i] >= 0x80 && data[i] <= 0xF7) {
                        port.runningStatus = data[i] < 0xF0 ? data[i] : 0;
                        break;
                    }
                }
            } catch (err) {
                console.error('MIDIPlugin: ' + err);
                return false;
            }
            return this.prims.popNandPushIfOK(argCount + 1, data.length);
        },
        primitiveMIDIRead(argCount) {
            if (!this.midi) return false;
            const portNumber = this.prims.stackInteger(1);
            const data = this.prims.stackNonInteger(0).bytes;
            const port = this.ports.get(portNumber);
            if (!port || !port.input || port.input.connection !== 'open') return false;
            let received = 0;
            const event = port.receivedMessages.shift();
            if (event) {
                let { time, bytes } = event;
                data[0] = (time >> 24) & 0xFF;
                data[1] = (time >> 16) & 0xFF;
                data[2] = (time >> 8) & 0xFF;
                data[3] = time & 0xFF;
                data.set(bytes, 4);
                received = bytes.length + 4;
                if (this.debug) console.log('MIDIPlugin: read', received, [...data.subarray(0, received)]);
            }
            return this.prims.popNandPushIfOK(argCount + 1, received);
        },
    };
}

function midiParameterConstants() {
    // MIDI parameter key constants
    // see primitiveMIDIParameterGetOrSet() for SqueakJS values
    return  {
        Installed: 1,
            // Read-only. Return 1 if a MIDI driver is installed, 0 if not.
            // On OMS-based MIDI drivers, this returns 1 only if the OMS
            // system is properly installed and configured.
        Version: 2,
            // Read-only. Return the integer version number of this MIDI driver.
            // The version numbering sequence is relative to a particular driver.
            // That is, version 3 of the Macintosh MIDI driver is not necessarily
            // related to version 3 of the Win95 MIDI driver.
        HasBuffer: 3,
            // Read-only. Return 1 if this MIDI driver has a time-stamped output
            // buffer, 0 otherwise. Such a buffer allows the client to schedule
            // MIDI output packets to be sent later. This can allow more precise
            // timing, since the driver uses timer interrupts to send the data
            // at the right time even if the processor is in the midst of a
            // long-running Squeak primitive or is running some other application
            // or system task.
        HasDurs: 4,
            // Read-only. Return 1 if this MIDI driver supports an extended
            // primitive for note-playing that includes the note duration and
            // schedules both the note-on and the note-off messages in the
            // driver. Otherwise, return 0.
        CanSetClock: 5,
            // Read-only. Return 1 if this MIDI driver's clock can be set
            // via an extended primitive, 0 if not.
        CanUseSemaphore: 6,
            // Read-only. Return 1 if this MIDI driver can signal a semaphore
            // when MIDI input arrives. Otherwise, return 0. If this driver
            // supports controller caching and it is enabled, then incoming
            // controller messages will not signal the semaphore.
        EchoOn: 7,
            // Read-write. If this flag is set to a non-zero value, and if
            // the driver supports echoing, then incoming MIDI events will
            // be echoed immediately. If this driver does not support echoing,
            // then queries of this parameter will always return 0 and
            // attempts to change its value will do nothing.
        UseControllerCache: 8,
            // Read-write. If this flag is set to a non-zero value, and if
            // the driver supports a controller cache, then the driver will
            // maintain a cache of the latest value seen for each MIDI controller,
            // and control update messages will be filtered out of the incoming
            // MIDI stream. An extended MIDI primitive allows the client to
            // poll the driver for the current value of each controller. If
            // this driver does not support a controller cache, then queries
            // of this parameter will always return 0 and attempts to change
            // its value will do nothing.
        EventsAvailable: 9,
            // Read-only. Return the number of MIDI packets in the input queue.
        FlushDriver: 10,
            // Write-only. Setting this parameter to any value forces the driver
            // to flush its I/0 buffer, discarding all unprocessed data. Reading
            // this parameter returns 0. Setting this parameter will do nothing
            // if the driver does not support buffer flushing.
        ClockTicksPerSec: 11,
            // Read-only. Return the MIDI clock rate in ticks per second.
        HasInputClock: 12,
            // Read-only. Return 1 if this MIDI driver timestamps incoming
            // MIDI data with the current value of the MIDI clock, 0 otherwise.
            // If the driver does not support such timestamping, then the
            // client must read input data frequently and provide its own
            // timestamping.
    };
}

function registerMIDIPlugin() {
    if (typeof Squeak === "object" && Squeak.registerExternalModule) {
        Squeak.registerExternalModule('MIDIPlugin', MIDIPlugin());
    } else self.setTimeout(registerMIDIPlugin, 100);
};

registerMIDIPlugin();
