"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
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

(function bootstrapAudioBridge(global) {
    var SqueakGlobal = global.Squeak || (global.Squeak = {});
    var READ_INDEX = 0;
    var WRITE_INDEX = 1;
    var DEFAULT_NOTIFY_FRAMES = 128;

    function hasSharedArrayBuffer(globalScope) {
        return typeof globalScope.SharedArrayBuffer === "function"
            && typeof globalScope.Atomics === "object"
            && globalScope.Atomics !== null
            && (globalScope.crossOriginIsolated !== false);
    }

    function createWorkletSource() {
        return `
            const READ_INDEX = ${READ_INDEX};
            const WRITE_INDEX = ${WRITE_INDEX};

            class SqueakAudioWorkletProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.channelCount = 1;
                    this.capacity = 0;
                    this.buffer = null;
                    this.state = null;
                    this.notifyInterval = ${DEFAULT_NOTIFY_FRAMES};
                    this.consumedSinceNotify = 0;
                    this.underrunSinceNotify = 0;
                    this.port.onmessage = (event) => {
                        const data = event.data || {};
                        if (data.type === "configure") {
                            this.channelCount = data.channels || 1;
                            this.capacity = data.capacity | 0;
                            this.buffer = data.samples || null;
                            this.state = data.state || null;
                            this.notifyInterval = data.notifyInterval || ${DEFAULT_NOTIFY_FRAMES};
                            this.consumedSinceNotify = 0;
                            this.underrunSinceNotify = 0;
                        }
                    };
                }

                process(_inputs, outputs) {
                    const output = outputs[0];
                    if (!output) return true;
                    const frames = output[0] ? output[0].length : 0;
                    if (!this.buffer || !this.state || !frames) {
                        for (let ch = 0; ch < output.length; ch++) {
                            output[ch].fill(0);
                        }
                        return true;
                    }
                    const channels = this.channelCount;
                    const capacity = this.capacity;
                    let readIndex = Atomics.load(this.state, READ_INDEX) | 0;
                    const writeIndex = Atomics.load(this.state, WRITE_INDEX) | 0;
                    let available = writeIndex >= readIndex
                        ? writeIndex - readIndex
                        : (capacity - readIndex) + writeIndex;
                    for (let frame = 0; frame < frames; frame++) {
                        const frameBase = (readIndex * channels) % (capacity * channels);
                        if (available <= 0) {
                            for (let ch = 0; ch < output.length; ch++) {
                                output[ch][frame] = 0;
                            }
                            this.underrunSinceNotify++;
                        } else {
                            for (let ch = 0; ch < output.length; ch++) {
                                const sourceChannel = ch < channels ? ch : channels - 1;
                                output[ch][frame] = this.buffer[frameBase + sourceChannel] || 0;
                            }
                            readIndex = (readIndex + 1) % capacity;
                            available--;
                            this.consumedSinceNotify++;
                        }
                    }
                    Atomics.store(this.state, READ_INDEX, readIndex);
                    if (this.consumedSinceNotify >= this.notifyInterval) {
                        this.port.postMessage({ type: "freed", frames: this.consumedSinceNotify });
                        this.consumedSinceNotify = 0;
                    }
                    if (this.underrunSinceNotify >= this.notifyInterval) {
                        this.port.postMessage({ type: "underrun", frames: this.underrunSinceNotify });
                        this.underrunSinceNotify = 0;
                    }
                    return true;
                }
            }

            registerProcessor("squeak-audio-worklet", SqueakAudioWorkletProcessor);
        `;
    }

    function clampChannels(channelCount, fallback) {
        if (!channelCount || channelCount < 1) return fallback;
        return Math.max(1, Math.min(channelCount, 2));
    }

    class AudioOutputManager {
        constructor(globalScope) {
            this.global = globalScope;
            this.context = null;
            this.session = null;
            this.workletModulePromise = null;
            this.supportsWorklet = false;
            this._detectSupport();
        }

        _detectSupport() {
            var globalScope = this.global;
            var AudioCtx = globalScope.AudioContext || globalScope.webkitAudioContext;
            if (!AudioCtx) return;
            try {
                var context = new AudioCtx({ latencyHint: "interactive" });
                this.supportsWorklet = !!(context.audioWorklet && globalScope.AudioWorkletNode && hasSharedArrayBuffer(globalScope));
                context.close();
            } catch (err) {
                this.supportsWorklet = false;
            }
        }

        ensureContext() {
            if (this.context) return this.context;
            var AudioCtx = this.global.AudioContext || this.global.webkitAudioContext;
            if (!AudioCtx) return null;
            this.context = new AudioCtx({ latencyHint: "interactive" });
            return this.context;
        }

        _ensureWorkletModulePromise() {
            if (!this.context || !this.supportsWorklet) {
                return Promise.reject(new Error("worklet unsupported"));
            }
            if (!this.workletModulePromise) {
                var source = createWorkletSource();
                var blob = new this.global.Blob([source], { type: "application/javascript" });
                var url = this.global.URL.createObjectURL(blob);
                this.workletModulePromise = this.context.audioWorklet.addModule(url).finally(() => {
                    this.global.URL.revokeObjectURL(url);
                });
            }
            return this.workletModulePromise;
        }

        ensureSession(options) {
            var context = this.ensureContext();
            if (!context) return null;
            if (this.session) {
                this.session.stop();
                this.session = null;
            }
            if (context.state === "suspended" && typeof context.resume === "function") {
                context.resume().catch(function() {});
            }
            if (this.supportsWorklet) {
                var modulePromise = this._ensureWorkletModulePromise().catch((err) => {
                    this.supportsWorklet = false;
                    throw err;
                });
                this.session = new AudioOutputWorkletSession(this.global, context, options, modulePromise);
            } else {
                this.session = new AudioOutputLegacySession(this.global, context, options);
            }
            this.session.prepare();
            return this.session;
        }

        currentSession() {
            return this.session || null;
        }

        stop() {
            if (this.session) {
                this.session.stop();
                this.session = null;
            }
            if (this.context) {
                if (typeof this.context.close === "function") {
                    this.context.close();
                }
                this.context = null;
            }
        }

        diagnostics() {
            return {
                hasContext: !!this.context,
                sessionType: this.session ? this.session.type : null,
                supportsWorklet: this.supportsWorklet,
            };
        }
    }

    class AudioOutputWorkletSession {
        constructor(globalScope, context, options, modulePromise) {
            this.global = globalScope;
            this.context = context;
            this.type = "worklet";
            this.channels = clampChannels(options && options.channels, 2);
            this.sampleRate = options && options.sampleRate || context.sampleRate || 44100;
            this.bufferFrames = options && options.bufferFrames || 2048;
            this.notifyInterval = options && options.notifyInterval || DEFAULT_NOTIFY_FRAMES;
            this.onBufferFreed = options && options.onBufferFreed || null;
            this.capacityFrames = Math.max(this.bufferFrames * 4, this.notifyInterval * 4);
            this.samples = new Float32Array(new this.global.SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * this.capacityFrames * this.channels));
            this.state = new Int32Array(new this.global.SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
            this.writeIndex = 0;
            this.node = null;
            this.readyPromise = null;
            this.pendingFreedFrames = 0;
            this.modulePromise = modulePromise || Promise.resolve();
            this.fallbackSession = null;
            this.atomics = this.global.Atomics || Atomics;
            this.state[READ_INDEX] = 0;
            this.state[WRITE_INDEX] = 0;
        }

        prepare() {
            if (this.readyPromise) return this.readyPromise;
            var session = this;
            this.readyPromise = this.modulePromise.then(function() {
                session.node = new session.global.AudioWorkletNode(session.context, "squeak-audio-worklet", {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [session.channels],
                });
                session.node.port.onmessage = function(event) {
                    session._handleWorkletMessage(event.data || {});
                };
                session.node.connect(session.context.destination);
                session.node.port.postMessage({
                    type: "configure",
                    channels: session.channels,
                    capacity: session.capacityFrames,
                    samples: session.samples,
                    state: session.state,
                    notifyInterval: session.notifyInterval,
                });
            }).catch(function(err) {
                if (session.global.console && session.global.console.warn) {
                    session.global.console.warn("Falling back to legacy audio output", err);
                }
                session.fallbackSession = new AudioOutputLegacySession(session.global, session.context, {
                    channels: session.channels,
                    sampleRate: session.sampleRate,
                    bufferFrames: session.bufferFrames,
                    onBufferFreed: session.onBufferFreed,
                });
                session.fallbackSession.prepare();
            });
            return this.readyPromise;
        }

        availableByteCount() {
            if (this.fallbackSession) return this.fallbackSession.availableByteCount();
            if (!this.state) return 0;
            var readIndex = this.atomics.load(this.state, READ_INDEX);
            var writeIndex = this.writeIndex;
            var capacity = this.capacityFrames;
            var freeFrames = readIndex > writeIndex
                ? (readIndex - writeIndex - 1)
                : (capacity - writeIndex + readIndex - 1);
            if (freeFrames < 0) freeFrames = 0;
            return freeFrames * this.channels * 2;
        }

        enqueueSamples(int16Array, startIndex, frameCount) {
            if (this.fallbackSession) {
                return this.fallbackSession.enqueueSamples(int16Array, startIndex, frameCount);
            }
            if (!this.samples || !this.state) return false;
            var bytesAvailable = this.availableByteCount();
            var requiredBytes = frameCount * this.channels * 2;
            if (requiredBytes > bytesAvailable) return false;
            var writeIndex = this.writeIndex;
            var capacity = this.capacityFrames;
            for (var frame = 0; frame < frameCount; frame++) {
                var base = ((writeIndex % capacity) * this.channels);
                for (var channel = 0; channel < this.channels; channel++) {
                    var sampleIndex = startIndex + frame * this.channels + channel;
                    this.samples[base + channel] = (int16Array[sampleIndex] || 0) / 32768;
                }
                writeIndex = (writeIndex + 1) % capacity;
            }
            this.writeIndex = writeIndex;
            this.atomics.store(this.state, WRITE_INDEX, writeIndex);
            return true;
        }

        enqueueSilence(frameCount) {
            if (this.fallbackSession) {
                return this.fallbackSession.enqueueSilence(frameCount);
            }
            if (!this.samples || !this.state) return false;
            var bytesAvailable = this.availableByteCount();
            var requiredBytes = frameCount * this.channels * 2;
            if (requiredBytes > bytesAvailable) return false;
            var writeIndex = this.writeIndex;
            var capacity = this.capacityFrames;
            for (var frame = 0; frame < frameCount; frame++) {
                var base = ((writeIndex % capacity) * this.channels);
                for (var channel = 0; channel < this.channels; channel++) {
                    this.samples[base + channel] = 0;
                }
                writeIndex = (writeIndex + 1) % capacity;
            }
            this.writeIndex = writeIndex;
            this.atomics.store(this.state, WRITE_INDEX, writeIndex);
            return true;
        }

        _handleWorkletMessage(message) {
            if (this.fallbackSession) {
                return;
            }
            if (message.type === "freed" && message.frames) {
                this.pendingFreedFrames += message.frames | 0;
                this._drainFreedNotifications();
            } else if (message.type === "underrun" && message.frames) {
                if (this.global && this.global.console && this.global.console.warn) {
                    this.global.console.warn("Squeak audio underrun", message.frames);
                }
            }
        }

        _drainFreedNotifications() {
            if (!this.onBufferFreed) return;
            while (this.pendingFreedFrames >= this.bufferFrames) {
                this.pendingFreedFrames -= this.bufferFrames;
                this.onBufferFreed();
            }
        }

        stop() {
            if (this.fallbackSession) {
                this.fallbackSession.stop();
                this.fallbackSession = null;
                return;
            }
            if (this.node) {
                try { this.node.disconnect(); } catch (e) { }
                this.node.port.onmessage = null;
                if (typeof this.node.port.postMessage === "function") {
                    this.node.port.postMessage({ type: "configure", channels: this.channels, capacity: 0 });
                }
                this.node = null;
            }
            this.samples = null;
            this.state = null;
            this.writeIndex = 0;
            this.pendingFreedFrames = 0;
        }
    }

    class AudioOutputLegacySession {
        constructor(globalScope, context, options) {
            this.global = globalScope;
            this.context = context;
            this.type = "legacy";
            this.channels = clampChannels(options && options.channels, 2);
            this.sampleRate = options && options.sampleRate || context.sampleRate || 44100;
            this.bufferFrames = options && options.bufferFrames || 2048;
            this.onBufferFreed = options && options.onBufferFreed || null;
            this.buffersReady = [];
            this.buffersUnused = [];
            this.nextTimeSlot = 0;
            this._prepareBuffers();
        }

        async prepare() {
            return Promise.resolve();
        }

        _prepareBuffers() {
            this.buffersUnused = [
                this.context.createBuffer(this.channels, this.bufferFrames, this.sampleRate),
                this.context.createBuffer(this.channels, this.bufferFrames, this.sampleRate),
                this.context.createBuffer(this.channels, this.bufferFrames, this.sampleRate),
            ];
        }

        availableByteCount() {
            if (!this.buffersUnused || !this.buffersUnused.length) return 0;
            var availableFrames = this.buffersUnused.length * this.bufferFrames;
            return availableFrames * this.channels * 2;
        }

        enqueueSamples(int16Array, startIndex, frameCount) {
            if (!this.buffersUnused || !this.buffersUnused.length) return false;
            var buffer = this.buffersUnused.shift();
            var channels = Math.min(buffer.numberOfChannels || this.channels, this.channels);
            for (var channel = 0; channel < channels; channel++) {
                var jsSamples = buffer.getChannelData(channel);
                var index = startIndex + channel;
                for (var frame = 0; frame < frameCount; frame++) {
                    jsSamples[frame] = (int16Array[index] || 0) / 32768;
                    index += this.channels;
                }
                for (var pad = frameCount; pad < buffer.length; pad++) {
                    jsSamples[pad] = 0;
                }
            }
            for (var fill = channels; fill < buffer.numberOfChannels; fill++) {
                buffer.getChannelData(fill).fill(0);
            }
            this.buffersReady.push(buffer);
            this._schedulePlayback();
            return true;
        }

        enqueueSilence(frameCount) {
            if (!this.buffersUnused || !this.buffersUnused.length) return false;
            var buffer = this.buffersUnused.shift();
            var length = buffer.length;
            for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
                var jsSamples = buffer.getChannelData(channel);
                for (var frame = 0; frame < length; frame++) {
                    jsSamples[frame] = 0;
                }
            }
            this.buffersReady.push(buffer);
            this._schedulePlayback();
            return true;
        }

        _schedulePlayback() {
            if (!this.context || !this.buffersReady || !this.buffersReady.length) return;
            var source = this.context.createBufferSource();
            source.buffer = this.buffersReady.shift();
            source.connect(this.context.destination);
            if (this.nextTimeSlot < this.context.currentTime) {
                this.nextTimeSlot = this.context.currentTime;
            }
            source.start(this.nextTimeSlot);
            var duration = source.buffer.duration || (source.buffer.length / this.sampleRate);
            this.nextTimeSlot += duration;
            var self = this;
            this.global.setTimeout(function() {
                if (!self.context) return;
                self.buffersUnused.push(source.buffer);
                if (self.onBufferFreed) self.onBufferFreed();
            }, Math.max(0, (self.nextTimeSlot - self.context.currentTime) * 1000));
            this._schedulePlayback();
        }

        stop() {
            this.buffersReady = [];
            this.buffersUnused = [];
            this.nextTimeSlot = 0;
        }
    }

    class MicrophoneAudioInputSession {
        constructor(globalScope, context, source, stream) {
            this.global = globalScope;
            this.context = context;
            this.source = source;
            this.stream = stream;
        }

        connectProcessor(node) {
            if (!this.source || !node || typeof this.source.connect !== "function") return;
            this.source.connect(node);
        }

        stop() {
            if (this.source && typeof this.source.disconnect === "function") {
                this.source.disconnect();
            }
            if (this.stream && typeof this.stream.getTracks === "function") {
                var tracks = this.stream.getTracks();
                for (var i = 0; i < tracks.length; i++) {
                    if (tracks[i] && typeof tracks[i].stop === "function") {
                        tracks[i].stop();
                    }
                }
            }
            this.source = null;
            this.stream = null;
        }

        diagnostics() {
            return { mode: "microphone" };
        }
    }

    function createSyntheticEvent(channels, frames, generator) {
        var channelData = new Array(channels);
        for (var ch = 0; ch < channels; ch++) {
            channelData[ch] = generator(ch);
        }
        return {
            inputBuffer: {
                numberOfChannels: channels,
                length: frames,
                getChannelData: function(channel) {
                    return channelData[channel];
                },
            },
        };
    }

    class SyntheticAudioInputSession {
        constructor(globalScope, context, options) {
            this.global = globalScope;
            this.context = context;
            this.channels = clampChannels(options.channels || 1, 1);
            var frequency = typeof options.frequency === "number" ? options.frequency : 440;
            if (!isFinite(frequency) || frequency <= 0) frequency = 440;
            this.frequency = frequency;
            var amplitude = typeof options.amplitude === "number" ? Math.abs(options.amplitude) : 0.25;
            if (!isFinite(amplitude)) amplitude = 0.25;
            this.amplitude = Math.min(Math.max(amplitude, 0), 1);
            this.phase = 0;
            this.processor = null;
            this.timerHandle = null;
            this.blockFrames = options.blockFrames || 512;
        }

        _schedule() {
            var self = this;
            var intervalMs = (this.blockFrames / (this.context ? this.context.sampleRate || 44100 : 44100)) * 1000;
            intervalMs = Math.max(10, Math.min(intervalMs, 200));
            if (this.timerHandle !== null) return;
            if (typeof this.global.setInterval === "function") {
                this.timerHandle = this.global.setInterval(function() {
                    self._emit();
                }, intervalMs);
                this._clearFn = function(handle) {
                    if (typeof self.global.clearInterval === "function") {
                        self.global.clearInterval(handle);
                    }
                };
            } else if (typeof this.global.setTimeout === "function") {
                (function loop() {
                    self.timerHandle = self.global.setTimeout(function() {
                        self._emit();
                        loop();
                    }, intervalMs);
                })();
                this._clearFn = function(handle) {
                    if (typeof self.global.clearTimeout === "function") {
                        self.global.clearTimeout(handle);
                    }
                };
            }
        }

        _emit() {
            if (!this.processor || typeof this.processor.onaudioprocess !== "function") return;
            var frames = this.processor.bufferSize || this.blockFrames;
            if (!frames || frames < 1) frames = this.blockFrames;
            var sampleRate = this.context ? this.context.sampleRate || 44100 : 44100;
            var angularIncrement = 2 * Math.PI * this.frequency / sampleRate;
            var event = createSyntheticEvent(this.channels, frames, function(channel) {
                var samples = new Float32Array(frames);
                for (var i = 0; i < frames; i++) {
                    samples[i] = Math.sin(this.phase + (angularIncrement * i)) * this.amplitude;
                }
                return samples;
            }.bind(this));
            this.phase += angularIncrement * frames;
            this.phase = this.phase % (2 * Math.PI);
            try {
                this.processor.onaudioprocess(event);
            } catch (err) {
                console.warn("synthetic audio emit failed", err);
            }
        }

        connectProcessor(node) {
            this.processor = node || null;
            if (!this.processor) return;
            this._emit();
            this._schedule();
        }

        stop() {
            if (this.timerHandle !== null && this._clearFn) {
                this._clearFn(this.timerHandle);
            }
            this.timerHandle = null;
            this.processor = null;
        }

        diagnostics() {
            return {
                mode: "synthetic",
                frequency: this.frequency,
                amplitude: this.amplitude,
                blockFrames: this.blockFrames,
            };
        }
    }

    class FileAudioInputSession {
        constructor(globalScope, context, entry, options) {
            this.global = globalScope;
            this.context = context;
            this.entry = entry;
            this.channels = clampChannels(options.channels || entry.channels || 1, entry.channels || 1);
            this.blockFrames = options.blockFrames || 512;
            this.loop = typeof options.loop === "boolean" ? options.loop : (entry.loop !== undefined ? !!entry.loop : true);
            this.position = 0;
            this.processor = null;
            this.timerHandle = null;
        }

        _emit() {
            if (!this.processor || typeof this.processor.onaudioprocess !== "function") return;
            var frames = this.processor.bufferSize || this.blockFrames;
            if (!frames || frames < 1) frames = this.blockFrames;
            var channelCount = this.channels;
            var entry = this.entry;
            var totalFrames = entry.channels ? (entry.samples.length / entry.channels) : 0;
            if (!totalFrames || !isFinite(totalFrames)) {
                var silent = createSyntheticEvent(channelCount, frames, function() {
                    return new Float32Array(frames);
                });
                try {
                    this.processor.onaudioprocess(silent);
                } catch (err) {
                    console.warn("file audio emit failed", err);
                }
                return;
            }
            var event = createSyntheticEvent(channelCount, frames, function(channel) {
                var samples = new Float32Array(frames);
                var srcChannel = channel < entry.channels ? channel : entry.channels - 1;
                for (var i = 0; i < frames; i++) {
                    if (!this.loop && this.position >= totalFrames) {
                        samples[i] = 0;
                        continue;
                    }
                    var frameIndex = (this.position + i) % totalFrames;
                    var sourceIndex = (frameIndex * entry.channels) + srcChannel;
                    samples[i] = entry.samples[sourceIndex] || 0;
                }
                return samples;
            }.bind(this));
            if (this.loop) {
                this.position = (this.position + frames) % totalFrames;
            } else {
                this.position = Math.min(this.position + frames, totalFrames);
            }
            try {
                this.processor.onaudioprocess(event);
            } catch (err) {
                console.warn("file audio emit failed", err);
            }
        }

        _schedule() {
            var self = this;
            if (this.timerHandle !== null) return;
            var sampleRate = this.context ? this.context.sampleRate || this.entry.sampleRate || 44100 : (this.entry.sampleRate || 44100);
            var intervalMs = (this.blockFrames / sampleRate) * 1000;
            intervalMs = Math.max(10, Math.min(intervalMs, 200));
            if (typeof this.global.setInterval === "function") {
                this.timerHandle = this.global.setInterval(function() {
                    self._emit();
                }, intervalMs);
                this._clearFn = function(handle) {
                    if (typeof self.global.clearInterval === "function") {
                        self.global.clearInterval(handle);
                    }
                };
            } else if (typeof this.global.setTimeout === "function") {
                (function loop() {
                    self.timerHandle = self.global.setTimeout(function() {
                        self._emit();
                        loop();
                    }, intervalMs);
                })();
                this._clearFn = function(handle) {
                    if (typeof self.global.clearTimeout === "function") {
                        self.global.clearTimeout(handle);
                    }
                };
            }
        }

        connectProcessor(node) {
            this.processor = node || null;
            if (!this.processor) return;
            this._emit();
            this._schedule();
        }

        stop() {
            if (this.timerHandle !== null && this._clearFn) {
                this._clearFn(this.timerHandle);
            }
            this.timerHandle = null;
            this.processor = null;
        }

        diagnostics() {
            return {
                mode: "file",
                fileId: this.entry.id,
                loop: this.loop,
                blockFrames: this.blockFrames,
            };
        }
    }

    class AudioInputManager {
        constructor(globalScope) {
            this.global = globalScope;
            this.mode = "microphone";
            this.options = {
                synthetic: { frequency: 440, amplitude: 0.25, blockFrames: 512 },
                file: { loop: true, blockFrames: 512 },
            };
            this.files = new Map();
            this.context = null;
            this.activeSession = null;
        }

        configure(configuration) {
            if (!configuration || typeof configuration !== "object") return;
            if (configuration.mode) {
                this.mode = String(configuration.mode).toLowerCase();
            }
            if (configuration.synthetic && typeof configuration.synthetic === "object") {
                Object.assign(this.options.synthetic, configuration.synthetic);
            }
            if (configuration.file && typeof configuration.file === "object") {
                Object.assign(this.options.file, configuration.file);
            }
            if (configuration.fileId) {
                this.options.file.id = configuration.fileId;
            }
        }

        registerFile(id, payload) {
            if (!id) throw new Error("audio input file id required");
            if (!payload || !payload.samples) throw new Error("audio input file samples required");
            var samples = payload.samples;
            if (samples instanceof ArrayBuffer) {
                samples = new Float32Array(samples);
            } else if (Array.isArray(samples)) {
                samples = Float32Array.from(samples);
            } else if (!(samples instanceof Float32Array)) {
                throw new Error("audio input file samples must be Float32Array or array");
            }
            var channels = clampChannels(payload.channels || 1, 1);
            var sampleRate = payload.sampleRate || 44100;
            this.files.set(id, {
                id: id,
                samples: samples,
                channels: channels,
                sampleRate: sampleRate,
                loop: payload.loop !== undefined ? !!payload.loop : undefined,
            });
        }

        unregisterFile(id) {
            this.files.delete(id);
        }

        _closeContext() {
            if (this.context && typeof this.context.close === "function") {
                try {
                    this.context.close();
                } catch (err) {}
            }
            this.context = null;
        }

        _createContext() {
            var AudioCtx = this.global.AudioContext || this.global.webkitAudioContext;
            if (!AudioCtx) return null;
            this._closeContext();
            try {
                this.context = new AudioCtx({ latencyHint: "interactive" });
            } catch (err) {
                this.context = new AudioCtx();
            }
            return this.context;
        }

        _startMicrophone(context, options) {
            if (!this.global.navigator || !this.global.navigator.mediaDevices || !this.global.navigator.mediaDevices.getUserMedia) {
                return Promise.reject(new Error("audio input not supported"));
            }
            var constraints = options && options.constraints ? options.constraints : { audio: true };
            return this.global.navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                var source = context.createMediaStreamSource(stream);
                return new MicrophoneAudioInputSession(this.global, context, source, stream);
            }.bind(this));
        }

        _startSynthetic(context, options) {
            var syntheticOptions = Object.assign({}, this.options.synthetic, options || {});
            return Promise.resolve(new SyntheticAudioInputSession(this.global, context, syntheticOptions));
        }

        _startFile(context, options) {
            var id = (options && options.fileId) || (this.options.file && this.options.file.id);
            if (!id || !this.files.has(id)) {
                return Promise.reject(new Error("audio input file not registered"));
            }
            var entry = this.files.get(id);
            var fileOptions = Object.assign({}, this.options.file, options || {});
            fileOptions.fileId = id;
            return Promise.resolve(new FileAudioInputSession(this.global, context, entry, fileOptions));
        }

        startSession(config) {
            var options = config || {};
            var mode = options.mode || this.mode || "microphone";
            mode = String(mode).toLowerCase();
            this.mode = mode;
            if (this.activeSession) {
                this.activeSession.stop();
                this.activeSession = null;
            }
            var context = this._createContext();
            if (!context) {
                return Promise.reject(new Error("audio input unavailable"));
            }
            if (context.state === "suspended" && typeof context.resume === "function") {
                context.resume().catch(function() {});
            }
            var startPromise;
            switch (mode) {
                case "microphone":
                case "mic":
                    startPromise = this._startMicrophone(context, options);
                    break;
                case "synthetic":
                case "tone":
                    startPromise = this._startSynthetic(context, options);
                    break;
                case "file":
                case "buffer":
                    startPromise = this._startFile(context, options);
                    break;
                default:
                    startPromise = Promise.reject(new Error("unsupported audio input mode: " + mode));
            }
            return startPromise.then(function(session) {
                this.activeSession = session;
                return { context: context, session: session };
            }.bind(this)).catch(function(err) {
                this.stop();
                throw err;
            }.bind(this));
        }

        stop() {
            if (this.activeSession && typeof this.activeSession.stop === "function") {
                this.activeSession.stop();
            }
            this.activeSession = null;
            this._closeContext();
        }

        diagnostics() {
            return {
                mode: this.mode,
                hasContext: !!this.context,
                sampleRate: this.context ? this.context.sampleRate : null,
                activeSession: this.activeSession && typeof this.activeSession.diagnostics === "function"
                    ? this.activeSession.diagnostics()
                    : null,
                registeredFiles: Array.from(this.files.keys()),
            };
        }
    }

    Object.extend(SqueakGlobal,
    "audio", {
        ensureAudioOutputManager: function ensureAudioOutputManager() {
            if (!this.audioOutputManager) {
                this.audioOutputManager = new AudioOutputManager(global);
            }
            return this.audioOutputManager;
        },
        ensureAudioInputManager: function ensureAudioInputManager() {
            if (!this.audioInputManager) {
                this.audioInputManager = new AudioInputManager(global);
            }
            return this.audioInputManager;
        },
        startAudioOut: function startAudioOut() {
            var manager = this.ensureAudioOutputManager();
            var context = manager.ensureContext();
            if (context && context.state === "suspended" && typeof context.resume === "function") {
                context.resume().catch(function() {});
            }
            return context;
        },
        ensureAudioOutputSession: function ensureAudioOutputSession(options) {
            var manager = this.ensureAudioOutputManager();
            return manager.ensureSession(options);
        },
        stopAudioOut: function stopAudioOut() {
            if (!this.audioOutputManager) return;
            this.audioOutputManager.stop();
            this.audioOutputManager = null;
        },
        audioOutputDiagnostics: function audioOutputDiagnostics() {
            if (!this.audioOutputManager) return { hasContext: false, sessionType: null, supportsWorklet: false };
            return this.audioOutputManager.diagnostics();
        },
        startAudioIn: function startAudioIn(thenDo, errorDo, options) {
            var manager = this.ensureAudioInputManager();
            manager.startSession(options || {}).then(function(result) {
                if (typeof thenDo === "function") {
                    thenDo(result.context, result.session);
                }
            }).catch(function(err) {
                if (typeof errorDo === "function") {
                    errorDo(err && err.message ? err.message : String(err));
                }
            });
        },
        stopAudioIn: function stopAudioIn() {
            if (this.audioInputManager) {
                this.audioInputManager.stop();
            }
        },
        configureAudioInput: function configureAudioInput(options) {
            var manager = this.ensureAudioInputManager();
            manager.configure(options);
        },
        registerAudioInputFile: function registerAudioInputFile(id, payload) {
            var manager = this.ensureAudioInputManager();
            manager.registerFile(id, payload || {});
        },
        unregisterAudioInputFile: function unregisterAudioInputFile(id) {
            if (!this.audioInputManager) return;
            this.audioInputManager.unregisterFile(id);
        },
        audioInputDiagnostics: function audioInputDiagnostics() {
            if (!this.audioInputManager) return { hasContext: false, mode: null, activeSession: null, registeredFiles: [] };
            return this.audioInputManager.diagnostics();
        },
    });
})(typeof window !== "undefined" ? window : globalThis);
