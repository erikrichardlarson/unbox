const { app, BrowserWindow } = require("electron");
const { createWindow } = require("./window");
const { getLocalIP } = require("./localIP");
const { initializeIpcHandlers } = require("./ipcHandlers");
const { startExpressServer, closeExpressServer } = require("./expressServer");
const { Poller } = require("./poller");
const WebSocketServer = require("./websocketServer");
const Store = require("electron-store");
const { resolve, join } = require("path");
const { copyFile, mkdirSync } = require("fs");
const winston = require('winston');
const fs = require('fs');

function copy(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
        copyFile(sourcePath, destPath, (err) => {
            if (err) {
                console.error(`Error copying file from ${sourcePath} to ${destPath}: ${err}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

if (require("electron-squirrel-startup")) {
    app.quit();
}

let socketServer;
let intervalId;

const logDir = app.getPath('userData');

mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: join(logDir, 'combined.log') }),
    ],
});

app.on("ready", async () => {
    const mainWindow = createWindow();
    const store = new Store({ name: "unbox" });
    const userDataPath = app.getPath('userData');
    const sourceCssPath = resolve(__dirname, "..", "public", "tailwind.css");
    const sourceHtmlPath = resolve(__dirname, "..", "public", "album_art.html");
    const destHtmlPath = join(userDataPath, 'album_art.html');
    const destCssPath = join(userDataPath, 'tailwind.css');

    try {
        await Promise.all([
            copy(sourceCssPath, destCssPath),
            copy(sourceHtmlPath, destHtmlPath),
        ]);
        const localIP = getLocalIP();
        let data = await fs.promises.readFile(destHtmlPath, 'utf8');
        data = data.replace('WEBSOCKET_IP', localIP);
        await fs.promises.writeFile(destHtmlPath, data, 'utf8');
    } catch(err) {
        console.error(`Error occurred during file copy: ${err}`);
    }

    initializeIpcHandlers(mainWindow);
    startExpressServer();
    socketServer = new WebSocketServer(3000);
    socketServer.startServer();
    const poller = new Poller(socketServer, logger);

    const pollerActions = {
        "Rekordbox": () => poller.rekordbox(),
        "Traktor": () => poller.traktor(),
        "Serato": () => {
            let seratoUserId = store.get("seratoUserId");
            poller.serato(seratoUserId);
        },
        "Mixxx": () => poller.mixxx(),
        "VirtualDJ": () => poller.virtualDJ(),
        "DJUCED": () => poller.djuced(),
        "Prolink": () => poller.prodjlink(),
        "djay Pro": () => poller.djayPro(),
    };

    const runPoller = () => {
        const mode = store.get("mode");
        const action = pollerActions[mode];
        if (action) {
            action();
        }
    };

    intervalId = setInterval(runPoller, 5000);
});

app.on("window-all-closed", () => {
    app.quit();
});

app.on("before-quit", () => {
    if (socketServer) {
        socketServer.stopServer();
    }
    if (intervalId) {
        clearInterval(intervalId);
    }
    closeExpressServer();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
