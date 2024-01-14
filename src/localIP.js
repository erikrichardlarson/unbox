const { ipcMain } = require("electron");
const { networkInterfaces } = require("os");

function handleLocalIP() {
    ipcMain.handle("local-ip", () => {
        const interfaces = networkInterfaces();
        for (const name in interfaces) {
            for (const interfaceInfo of interfaces[name]) {
                if (
                    interfaceInfo.family === "IPv4" &&
                    !interfaceInfo.internal &&
                    interfaceInfo.address
                ) {
                    return interfaceInfo.address;
                }
            }
        }
    });
}

function getLocalIP() {
    const interfaces = networkInterfaces();
    for (const name in interfaces) {
        for (const interfaceInfo of interfaces[name]) {
            if (
                interfaceInfo.family === "IPv4" &&
                !interfaceInfo.internal &&
                interfaceInfo.address
            ) {
                return interfaceInfo.address;
            }
        }
    }
}


module.exports = {
    handleLocalIP,
    getLocalIP,
};
