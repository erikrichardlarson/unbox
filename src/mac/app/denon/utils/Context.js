"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const assert_1 = require("assert");
class Context {
    constructor(p_buffer, p_littleEndian) {
        this.buffer = p_buffer;
        this.pos = 0;
        this.littleEndian = p_littleEndian === undefined || !!p_littleEndian;
    }
    sizeLeft() {
        return this.buffer.byteLength - this.pos;
    }
    tell() {
        return this.pos;
    }
    seek(p_bytes) {
        assert_1.strict(this.pos + p_bytes >= 0);
        assert_1.strict(this.pos + p_bytes <= this.buffer.byteLength);
        this.pos += p_bytes;
    }
    set(p_offset) {
        assert_1.strict(p_offset >= 0 && p_offset <= this.buffer.byteLength);
        this.pos = p_offset;
    }
    isEOF() {
        return this.pos >= this.buffer.byteLength;
    }
    isLittleEndian() {
        return this.littleEndian;
    }
    rewind() {
        this.pos = 0;
    }
}
exports.Context = Context;
//# sourceMappingURL=Context.js.map