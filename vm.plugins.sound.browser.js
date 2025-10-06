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

Object.extend(Squeak.Primitives.prototype,
'SoundPlugin', {
    snd_primitiveSoundStart: function(argCount) {
        return this.snd_primitiveSoundStartWithSemaphore(argCount);
    },
    snd_primitiveSoundStartWithSemaphore: function(argCount) {
        var bufFrames = this.stackInteger(argCount-1),
            samplesPerSec = this.stackInteger(argCount-2),
            stereoFlag = this.stackBoolean(argCount-3),
            semaIndex = argCount > 3 ? this.stackInteger(argCount-4) : 0;
        if (!this.success) return false;
        var channelCount = stereoFlag ? 2 : 1;
        var session = Squeak.ensureAudioOutputSession({
            bufferFrames: bufFrames,
            sampleRate: samplesPerSec,
            channels: channelCount,
            onBufferFreed: function() {
                if (this.audioSema) this.signalSemaphoreWithIndex(this.audioSema);
                this.vm.forceInterruptCheck();
            }.bind(this),
        });
        if (!session) {
            this.vm.warnOnce("could not initialize audio");
            return false;
        }
        this.audioSession = session;
        this.audioContext = session.context || Squeak.startAudioOut();
        this.audioSema = semaIndex; // signal when ready to accept another buffer of samples
        this.audioBufferFrames = bufFrames;
        this.audioChannelCount = channelCount;
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundAvailableSpace: function(argCount) {
        if (!this.audioSession) {
            console.warn("sound: no audio context");
            return false;
        }
        var available = this.audioSession.availableByteCount();
        return this.popNandPushIfOK(argCount + 1, available);
    },
    snd_primitiveSoundPlaySamples: function(argCount) {
        if (!this.audioSession) {
            console.warn("sound: play but no audio session");
            return false;
        }
        var count = this.stackInteger(2),
            sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            startIndex = this.stackInteger(0) - 1;
        if (!this.success || !sqSamples) return false;
        if (!this.audioSession.enqueueSamples(sqSamples, startIndex, count)) {
            console.warn("sound: insufficient buffer space for samples");
            return false;
        }
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundPlaySilence: function(argCount) {
        if (!this.audioSession) {
            console.warn("sound: play but no audio session");
            return false;
        }
        if (!this.audioSession.enqueueSilence(this.audioBufferFrames)) {
            console.warn("sound: insufficient buffer space for silence");
            return false;
        }
        return this.popNandPushIfOK(argCount + 1, this.audioBufferFrames);
    },
    snd_primitiveSoundStop: function(argCount) {
        if (this.audioSession) {
            this.audioSession.stop();
            this.audioSession = null;
        }
        this.audioContext = null;
        this.audioSema = 0;
        this.audioBufferFrames = 0;
        this.audioChannelCount = 0;
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundStartRecording: function(argCount) {
        if (argCount !== 3) return false;
        var rcvr = this.stackNonInteger(3),
            samplesPerSec = this.stackInteger(2),
            stereoFlag = this.stackBoolean(1),
            semaIndex = this.stackInteger(0);
        if (!this.success) return false;
        var method = this.primMethod,
            unfreeze = this.vm.freeze(),
            self = this;
        Squeak.startAudioIn(
            function onSuccess(audioContext, session) {
                self.audioInContext = audioContext;
                self.audioInSession = session;
                self.audioInSema = semaIndex;
                self.audioInBuffers = [];
                self.audioInBufferIndex = 0;
                self.audioInOverSample = 1;
                while (samplesPerSec * self.audioInOverSample < self.audioInContext.sampleRate)
                    self.audioInOverSample *= 2;
                var bufferSize = self.audioInOverSample * 1024;
                while (bufferSize / self.audioInContext.sampleRate < 0.1)
                    bufferSize *= 2;
                self.audioInProcessor = audioContext.createScriptProcessor(bufferSize, stereoFlag ? 2 : 1, stereoFlag ? 2 : 1);
                self.audioInProcessor.onaudioprocess = function(event) {
                    self.snd_recordNextBuffer(event.inputBuffer);
                };
                if (session && typeof session.connectProcessor === "function") {
                    session.connectProcessor(self.audioInProcessor);
                } else if (session && typeof session.connect === "function") {
                    session.connect(self.audioInProcessor);
                }
                if (self.audioInProcessor && typeof self.audioInProcessor.connect === "function") {
                    self.audioInProcessor.connect(audioContext.destination);
                }
                self.vm.popN(argCount);
                window.setTimeout(unfreeze, 0);
            },
            function onError(msg) {
                console.warn(msg);
                self.vm.sendAsPrimitiveFailure(rcvr, method, argCount);
                window.setTimeout(unfreeze, 0);
            },
            {
                sampleRate: samplesPerSec,
                channels: stereoFlag ? 2 : 1,
            });
        return true;
    },
    snd_recordNextBuffer: function(audioBuffer) {
        if (!this.audioInContext) return;
        // console.log("sound " + this.audioInContext.currentTime.toFixed(3) +
        //    ": recorded " + audioBuffer.duration.toFixed(3) + " s");
        if (this.audioInBuffers.length > 5)
            this.audioInBuffers.shift();
        this.audioInBuffers.push(audioBuffer);
        if (this.audioInSema) this.signalSemaphoreWithIndex(this.audioInSema);
        this.vm.forceInterruptCheck();
    },
    snd_primitiveSoundGetRecordingSampleRate: function(argCount) {
       if (!this.audioInContext) return false;
       var actualRate = this.audioInContext.sampleRate / this.audioInOverSample | 0;
    //    console.log("sound: actual recording rate " + actualRate + "x" + this.audioInOverSample);
       return this.popNandPushIfOK(argCount + 1, actualRate);
    },
    snd_primitiveSoundRecordSamples: function(argCount) {
        var sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            sqStartIndex = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var sampleCount = 0;
        while (sqStartIndex < sqSamples.length) {
            if (this.audioInBuffers.length === 0) break;
            var buffer = this.audioInBuffers[0],
                channels = buffer.numberOfChannels,
                sqStep = channels,
                jsStep = this.audioInOverSample,
                sqCount = (sqSamples.length - sqStartIndex) / sqStep,
                jsCount = (buffer.length - this.audioInBufferIndex) / jsStep,
                count = Math.min(jsCount, sqCount);
            for (var channel = 0; channel < channels; channel++) {
                var jsSamples = buffer.getChannelData(channel),
                    jsIndex = this.audioInBufferIndex,
                    sqIndex = sqStartIndex + channel;
                for (var i = 0; i < count; i++) {
                    sqSamples[sqIndex] = jsSamples[jsIndex] * 32768 & 0xFFFF; // float32 -> int16
                    sqIndex += sqStep;
                    jsIndex += jsStep;
                }
            }
            sampleCount += count * channels;
            sqStartIndex += count * channels;
            if (jsIndex < buffer.length) {
                this.audioInBufferIndex = jsIndex;
            } else {
                this.audioInBufferIndex = 0;
                this.audioInBuffers.shift();
            }
        }
        return this.popNandPushIfOK(argCount + 1, sampleCount);
    },
    snd_primitiveSoundStopRecording: function(argCount) {
        if (this.audioInContext) {
            if (this.audioInSession && typeof this.audioInSession.stop === "function") {
                this.audioInSession.stop();
            }
            if (this.audioInProcessor && typeof this.audioInProcessor.disconnect === "function") {
                this.audioInProcessor.disconnect();
            }
            this.audioInContext = null;
            this.audioInSema = 0;
            this.audioInBuffers = null;
            this.audioInSession = null;
            this.audioInProcessor = null;
            console.log("sound recording stopped")
        }
        Squeak.stopAudioIn();
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundSetRecordLevel: function(argCount) {
        this.vm.warnOnce("sound set record level not supported");
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundConfigureRecordingSource: function(argCount) {
        if (argCount < 1 || argCount > 2) return false;
        var modeObj = this.stackNonInteger(argCount - 1);
        if (!modeObj || !modeObj.bytesAsString) return false;
        var mode = modeObj.bytesAsString();
        var identifier = null;
        if (argCount === 2) {
            var idObj = this.stackValue(0);
            if (idObj !== this.vm.nilObj) {
                if (!idObj || typeof idObj.bytesAsString !== "function") return false;
                identifier = idObj.bytesAsString();
            }
        }
        var config = { mode: mode };
        if (identifier !== null) config.fileId = identifier;
        Squeak.configureAudioInput(config);
        return this.popNIfOK(argCount);
    },
});
