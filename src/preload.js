const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  store: {
    get(key) {
      return ipcRenderer.sendSync('electron-store-get', key);
    },
    set(property, val) {
      ipcRenderer.send('electron-store-set', property, val);
    },
  },
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel) => ipcRenderer.invoke(channel)
});