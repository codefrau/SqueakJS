"use strict";
/*
 * Copyright (c) 2013-2020 Vanessa Freudenberg
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
        this.audioContext = Squeak.startAudioOut();
        if (!this.audioContext) {
            this.vm.warnOnce("could not initialize audio");
            return false;
        }
        this.audioSema = semaIndex; // signal when ready to accept another buffer of samples
        this.audioNextTimeSlot = 0;
        this.audioBuffersReady = [];
        this.audioBuffersUnused = [
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
            this.audioContext.createBuffer(stereoFlag ? 2 : 1, bufFrames, samplesPerSec),
        ];
        console.log("sound: started");
        return this.popNIfOK(argCount);
    },
    snd_playNextBuffer: function() {
        if (!this.audioContext || this.audioBuffersReady.length === 0)
            return;
        var source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffersReady.shift();
        source.connect(this.audioContext.destination);
        if (this.audioNextTimeSlot < this.audioContext.currentTime) {
            if (this.audioNextTimeSlot > 0)
                console.log("sound " + this.audioContext.currentTime.toFixed(3) +
                    ": buffer underrun by " + (this.audioContext.currentTime - this.audioNextTimeSlot).toFixed(3) + " s");
            this.audioNextTimeSlot = this.audioContext.currentTime;
        }
        source.start(this.audioNextTimeSlot);
        //console.log("sound " + this.audioContext.currentTime.toFixed(3) +
        //    ": scheduling from " + this.audioNextTimeSlot.toFixed(3) +
        //    " to " + (this.audioNextTimeSlot + source.buffer.duration).toFixed(3));
        this.audioNextTimeSlot += source.buffer.duration;
        // source.onended is unreliable, using a timeout instead
        window.setTimeout(function() {
            // if the vm was shut down, forceInterruptCheck will be null
            if (!this.audioContext || !this.vm.forceInterruptCheck) return;
            // console.log("sound " + this.audioContext.currentTime.toFixed(3) +
            //    ": done, next time slot " + this.audioNextTimeSlot.toFixed(3));
            this.audioBuffersUnused.push(source.buffer);
            if (this.audioSema) this.signalSemaphoreWithIndex(this.audioSema);
            this.vm.forceInterruptCheck();
        }.bind(this), (this.audioNextTimeSlot - this.audioContext.currentTime) * 1000);
        this.snd_playNextBuffer();
    },
    snd_primitiveSoundAvailableSpace: function(argCount) {
        if (!this.audioContext) {
            console.log("sound: no audio context");
            return false;
        }
        var available = 0;
        if (this.audioBuffersUnused.length > 0) {
            var buf = this.audioBuffersUnused[0];
            available = buf.length * buf.numberOfChannels * 2;
        }
        return this.popNandPushIfOK(argCount + 1, available);
    },
    snd_primitiveSoundPlaySamples: function(argCount) {
        if (!this.audioContext || this.audioBuffersUnused.length === 0) {
            console.log("sound: play but no free buffers");
            return false;
        }
        var count = this.stackInteger(2),
            sqSamples = this.stackNonInteger(1).wordsAsInt16Array(),
            startIndex = this.stackInteger(0) - 1;
        if (!this.success || !sqSamples) return false;
        var buffer = this.audioBuffersUnused.shift(),
            channels = buffer.numberOfChannels;
        for (var channel = 0; channel < channels; channel++) {
            var jsSamples = buffer.getChannelData(channel),
                index = startIndex + channel;
            for (var i = 0; i < count; i++) {
                jsSamples[i] = sqSamples[index] / 32768;    // int16 -> float32
                index += channels;
            }
        }
        this.audioBuffersReady.push(buffer);
        this.snd_playNextBuffer();
        return this.popNIfOK(argCount);
    },
    snd_primitiveSoundPlaySilence: function(argCount) {
        if (!this.audioContext || this.audioBuffersUnused.length === 0) {
            console.log("sound: play but no free buffers");
            return false;
        }
        var buffer = this.audioBuffersUnused.shift(),
            channels = buffer.numberOfChannels,
            count = buffer.length;
        for (var channel = 0; channel < channels; channel++) {
            var jsSamples = buffer.getChannelData(channel);
            for (var i = 0; i < count; i++)
                jsSamples[i] = 0;
        }
        this.audioBuffersReady.push(buffer);
        this.snd_playNextBuffer();
        return this.popNandPushIfOK(argCount + 1, count);
    },
    snd_primitiveSoundStop: function(argCount) {
        if (this.audioContext) {
            this.audioContext = null;
            this.audioBuffersReady = null;
            this.audioBuffersUnused = null;
            this.audioNextTimeSlot = 0;
            this.audioSema = 0;
            console.log("sound: stopped");
        }
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
            function onSuccess(audioContext, source) {
                console.log("sound: recording started")
                self.audioInContext = audioContext;
                self.audioInSource = source;
                self.audioInSema = semaIndex;
                self.audioInBuffers = [];
                self.audioInBufferIndex = 0;
                self.audioInOverSample = 1;
                // if sample rate is still too high, adjust oversampling
                while (samplesPerSec * self.audioInOverSample < self.audioInContext.sampleRate)
                    self.audioInOverSample *= 2;
                // make a buffer of at least 100 ms
                var bufferSize = self.audioInOverSample * 1024;
                while (bufferSize / self.audioInContext.sampleRate < 0.1)
                    bufferSize *= 2;
                self.audioInProcessor = audioContext.createScriptProcessor(bufferSize, stereoFlag ? 2 : 1, stereoFlag ? 2 : 1);
                self.audioInProcessor.onaudioprocess = function(event) {
                    self.snd_recordNextBuffer(event.inputBuffer);
                };
                self.audioInSource.connect(self.audioInProcessor);
                self.audioInProcessor.connect(audioContext.destination);
                self.vm.popN(argCount);
                window.setTimeout(unfreeze, 0);
            },
            function onError(msg) {
                console.warn(msg);
                self.vm.sendAsPrimitiveFailure(rcvr, method, argCount);
                window.setTimeout(unfreeze, 0);
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
       console.log("sound: actual recording rate " + actualRate + "x" + this.audioInOverSample);
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
            this.audioInSource.disconnect();
            this.audioInProcessor.disconnect();
            this.audioInContext = null;
            this.audioInSema = 0;
            this.audioInBuffers = null;
            this.audioInSource = null;
            this.audioInProcessor = null;
            console.log("sound recording stopped")
        }
        return true;
    },
    snd_primitiveSoundSetRecordLevel: function(argCount) {
        return true;
    },
});
