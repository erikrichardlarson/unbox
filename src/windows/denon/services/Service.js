"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const assert_1 = require("assert");
const common_1 = require("../common");
const ReadContext_1 = require("../utils/ReadContext");
const WriteContext_1 = require("../utils/WriteContext");
const tcp = require("../utils/tcp");
const EventEmitter = require("events");
//import { hex } from '../utils/hex';
class Service extends EventEmitter {
    constructor(p_address, p_port, p_controller) {
        super();
        this.connection = null;
        this.address = p_address;
        this.port = p_port;
        this.name = this.constructor.name;
        this.controller = p_controller;
    }
    async connect() {
        assert_1.strict(!this.connection);
        this.connection = await tcp.connect(this.address, this.port);
        let queue = null;
        this.connection.socket.on('data', (p_data) => {
            let buffer = null;
            if (queue && queue.length > 0) {
                buffer = Buffer.concat([queue, p_data]);
            }
            else {
                buffer = p_data;
            }
            // FIXME: Clean up this arraybuffer confusion mess
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            const ctx = new ReadContext_1.ReadContext(arrayBuffer, false);
            queue = null;
            try {
                while (ctx.isEOF() === false) {
                    if (ctx.sizeLeft() < 4) {
                        queue = ctx.readRemainingAsNewBuffer();
                        break;
                    }
                    const length = ctx.readUInt32();
                    if (length <= ctx.sizeLeft()) {
                        const message = ctx.read(length);
                        // Use slice to get an actual copy of the message instead of working on the shared underlying ArrayBuffer
                        const data = message.buffer.slice(message.byteOffset, message.byteOffset + length);
                        //console.info("RECV", length);
                        //hex(message);
                        const parsedData = this.parseData(new ReadContext_1.ReadContext(data, false));
                        // Forward parsed data to message handler
                        this.messageHandler(parsedData);
                        this.emit('message', parsedData);
                    }
                    else {
                        ctx.seek(-4); // Rewind 4 bytes to include the length again
                        queue = ctx.readRemainingAsNewBuffer();
                        break;
                    }
                }
            }
            catch (err) {
                // FIXME: Rethrow based on the severity?
                console.error(err);
            }
        });
        // FIXME: Is this required for all Services?
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeUInt32(common_1.MessageId.ServicesAnnouncement);
        ctx.write(common_1.CLIENT_TOKEN);
        ctx.writeNetworkStringUTF16(this.name);
        ctx.writeUInt16(this.connection.socket.localPort); // FIXME: In the Go code this is the local TCP port, but 0 or any other 16 bit value seems to work fine as well
        await this.write(ctx);
        await this.init();
        console.info(`Connected to service '${this.name}' at port ${this.port}`);
    }
    disconnect() {
        assert_1.strict(this.connection);
        this.connection.destroy();
        this.connection = null;
    }
    async waitForMessage(p_messageId) {
        return await new Promise((resolve, reject) => {
            const listener = (p_message) => {
                if (p_message.id === p_messageId) {
                    this.removeListener('message', listener);
                    resolve(p_message.message);
                }
            };
            this.addListener('message', listener);
            setTimeout(() => {
                reject(new Error(`Failed to receive message '${p_messageId}' on time`));
            }, common_1.MESSAGE_TIMEOUT);
        });
    }
    async write(p_ctx) {
        assert_1.strict(p_ctx.isLittleEndian() === false);
        assert_1.strict(this.connection);
        const buf = p_ctx.getBuffer();
        //console.info("SEND");
        //hex(buf);
        const written = await this.connection.write(buf);
        assert_1.strict(written === buf.byteLength);
        return written;
    }
    async writeWithLength(p_ctx) {
        assert_1.strict(p_ctx.isLittleEndian() === false);
        assert_1.strict(this.connection);
        const newCtx = new WriteContext_1.WriteContext({ size: p_ctx.tell() + 4, autoGrow: false });
        newCtx.writeUInt32(p_ctx.tell());
        newCtx.write(p_ctx.getBuffer());
        assert_1.strict(newCtx.isEOF());
        return await this.write(newCtx);
    }
    // FIXME: Cannot use abstract because of async; is there another way to get this?
    async init() {
        assert_1.strict.fail('Implement this');
    }
}
exports.Service = Service;
//# sourceMappingURL=Service.js.map