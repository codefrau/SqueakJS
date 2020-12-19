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

Object.subclass('Squeak.InstructionPrinter',
'initialization', {
    initialize: function(method, vm) {
        this.method = method;
        this.vm = vm;
    },
},
'printing', {
    printInstructions: function(indent, highlight, highlightPC) {
        // all args are optional
        this.indent = indent;           // prepend to every line except if highlighted
        this.highlight = highlight;     // prepend to highlighted line
        this.highlightPC = highlightPC; // PC of highlighted line
        this.innerIndents = {};
        this.result = '';
        this.scanner = this.method.methodSignFlag()
            ? new Squeak.InstructionStreamSista(this.method, this.vm)
            : new Squeak.InstructionStream(this.method, this.vm);
        this.oldPC = this.scanner.pc;
        this.endPC = 0;                 // adjusted while scanning
        this.done = false;
        try {
            while (!this.done)
                this.scanner.interpretNextInstructionFor(this);
        } catch(ex) {
            this.print("!!! " + ex.message);
        }
        return this.result;
    },
    print: function(instruction) {
        if (this.oldPC === this.highlightPC) {
            if (this.highlight) this.result += this.highlight;
        } else {
            if (this.indent) this.result += this.indent;
        }
        this.result += this.oldPC;
        for (var i = 0; i < this.innerIndents[this.oldPC] || 0; i++)
            this.result += "   ";
        this.result += " <";
        for (var i = this.oldPC; i < this.scanner.pc; i++) {
            if (i > this.oldPC) this.result += " ";
            this.result += (this.method.bytes[i]+0x100).toString(16).substr(-2).toUpperCase(); // padded hex
        }
        this.result += "> " + instruction + "\n";
        this.oldPC = this.scanner.pc;
    }
},
'decoding', {
    blockReturnConstant: function(obj) {
        this.print('blockReturn: ' + obj.toString());
    },
    blockReturnTop: function() {
        this.print('blockReturn');
    },
    doDup: function() {
        this.print('dup');
    },
    doPop: function() {
        this.print('pop');
    },
    jump: function(offset) {
        this.print('jumpTo: ' + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    jumpIf: function(condition, offset) {
        this.print((condition ? 'jumpIfTrue: ' : 'jumpIfFalse: ') + (this.scanner.pc + offset));
        if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
    },
    methodReturnReceiver: function() {
        this.print('return: receiver');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnTop: function() {
        this.print('return: topOfStack');
        this.done = this.scanner.pc > this.endPC;
    },
    methodReturnConstant: function(obj) {
        this.print('returnConst: ' + obj.toString());
        this.done = this.scanner.pc > this.endPC;
    },
    nop: function() {
        this.print('nop');
    },
    popIntoLiteralVariable: function(anAssociation) {
        this.print('popIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    popIntoReceiverVariable: function(offset) {
        this.print('popIntoInstVar: ' + offset);
    },
    popIntoTemporaryVariable: function(offset) {
        this.print('popIntoTemp: ' + offset);
    },
    pushActiveContext: function() {
        this.print('push: thisContext');
    },
    pushConstant: function(obj) {
        var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
        this.print('pushConst: ' + value);
    },
    pushLiteralVariable: function(anAssociation) {
        this.print('pushBinding: ' + anAssociation.assnKeyAsString());
    },
    pushReceiver: function() {
        this.print('push: self');
    },
    pushReceiverVariable: function(offset) {
        this.print('pushInstVar: ' + offset);
    },
    pushTemporaryVariable: function(offset) {
        this.print('pushTemp: ' + offset);
    },
    send: function(selector, numberArguments, supered) {
        this.print( (supered ? 'superSend: #' : 'send: #') + (selector.bytesAsString ? selector.bytesAsString() : selector));
    },
    sendSuperDirected: function(selector) {
        this.print('directedSuperSend: #' + (selector.bytesAsString ? selector.bytesAsString() : selector));
    },
    storeIntoLiteralVariable: function(anAssociation) {
        this.print('storeIntoBinding: ' + anAssociation.assnKeyAsString());
    },
    storeIntoReceiverVariable: function(offset) {
        this.print('storeIntoInstVar: ' + offset);
    },
    storeIntoTemporaryVariable: function(offset) {
        this.print('storeIntoTemp: ' + offset);
    },
    pushNewArray: function(size) {
        this.print('push: (Array new: ' + size + ')');
    },
    popIntoNewArray: function(numElements) {
        this.print('pop: ' + numElements + ' into: (Array new: ' + numElements + ')');
    },
    pushRemoteTemp: function(offset , arrayOffset) {
        this.print('push: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    storeIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('storeInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    popIntoRemoteTemp: function(offset , arrayOffset) {
        this.print('popInto: ' + offset + ' ofTemp: ' + arrayOffset);
    },
    pushClosureCopy: function(numCopied, numArgs, blockSize) {
        var from = this.scanner.pc,
            to = from + blockSize;
        this.print('closure(' + from + '-' + (to-1) + '): ' + numCopied + ' copied, ' + numArgs + ' args');
        for (var i = from; i < to; i++)
            this.innerIndents[i] = (this.innerIndents[i] || 0) + 1;
        if (to > this.endPC) this.endPC = to;
    },
    pushFullClosure: function(literalIndex, numCopied, numArgs) {
        this.print('pushFullClosure: (self literalAt: ' + literalIndex + ') numCopied: ' + numCopied + ' numArgs: ' + numArgs);
    },
    callPrimitive: function(primitiveIndex) {
        this.print('primitive: ' + primitiveIndex);
    },
});
