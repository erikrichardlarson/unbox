"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTransfer = exports.CHUNK_SIZE = void 0;
const assert_1 = require("assert");
const common_1 = require("../common");
const sleep_1 = require("../utils/sleep");
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
const MAGIC_MARKER = 'fltx';
exports.CHUNK_SIZE = 4096;
var MessageId;
(function (MessageId) {
    MessageId[MessageId["TimeCode"] = 0] = "TimeCode";
    MessageId[MessageId["FileStat"] = 1] = "FileStat";
    MessageId[MessageId["EndOfMessage"] = 2] = "EndOfMessage";
    MessageId[MessageId["SourceLocations"] = 3] = "SourceLocations";
    MessageId[MessageId["FileTransferId"] = 4] = "FileTransferId";
    MessageId[MessageId["FileTransferChunk"] = 5] = "FileTransferChunk";
    MessageId[MessageId["Unknown0"] = 8] = "Unknown0";
})(MessageId || (MessageId = {}));
class FileTransfer extends Service_1.Service {
    constructor() {
        super(...arguments);
        this.receivedFile = null;
    }
    async init() { }
    parseData(p_ctx) {
        const check = p_ctx.getString(4);
        assert_1.strict(check === MAGIC_MARKER);
        const code = p_ctx.readUInt32();
        // If first 4 bytes are non-zero, a timecode is sent
        if (code > 0) {
            assert_1.strict(p_ctx.sizeLeft() === 8);
            const id = p_ctx.readUInt32();
            assert_1.strict(id === 0x07d2);
            assert_1.strict(p_ctx.readUInt32() === 0);
            return {
                id: MessageId.TimeCode,
                message: {
                    timecode: code,
                },
            };
        }
        // Else
        const messageId = p_ctx.readUInt32();
        switch (messageId) {
            case MessageId.SourceLocations: {
                const sources = [];
                const sourceCount = p_ctx.readUInt32();
                for (let i = 0; i < sourceCount; ++i) {
                    // We get a location
                    const location = p_ctx.readNetworkStringUTF16();
                    sources.push(location);
                }
                // Final three bytes should be 0x1 0x1 0x1
                assert_1.strict(p_ctx.readUInt8() === 0x1);
                assert_1.strict(p_ctx.readUInt8() === 0x1);
                assert_1.strict(p_ctx.readUInt8() === 0x1);
                assert_1.strict(p_ctx.isEOF());
                return {
                    id: messageId,
                    message: {
                        sources: sources,
                    },
                };
            }
            case MessageId.FileStat: {
                assert_1.strict(p_ctx.sizeLeft() === 53);
                // Last 4 bytes (FAT32) indicate size of file
                p_ctx.seek(49);
                const size = p_ctx.readUInt32();
                return {
                    id: messageId,
                    message: {
                        size: size,
                    },
                };
            }
            case MessageId.EndOfMessage: {
                // End of result indication?
                return {
                    id: messageId,
                    message: null,
                };
            }
            case MessageId.FileTransferId: {
                assert_1.strict(p_ctx.sizeLeft() === 12);
                assert_1.strict(p_ctx.readUInt32() === 0x0);
                const filesize = p_ctx.readUInt32();
                const id = p_ctx.readUInt32();
                return {
                    id: messageId,
                    message: {
                        size: filesize,
                        txid: id,
                    },
                };
            }
            case MessageId.FileTransferChunk: {
                assert_1.strict(p_ctx.readUInt32() === 0x0);
                const offset = p_ctx.readUInt32();
                const chunksize = p_ctx.readUInt32();
                assert_1.strict(chunksize === p_ctx.sizeLeft());
                assert_1.strict(p_ctx.sizeLeft() <= exports.CHUNK_SIZE);
                return {
                    id: messageId,
                    message: {
                        data: p_ctx.readRemainingAsNewBuffer(),
                        offset: offset,
                        size: chunksize,
                    },
                };
            }
            case MessageId.Unknown0: {
                return {
                    id: messageId,
                    message: null,
                };
            }
            default:
                {
                    assert_1.strict.fail(`Unhandled message id '${messageId}'`);
                }
                break;
        }
    }
    messageHandler(p_data) {
        if (p_data.id === MessageId.FileTransferChunk && this.receivedFile) {
            assert_1.strict(this.receivedFile.sizeLeft() >= p_data.message.size);
            this.receivedFile.write(p_data.message.data);
        }
        else {
            //console.log(p_data);
        }
    }
    async getFile(p_location) {
        assert_1.strict(this.receivedFile === null);
        await this.requestFileTransferId(p_location);
        const txinfo = await this.waitForMessage(MessageId.FileTransferId);
        if (txinfo) {
            this.receivedFile = new WriteContext_1.WriteContext({ size: txinfo.size });
            const totalChunks = Math.ceil(txinfo.size / exports.CHUNK_SIZE);
            await this.requestChunkRange(txinfo.txid, 0, totalChunks - 1);
            try {
                await new Promise(async (resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Failed to download '${p_location}'`));
                    }, common_1.DOWNLOAD_TIMEOUT);
                    while (this.receivedFile.isEOF() === false) {
                        await sleep_1.sleep(200);
                    }
                    resolve(true);
                });
            }
            catch (err) {
                console.error(err.message);
                this.receivedFile = null;
            }
            await this.signalTransferComplete();
        }
        const buf = this.receivedFile ? this.receivedFile.getBuffer() : null;
        this.receivedFile = null;
        return buf;
    }
    async getSources() {
        const result = [];
        await this.requestSources();
        const message = await this.waitForMessage(MessageId.SourceLocations);
        if (message) {
            for (const source of message.sources) {
                const database = `/${source}/Engine Library/m.db`;
                await this.requestStat(database);
                const fstatMessage = await this.waitForMessage(MessageId.FileStat);
                //console.log(fstatMessage);
                result.push({
                    name: source,
                    database: {
                        location: database,
                        size: fstatMessage.size,
                    },
                });
            }
        }
        return result;
    }
    ///////////////////////////////////////////////////////////////////////////
    // Private methods
    async requestStat(p_filepath) {
        // 0x7d1: seems to request some sort of fstat on a file
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(0x7d1);
        ctx.writeNetworkStringUTF16(p_filepath);
        await this.writeWithLength(ctx);
    }
    async requestSources() {
        // 0x7d2: Request available sources
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(0x7d2); // Database query
        ctx.writeUInt32(0x0);
        await this.writeWithLength(ctx);
    }
    async requestFileTransferId(p_filepath) {
        // 0x7d4: Request transfer id?
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(0x7d4);
        ctx.writeNetworkStringUTF16(p_filepath);
        ctx.writeUInt32(0x0); // Not sure why we need 0x0 here
        await this.writeWithLength(ctx);
    }
    async requestChunkRange(p_txid, p_chunkStartId, p_chunkEndId) {
        // 0x7d5: seems to be the code to request chunk range
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(0x7d5);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(p_txid); // I assume this is the transferid
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(p_chunkStartId);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(p_chunkEndId);
        await this.writeWithLength(ctx);
    }
    async signalTransferComplete() {
        // 0x7d6: seems to be the code to signal transfer completed
        const ctx = new WriteContext_1.WriteContext();
        ctx.writeFixedSizedString(MAGIC_MARKER);
        ctx.writeUInt32(0x0);
        ctx.writeUInt32(0x7d6);
        await this.writeWithLength(ctx);
    }
}
exports.FileTransfer = FileTransfer;
//# sourceMappingURL=FileTransfer.js.map