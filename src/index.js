const { app, BrowserWindow } = require('electron');
const path = require('path');
var sqlite3 = require('@journeyapps/sqlcipher').verbose();
const fs = require('fs');
const { ipcMain } = require('electron')

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 300,
    webPreferences: {
      nodeIntegration: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {

    getTracks(mainWindow)

    setInterval(function () {
      getTracks(mainWindow);
    }, 10000);

  })

};

const getTracks = (mainWindow) => {

  var homeFolder = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");

  if (process.platform != 'darwin') {
    var optionsPath = homeFolder + '\\Pioneer\\rekordboxAgent\\storage\\options.json';
    var outputPath = require('os').homedir() + '\\unbox_output'
  }
  else {
    var optionsPath = homeFolder + '/Pioneer/rekordboxAgent/storage/options.json';
    var outputPath = require('os').homedir() + '/unbox_output'
  }

  let rawdata = fs.readFileSync(optionsPath);
  let options = JSON.parse(rawdata);
  var db_path = options['options'][0][1];

  fs.access(outputPath, function (error) {
    if (error) {
      fs.mkdirSync(outputPath);
    } else {
    }
  })

  var timestampPath = process.env.APPDATA ? outputPath + '\\most_recent_track_timestamp.json' : outputPath + '/most_recent_track_timestamp.json';

  let most_recent_track_timestamp = null;

  fs.access(timestampPath, function (error) {
    if (error) {
    } else {
      let rawdata = fs.readFileSync(timestampPath);
      most_recent_track_timestamp = JSON.parse(rawdata)['timestamp'];
    }
  })

  var db = new sqlite3.Database(db_path);

  db.serialize(function () {
    db.run("PRAGMA cipher_compatibility = 4");
    db.run("PRAGMA key = ''");
    db.each(`select 
            h.created_at, 
            c.Title as Track, 
            a.Name as Artist
            from djmdSongHistory as h
            join djmdContent as c on h.ContentID = c.ID
            left join djmdArtist as a on c.ArtistID = a.ID
            order by h.created_at desc
            limit 1;`, function (err, row) {

      if (((most_recent_track_timestamp) && (Date.parse(row.created_at) > Date.parse(most_recent_track_timestamp))) || (!most_recent_track_timestamp)) {

        var streamTxtPath = process.env.APPDATA ? outputPath + '\\rekordbox_stream.txt' : outputPath + '/rekordbox_stream.txt';

        fs.writeFileSync(streamTxtPath, row.Artist + ' - ' + row.Track);

        mainWindow.webContents.send('track-update', row.Artist + ' - ' + row.Track)

        most_recent_track_timestamp = row.created_at;
        let data = JSON.stringify({ timestamp: most_recent_track_timestamp });
        fs.writeFileSync(timestampPath, data);

      }
    });
  });

  db.close();

};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
