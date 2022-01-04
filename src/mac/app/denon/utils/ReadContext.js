"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadContext = void 0;
const assert_1 = require("assert");
const Context_1 = require("./Context");
function fromCString(p_buffer) {
    const arr = String.fromCharCode.apply(null, p_buffer).split('\0');
    assert_1.strict(arr.length > 0);
    return arr[0];
}
class ReadContext extends Context_1.Context {
    constructor(p_buffer, p_littleEndian = false) {
        super(p_buffer, p_littleEndian);
    }
    read(p_bytes) {
        const bytesToRead = Math.min(this.sizeLeft(), p_bytes);
        if (bytesToRead <= 0) {
            return null;
        }
        const view = new Uint8Array(this.buffer, this.pos, bytesToRead);
        this.pos += bytesToRead;
        assert_1.strict(view.byteLength === bytesToRead);
        return view;
    }
    readRemaining() {
        return this.read(this.sizeLeft());
    }
    readRemainingAsNewBuffer() {
        const view = this.readRemaining();
        const newArrayBuffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.length);
        return Buffer.from(newArrayBuffer);
    }
    getString(p_bytes) {
        const buf = this.read(p_bytes);
        return fromCString(buf);
    }
    readNetworkStringUTF16() {
        // node.js only supports little endian of UTF16, and we need big endian, so read one by one
        const bytes = this.readUInt32();
        assert_1.strict(bytes <= this.sizeLeft());
        assert_1.strict(bytes % 2 === 0); // Should be 2 bytes per character; otherwise assert
        let result = '';
        for (let i = 0; i < bytes / 2; ++i) {
            result += String.fromCharCode(this.readUInt16());
        }
        return result;
    }
    readUInt64() {
        const offset = this.pos;
        if (offset + 8 <= this.buffer.byteLength) {
            const value = new DataView(this.buffer).getBigUint64(this.pos, this.littleEndian);
            this.pos += 8;
            return value;
        }
        assert_1.strict.fail(`Read outside buffer`);
        return null;
    }
    readUInt32() {
        const offset = this.pos;
        if (offset + 4 <= this.buffer.byteLength) {
            const value = new DataView(this.buffer).getUint32(this.pos, this.littleEndian);
            this.pos += 4;
            return value;
        }
        assert_1.strict.fail(`Read outside buffer`);
        return null;
    }
    readInt32() {
        const offset = this.pos;
        if (offset + 4 <= this.buffer.byteLength) {
            const value = new DataView(this.buffer).getInt32(this.pos, this.littleEndian);
            this.pos += 4;
            return value;
        }
        assert_1.strict.fail(`Read outside buffer`);
        return null;
    }
    readUInt16() {
        const offset = this.pos;
        if (offset + 2 <= this.buffer.byteLength) {
            const value = new DataView(this.buffer).getUint16(this.pos, this.littleEndian);
            this.pos += 2;
            return value;
        }
        assert_1.strict.fail(`Read outside buffer`);
        return null;
    }
    readUInt8() {
        const offset = this.pos;
        if (offset + 1 <= this.buffer.byteLength) {
            const value = new DataView(this.buffer).getUint8(this.pos);
            this.pos += 1;
            return value;
        }
        assert_1.strict.fail(`Read outside buffer`);
        return null;
    }
}
exports.ReadContext = ReadContext;
//# sourceMappingURL=ReadContext.js.map