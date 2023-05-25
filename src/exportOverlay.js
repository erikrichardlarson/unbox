const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const { app } = require('electron');
const isDevelopment = process.env.NODE_ENV === 'development';

function handleExportOverlay(mainWindow) {
    ipcMain.on("export-overlay", async (event, htmlContent) => {
        try {
            let filePath;
            if (isDevelopment) {
                filePath = path.resolve(__dirname, "..", "public", "unbox_overlay.html");
            } else {
                filePath = path.join(app.getPath('userData'), 'unbox_overlay.html');
            }
            fs.writeFile(filePath, htmlContent, "utf-8", (err) => {
                if (err) {
                    mainWindow.webContents.send("export-overlay-error", "Error writing file");
                } else {
                    mainWindow.webContents.send("export-overlay-success", "File saved successfully");
                }
            });
        } catch (error) {
            mainWindow.webContents.send("export-overlay-error", "Error in export-overlay handler");
        }
    });
}


module.exports = {
    handleExportOverlay,
};
