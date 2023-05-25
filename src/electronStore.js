const { ipcMain } = require("electron");
const Store = require("electron-store");

function handleElectronStore() {
    const store = new Store({ name: "unbox" });

    ipcMain.on("electron-store-get", async (event, val) => {
        event.returnValue = store.get(val);
    });
    ipcMain.on("electron-store-set", async (event, key, val) => {
        store.set(key, val);
    });
}

module.exports = {
    handleElectronStore,
};
