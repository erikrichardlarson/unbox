const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron')
const Unbox = require('./unbox')
const path = require("path");
const { url } = require('inspector');


function createWindow () {

  const electronWindow = new BrowserWindow({
    width: 1000,
    height: 1000,
    title: "Unbox",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  electronWindow.on('page-title-updated', function(e) {
    e.preventDefault()
  });

  let unbox = new Unbox(electronWindow, ipcMain);

  electronWindow.webContents.on('will-navigate', function (event, newUrl) {
    event.preventDefault();
    if (newUrl.startsWith('https://checkout.stripe.com/')) {
      require('electron').shell.openExternal(newUrl);
    }
});

  electronWindow.loadFile(path.join(__dirname, 'index.html'));

  electronWindow.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });

  electronWindow.webContents.on('did-finish-load', () => {

    unbox.buildDisplay();
    unbox.startWebServer();
    unbox.startconfigService();
    unbox.startmodeHandler();
    
    unbox.playlist.setMode(unbox.config.mode);
    unbox.playlist.update();

    setInterval(function () {
      unbox.playlist.update();
      unbox.reportLastTrack();
    }, 10000);

  })

  electronWindow.on('closed', function () {
    unbox.stopWebServer();
  })

};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});