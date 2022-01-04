'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteContext = void 0;
const assert = require('assert');
const Context_1 = require("./Context");
class WriteContext extends Context_1.Context {
    constructor(p_options) {
        const buffer = new ArrayBuffer(p_options && p_options.size > 0 ? p_options.size : 128);
        super(buffer, !p_options ? false : !!p_options.littleEndian);
        this.autoGrow = !p_options || (p_options.autoGrow ? !!p_options.autoGrow : true);
    }
    getBuffer() {
        const newBuf = Buffer.from(this.buffer, 0, this.pos);
        return newBuf;
    }
    sizeLeft() {
        return this.buffer.byteLength - this.pos;
    }
    checkSize(p_size) {
        while (true) {
            const diff = this.sizeLeft() - p_size;
            if (diff >= 0) {
                break;
            }
            if (this.autoGrow) {
                this.resize();
                continue;
            }
            assert.fail(`Writing ${-diff} bytes OOB of fixed size buffer`);
        }
    }
    resize() {
        assert(this.autoGrow);
        const size = this.buffer.byteLength;
        const newBuffer = new ArrayBuffer(size * 2);
        new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
        this.buffer = newBuffer;
    }
    write(p_buffer, p_bytes = -1) {
        if (p_bytes <= 0) {
            p_bytes = p_buffer.byteLength;
        }
        this.checkSize(p_bytes);
        new Uint8Array(this.buffer).set(p_buffer, this.pos);
        this.pos += p_bytes;
        return p_bytes;
    }
    writeFixedSizedString(p_string) {
        for (let i = 0; i < p_string.length; ++i) {
            this.writeUInt8(p_string.charCodeAt(i));
        }
        return p_string.length;
    }
    writeNetworkStringUTF16(p_string) {
        let written = this.writeUInt32(p_string.length * 2);
        for (let i = 0; i < p_string.length; ++i) {
            written += this.writeUInt16(p_string.charCodeAt(i));
        }
        return written;
    }
    writeUInt64(p_value) {
        this.checkSize(8);
        new DataView(this.buffer).setBigUint64(this.pos, p_value, this.littleEndian);
        this.pos += 8;
        return 8;
    }
    writeUInt32(p_value) {
        this.checkSize(4);
        new DataView(this.buffer).setUint32(this.pos, p_value, this.littleEndian);
        this.pos += 4;
        return 4;
    }
    writeUInt16(p_value) {
        this.checkSize(2);
        new DataView(this.buffer).setUint16(this.pos, p_value, this.littleEndian);
        this.pos += 2;
        return 2;
    }
    writeUInt8(p_value) {
        this.checkSize(1);
        new DataView(this.buffer).setUint8(this.pos, p_value);
        this.pos += 1;
        return 1;
    }
}
exports.WriteContext = WriteContext;
//# sourceMappingURL=WriteContext.js.map