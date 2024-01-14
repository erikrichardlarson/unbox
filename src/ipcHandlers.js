const { handleElectronStore } = require("./electronStore");
const { handleExportOverlay } = require("./exportOverlay");
const { handleLocalIP, getLocalIP } = require("./localIP");
const { ipcMain } = require("electron");

function initializeIpcHandlers(mainWindow) {
    handleElectronStore();
    handleExportOverlay(mainWindow);
    handleLocalIP();
}

ipcMain.handle("get-local-ip", () => {
    return getLocalIP();
});

module.exports = {
    initializeIpcHandlers,
};
