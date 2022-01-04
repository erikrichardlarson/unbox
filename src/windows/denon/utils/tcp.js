"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = void 0;
const net_1 = require("net");
const promise_socket_1 = require("promise-socket");
const common_1 = require("../common");
async function connect(p_ip, p_port) {
    const socket = new net_1.Socket();
    socket.setTimeout(common_1.CONNECT_TIMEOUT);
    const promiseSocket = new promise_socket_1.PromiseSocket(socket);
    await promiseSocket.connect(p_port, p_ip).catch(() => {
        throw new Error(`Failed to connect to '${p_ip}:${p_port}'`);
    });
    console.log(`TCP connection to '${p_ip}:${p_port}' local port: ${promiseSocket.socket.localPort}`);
    return promiseSocket;
}
exports.connect = connect;
//# sourceMappingURL=tcp.js.map