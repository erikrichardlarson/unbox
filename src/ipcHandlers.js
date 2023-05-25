const { handleElectronStore } = require("./electronStore");
const { handleExportOverlay } = require("./exportOverlay");
const { handleLocalIP } = require("./localIP");

function initializeIpcHandlers(mainWindow) {
    handleElectronStore();
    handleExportOverlay(mainWindow);
    handleLocalIP();
}

module.exports = {
    initializeIpcHandlers,
};
