const BASE64 = "oAkBAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAElNQ0sBAAAAAwAAAAIAAAAgAAAALAAAAAAAAAAAAAAAABAAAAAgAAAAQAAAA2ZvbwRiYXI6AAAAAAAAAAAAAAA=";

function decodeBase64ToUint8Array(base64 = BASE64) {
    if (typeof Buffer !== "undefined") {
        const buffer = Buffer.from(base64, "base64");
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    const binary = typeof atob === "function" ? atob(base64) : globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function getNonSpur64MockBytes() {
    return decodeBase64ToUint8Array();
}

function getNonSpur64MockBuffer() {
    const bytes = getNonSpur64MockBytes();
    if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return arrayBuffer;
}

export { BASE64 as NONSPUR64_MOCK_BASE64, getNonSpur64MockBytes, getNonSpur64MockBuffer };
