const { app, BrowserWindow } = require("electron");
const { createWindow } = require("./window");
const { initializeIpcHandlers } = require("./ipcHandlers");
const { startExpressServer, closeExpressServer } = require("./expressServer");
const { Poller } = require("./poller");
const WebSocketServer = require("./websocketServer");
const Store = require("electron-store");
const { resolve, join } = require("path");
const { copyFile } = require("fs");

function copy(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
        copyFile(sourcePath, destPath, (err) => {
            if (err) {
                console.error(`Error copying file from ${sourcePath} to ${destPath}`);
                reject(err);
            } else {
                console.log(`File was copied to ${destPath}`);
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

app.on("ready", async () => {
    const mainWindow = createWindow();
    require('update-electron-app')()
    const store = new Store({ name: "unbox" });

    const userDataPath = app.getPath('userData');
    const sourceCssPath = resolve(__dirname, "..", "public", "tailwind.css");
    const destCssPath = join(userDataPath, 'tailwind.css');
    const sourceHtmlPath = resolve(__dirname, "..", "public", "album_art.html");
    const destHtmlPath = join(userDataPath, 'album_art.html');
    const sourceOverlayHtmlPath = resolve(__dirname, "..", "public", "unbox_overlay.html");
    const destOverlayHtmlPath = join(userDataPath, 'unbox_overlay.html');

    try {
        await Promise.all([
            copy(sourceCssPath, destCssPath),
            copy(sourceHtmlPath, destHtmlPath),
            copy(sourceOverlayHtmlPath, destOverlayHtmlPath)
        ]);
    } catch(err) {
        console.error('Error occurred during file copy: ', err);
    }

    initializeIpcHandlers(mainWindow);
    startExpressServer();
    socketServer = new WebSocketServer(3000);
    socketServer.startServer();
    const poller = new Poller(socketServer);

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
        "Prolink": () => poller.prodjlink()
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
