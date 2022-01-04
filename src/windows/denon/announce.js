"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announce = exports.unannounce = void 0;
const assert_1 = require("assert");
const common_1 = require("./common");
const dgram_1 = require("dgram");
const ip_1 = require("ip");
const os_1 = require("os");
const WriteContext_1 = require("./utils/WriteContext");
function findBroadcastIP() {
    const interfaces = Object.values(os_1.networkInterfaces());
    for (const i of interfaces) {
        for (const entry of i) {
            if (entry.family === 'IPv4' && entry.internal === false) {
                const info = ip_1.subnet(entry.address, entry.netmask);
                return info.broadcastAddress;
            }
        }
    }
    return null;
}
const announcementMessage = {
    action: common_1.Action.Login,
    port: 0,
    software: {
        name: "MarByteBeep's StageLinq Handler",
        version: '0.0.1',
    },
    source: 'testing',
    token: common_1.CLIENT_TOKEN,
};
const announceClient = dgram_1.createSocket('udp4');
let announceTimer = null;
function writeDiscoveryMessage(p_ctx, p_message) {
    let written = 0;
    written += p_ctx.writeFixedSizedString(common_1.DISCOVERY_MESSAGE_MARKER);
    written += p_ctx.write(p_message.token);
    written += p_ctx.writeNetworkStringUTF16(p_message.source);
    written += p_ctx.writeNetworkStringUTF16(p_message.action);
    written += p_ctx.writeNetworkStringUTF16(p_message.software.name);
    written += p_ctx.writeNetworkStringUTF16(p_message.software.version);
    written += p_ctx.writeUInt16(p_message.port);
    return written;
}
async function broadcastMessage(p_message) {
    const bip = findBroadcastIP();
    return await new Promise((resolve, reject) => {
        announceClient.send(p_message, common_1.LISTEN_PORT, bip, () => {
            //console.log('UDP message sent to ' + bip);
            resolve();
        });
        setTimeout(() => {
            reject(new Error('Failed to send announcement'));
        }, common_1.CONNECT_TIMEOUT);
    });
}
async function unannounce() {
    assert_1.strict(announceTimer);
    clearInterval(announceTimer);
    announceTimer = null;
    announcementMessage.action = common_1.Action.Logout;
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, announcementMessage);
    const msg = new Uint8Array(ctx.getBuffer());
    await broadcastMessage(msg);
    //console.info("Unannounced myself");
}
exports.unannounce = unannounce;
async function announce() {
    if (announceTimer) {
        return;
    }
    announcementMessage.action = common_1.Action.Login;
    const ctx = new WriteContext_1.WriteContext();
    writeDiscoveryMessage(ctx, announcementMessage);
    const msg = new Uint8Array(ctx.getBuffer());
    // Immediately announce myself
    await broadcastMessage(msg);
    announceTimer = setInterval(broadcastMessage, common_1.ANNOUNCEMENT_INTERVAL, msg);
    //console.info("Announced myself");
}
exports.announce = announce;
//# sourceMappingURL=announce.js.map