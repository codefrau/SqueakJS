"use strict";

const sharedHeapSlot = Symbol.for("Squeak.Execution.sharedHeap");

function hasSharedArrayBufferSupport() {
    try {
        return typeof SharedArrayBuffer === "function" && typeof Atomics === "object";
    } catch (_) {
        return false;
    }
}

function createBuffer(byteLength, preferShared) {
    var length = Math.max(0, byteLength | 0);
    if (preferShared && hasSharedArrayBufferSupport()) {
        try {
            return new SharedArrayBuffer(length);
        } catch (_) {
            // fall through to ArrayBuffer
        }
    }
    return new ArrayBuffer(length);
}

function createHeapFromSnapshot(snapshotBuffer, options) {
    if (!snapshotBuffer) throw new TypeError("Snapshot buffer is required");
    var preferShared = !options || options.preferShared !== false;
    var targetBuffer = createBuffer(snapshotBuffer.byteLength, preferShared);
    var bytes = new Uint8Array(targetBuffer);
    bytes.set(new Uint8Array(snapshotBuffer));
    return {
        buffer: targetBuffer,
        bytes: bytes,
        byteLength: targetBuffer.byteLength,
        shared: typeof SharedArrayBuffer === "function" && targetBuffer instanceof SharedArrayBuffer,
        version: 1,
        dirty: false,
        markDirty: function markDirty() {
            this.dirty = true;
        },
    };
}

function cloneSnapshot(image) {
    if (!image || typeof image.writeToBuffer !== "function") {
        throw new TypeError("VM image with writeToBuffer() is required for shared heap synchronisation");
    }
    var buffer = image.writeToBuffer();
    if (!(buffer instanceof ArrayBuffer)) {
        throw new TypeError("Image writeToBuffer() must return an ArrayBuffer");
    }
    return buffer;
}

export function ensureSharedHeapForVM(vm, options) {
    if (!vm) throw new TypeError("VM instance is required");
    var preferShared = !options || options.preferShared !== false;
    var heap = vm[sharedHeapSlot] || null;
    if (!vm.image || typeof vm.image.writeToBuffer !== "function") {
        if (!heap) {
            heap = createHeapFromSnapshot(new ArrayBuffer(0), { preferShared: preferShared });
            vm[sharedHeapSlot] = heap;
        }
        return heap;
    }
    if (!heap) {
        var snapshot = cloneSnapshot(vm.image);
        heap = createHeapFromSnapshot(snapshot, { preferShared: preferShared });
        vm[sharedHeapSlot] = heap;
        return heap;
    }
    if (heap.byteLength === 0) {
        var emptySnapshot = cloneSnapshot(vm.image);
        if (emptySnapshot.byteLength !== 0) {
            heap = createHeapFromSnapshot(emptySnapshot, { preferShared: preferShared });
            vm[sharedHeapSlot] = heap;
        }
        return vm[sharedHeapSlot];
    }
    if (options && options.forceRecreate) {
        var recreateSnapshot = cloneSnapshot(vm.image);
        heap = createHeapFromSnapshot(recreateSnapshot, { preferShared: preferShared });
        vm[sharedHeapSlot] = heap;
        return heap;
    }
    if (heap.dirty || (options && options.forceSync)) {
        var snapshotBuffer = cloneSnapshot(vm.image);
        if (snapshotBuffer.byteLength !== heap.byteLength || (preferShared && !heap.shared)) {
            heap = createHeapFromSnapshot(snapshotBuffer, { preferShared: preferShared });
            vm[sharedHeapSlot] = heap;
            return heap;
        }
        heap.bytes.set(new Uint8Array(snapshotBuffer));
        heap.dirty = false;
        heap.version++;
    }
    return heap;
}

export function markSharedHeapDirty(vm) {
    if (!vm) return;
    var heap = vm[sharedHeapSlot];
    if (heap && typeof heap.markDirty === "function") {
        heap.markDirty();
    }
}

export function getSharedHeapForVM(vm) {
    if (!vm) return null;
    return vm[sharedHeapSlot] || null;
}

export function clearSharedHeapForVM(vm) {
    if (!vm) return;
    if (vm[sharedHeapSlot]) {
        delete vm[sharedHeapSlot];
    }
}

export function sharedHeapIsShared(vm) {
    var heap = getSharedHeapForVM(vm);
    return !!(heap && heap.shared);
}

export default {
    ensureSharedHeapForVM,
    markSharedHeapDirty,
    getSharedHeapForVM,
    clearSharedHeapForVM,
    sharedHeapIsShared,
};
