const { app, BrowserWindow } = require('electron');
const path = require('path');
var sqlite3 = require('@journeyapps/sqlcipher').verbose();
const fs = require('fs');
const { ipcMain } = require('electron')
var connect = require('connect');
var serveStatic = require('serve-static');



if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {

  if (process.platform != 'darwin') {
    var outputPath = require('os').homedir() + '\\unbox_output'
  }
  else {
    var outputPath = require('os').homedir() + '/unbox_output'
  }

  fs.access(outputPath, function (error) {
    if (error) {
      fs.mkdirSync(outputPath);
      fs.writeFileSync(path.join(outputPath, 'now_playing.html'), '')
      fs.writeFileSync(path.join(outputPath, 'play_history.html'), '')
      fs.copyFile(path.join(__dirname, 'now_playing.html'), path.join(outputPath, 'now_playing.html'), (err) => {
        if (err) throw err;
      });
    
      fs.copyFile(path.join(__dirname, 'play_history.html'), path.join(outputPath, 'play_history.html'), (err) => {
        if (err) throw err;
      });
    } else {
    }
  })

  

  var server = connect().use(serveStatic(outputPath)).listen(8080);

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

  mainWindow.on('closed', function () {
    server.close();
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
        var streamJSONPath = process.env.APPDATA ? outputPath + '\\rekordbox_stream.json' : outputPath + '/rekordbox_stream.json';
        var historyJSONPath = process.env.APPDATA ? outputPath + '\\rekordbox_stream_history.json' : outputPath + '/rekordbox_stream_history.json';

        fs.access(historyJSONPath, function (error) {
          if (error) {
            fs.writeFileSync(historyJSONPath, JSON.stringify({ tracks: [{ artist: row.Artist.toUpperCase(), track: row.Track.toUpperCase() }] }));
          } else {
            let history = JSON.parse(fs.readFileSync(historyJSONPath))['tracks'];
            if (history.length == 3) {
              history.pop()
            }
            let updatedHistory = [{ artist: row.Artist.toUpperCase(), track: row.Track.toUpperCase() }].concat(history);
            fs.writeFileSync(historyJSONPath, JSON.stringify({ tracks: updatedHistory }));
          }
        })

        fs.writeFileSync(streamTxtPath, row.Artist + ' - ' + row.Track);
        fs.writeFileSync(streamJSONPath, JSON.stringify({ artist: row.Artist.toUpperCase(), track: row.Track.toUpperCase() }));

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
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
