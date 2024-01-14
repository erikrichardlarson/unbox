const { BrowserWindow, shell } = require("electron");
const path = require("path");

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, 'logo.icns')
    });

    mainWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    mainWindow.webContents.on('will-navigate', function (event, newUrl) {
        if (newUrl.startsWith('https://checkout.stripe.com/')) {
            event.preventDefault();
            shell.openExternal(newUrl);
        }
    });
    return mainWindow;
}

module.exports = {
    createWindow,
};
