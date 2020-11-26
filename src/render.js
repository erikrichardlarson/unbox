const { ipcRenderer } = require('electron')

ipcRenderer.on('track-update', (event, arg) => {
    document.getElementById('last_log').innerText = arg;
})