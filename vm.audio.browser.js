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

Object.extend(Squeak,
"audio", {
    startAudioOut: function() {
        if (!this.audioOutContext) {
            this.audioOutContext = new AudioContext();
        }
        return this.audioOutContext;
    },
    stopAudioOut: function() {
        if (this.audioOutContext) {
            this.audioOutContext.close();
            this.audioOutContext = null;
        }
    },
    startAudioIn: function(thenDo, errorDo) {
        if (this.audioInContext) {
            this.audioInSource.disconnect();
            return thenDo(this.audioInContext, this.audioInSource);
        }
        if (!navigator.mediaDevices) return errorDo("test: audio input not supported");
        navigator.mediaDevices.getUserMedia({audio: true})
            .then(stream => {
                this.audioInContext = new AudioContext();
                this.audioInSource = this.audioInContext.createMediaStreamSource(stream);
                thenDo(this.audioInContext, this.audioInSource);
            })
            .catch(err => errorDo("cannot access microphone. " + err.name + ": " + err.message));
    },
    stopAudioIn: function() {
        if (this.audioInSource) {
            this.audioInSource.disconnect();
            this.audioInSource = null;
            this.audioInContext.close();
            this.audioInContext = null;
        }

    },
});
