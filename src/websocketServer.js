class WebSocketServer {
    constructor(port) {
        this.WebSocket = require("ws");
        this.crypto = require("crypto");
        this.port = port;
        this.lastMessage = null;
    }

    startServer() {
        this.server = new this.WebSocket.Server({ port: this.port });

        this.server.on("connection", (socket) => {
            if (this.lastMessage !== null) {
                socket.send(this.lastMessage);
            }
        });
    }

    stopServer() {
        this.server.close(() => {
        });
    }

    _hashObject(obj) {
        try {
            return this.crypto
                .createHash("sha256")
                .update(obj)
                .digest("hex");
        } catch (error) {
            console.error(`Error hashing object: ${error}`);
            return null;
        }
    }

    isNewMessage(messageString) {
        if (typeof messageString === "object") {
            messageString = JSON.stringify(messageString);
        }
        const messageHash = this._hashObject(messageString);
        return !this.lastMessage || messageHash !== this._hashObject(this.lastMessage);
    }

    broadcastMessage(message) {
        if (typeof message !== "object" || message === null) {
            console.error("Invalid message object");
            return;
        }
        const messageString = JSON.stringify(message);
        if (this.isNewMessage(messageString)) {
            this.server.clients.forEach((client) => {
                if (client.readyState === this.WebSocket.OPEN) {
                    client.send(messageString);
                }
            });
            this.lastMessage = messageString;
        }
    }
}

module.exports = WebSocketServer;
