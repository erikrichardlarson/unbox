const { app, BrowserWindow } = require('electron');
const path = require('path');
var sqlite3 = require('@journeyapps/sqlcipher').verbose();
const fs = require('fs');
const { ipcMain } = require('electron')
var connect = require('connect');
var serveStatic = require('serve-static');
const pathLib = require("path");
const os = require("os");
const puppeteer = require('puppeteer');


class Chunk {

  constructor(length, tag, data) {
    this.length = 0;
    this.length = length;
    this.tag = tag;
    this.data = data;
  }
}

function getStringFromUInt32(n) {

  return (String.fromCharCode(Math.floor(n / (1 << 24)) % 256) +
    String.fromCharCode(Math.floor(n / (1 << 16)) % 256) +
    String.fromCharCode(Math.floor(n / (1 << 8)) % 256) +
    String.fromCharCode(Math.floor(n) % 256));
}

async function parseChunk(buffer, index) {

  const tag = getStringFromUInt32(buffer.readUInt32BE(index));
  const length = buffer.readUInt32BE(index + 4);
  let data;

  switch (tag) {
    case "oses":
    case "oent":
    case "otrk":
    case "adat":
      data = await parseChunkArray(buffer, index + 8, index + 8 + length);
      break;
    case "\u0000\u0000\u0000\u0001":
    case "\u0000\u0000\u0000\u000f":
      data = buffer.readUInt32BE(index + 8);
      break;
    case "\u0000\u0000\u00005":
      const secondsSince1970 = buffer.readUInt32BE(index + 8);
      data = new Date(0);
      data.setUTCSeconds(secondsSince1970);
      break;
    default:
      data = buffer
        .toString("latin1", index + 8, index + 8 + length)
        .replace(/\0/g, "");
      break;
  }
  return {
    chunk: new Chunk(length, tag, data),
    newIndex: index + length + 8
  };
}

async function parseChunkArray(buffer, start, end) {

  const chunks = [];
  let cursor = start;

  while (cursor < end) {
    const { chunk, newIndex } = await parseChunk(buffer, cursor);
    cursor = newIndex;
    chunks.push(chunk);
  }
  return chunks;
}

async function getSessions(path) {

  const buffer = await fs.promises.readFile(path);
  const chunks = await parseChunkArray(buffer, 0, buffer.length);
  const sessions = {};

  chunks.forEach(chunk => {
    if (chunk.tag === "oses") {
      if (Array.isArray(chunk.data)) {
        if (chunk.data[0].tag === "adat") {
          if (Array.isArray(chunk.data[0].data)) {
            let date = "";
            let index = -1;
            chunk.data[0].data.forEach(subChunk => {
              if (subChunk.tag === "\u0000\u0000\u0000\u0001") {
                index = subChunk.data;
              }
              if (subChunk.tag === "\u0000\u0000\u0000)") {
                date = subChunk.data;
              }
            });
            sessions[date] = index;
          }
        }
      }
    }
  });

  var mostRecentDate = Object.keys(sessions).reduce((a, b) => Date.parse(a) > Date.parse(b) ? a : b);
  return { mostRecentDate: sessions[mostRecentDate] };

}

async function getSessionSongs(path) {

  const buffer = await fs.promises.readFile(path);
  const chunks = await parseChunkArray(buffer, 0, buffer.length);
  const songs = [];

  chunks.forEach(chunk => {
    if (chunk.tag === "oent") {
      if (Array.isArray(chunk.data)) {
        if (chunk.data[0].tag === "adat") {
          if (Array.isArray(chunk.data[0].data)) {
            let title = "";
            let artist = "";
            let bpm;
            let filePath = "";
            let timePlayed = new Date();
            chunk.data[0].data.forEach(subChunk => {

              console.log(subChunk);
             
              if (subChunk.tag === "\u0000\u0000\u0000\u0006") {
                title = subChunk.data;
              }
              if (subChunk.tag === "\u0000\u0000\u0000\u0007") {
                artist = subChunk.data;
              }
              if (subChunk.tag === "\u0000\u0000\u0000\u000f") {
                bpm = subChunk.data;
              }
              if (subChunk.tag === "pfil") {
                filePath = subChunk.data;
              }
              if (subChunk.tag === "\u0000\u0000\u00005") {
                timePlayed = subChunk.data;
              }
            });
            songs.push({ title, artist, bpm, filePath, timePlayed });
          }
        }
      }
    }
  });

  return songs.slice(-1);

}

async function getSeratoHistory(seratoPath) {

  const sessions = await getSessions(pathLib.join(seratoPath, 'History/history.database'));
  const result = [];

  for (const key in sessions) {
    if (sessions.hasOwnProperty(key)) {
      const session = sessions[key];
      const songlist = await getSessionSongs(pathLib.join(seratoPath, 'History/Sessions/', session + '.session'));
      result.push({ date: key, songs: songlist });
    }
  }

  return result;
}


class PlayHistory {

  constructor() {

    this.homeFolder = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
    this.optionsPath = process.platform != 'darwin' ? this.homeFolder + '\\Pioneer\\rekordboxAgent\\storage\\options.json' : this.homeFolder + '/Pioneer/rekordboxAgent/storage/options.json';
    this.outputPath = process.platform != 'darwin' ? require('os').homedir() + '\\unbox_output' : require('os').homedir() + '/unbox_output';
    this.mixxxDatabasePath = process.platform != 'darwin' ? process.env.HOME + '\\AppData\\Local\\Mixxx\\mixxxdb.sqlite' : this.homeFolder + '/Mixxx';

    this.streamTxtPath = process.env.APPDATA ? this.outputPath + '\\rekordbox_stream.txt' : this.outputPath + '/rekordbox_stream.txt';
    this.streamJSONPath = process.env.APPDATA ? this.outputPath + '\\rekordbox_stream.json' : this.outputPath + '/rekordbox_stream.json';
    this.historyJSONPath = process.env.APPDATA ? this.outputPath + '\\rekordbox_stream_history.json' : this.outputPath + '/rekordbox_stream_history.json';

    this.mostRecentArtist = '';
    this.mostRecentLabel = '';
    this.mostrecentRemix = '';
    this.mostrecentTrack = null;

    this.mode = null;
    this.startTimeStamp = null;
    this.trackTimestamp = null;

    this.traktorTimestamp = null;
    this.traktorArtist = '';
    this.traktorTrack = '';

    this.kuvoURL = null;
    this.row = null;

  }

  switchMode() {

    ipcMain.on('switch-mode', (event, arg) => {
      this.mode = arg;
      if (this.mode == 'traktor') {
        this.pollTraktor();
      }
    })

    this.startTimeStamp = null;
    this.trackTimestamp = null;

  }

  clearHistoryListener() {

    ipcMain.on('clear-history', (event, arg) => {
      fs.writeFileSync(this.streamTxtPath, '');
      fs.writeFileSync(this.streamJSONPath, JSON.stringify({ artist: '', track: '' }));
      fs.writeFileSync(this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' }, { artist: '', track: '' }, { artist: '', track: '' }] }));
      this.playlistHistory = [{ artist: '', track: '' }, { artist: '', track: '' }, { artist: '', track: '' }];
      this.startTimeStamp = Math.floor(+ new Date() / 1000);
    })

  }

  buildOutputDir() {

    // TODO Check if color.json file exists, send to front-end

    fs.rmdirSync(this.outputPath, { recursive: true });

    try {
      fs.accessSync(this.outputPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err) {
      fs.mkdirSync(this.outputPath);
    }

  }

  buildOverlays() {

    ipcMain.on('asynchronous-message', (event, arg) => {
      fs.writeFileSync(path.join(this.outputPath, 'color.json'), JSON.stringify({ color: arg }));
    })

    ipcMain.on('kuvoInput-message', (event, arg) => {
      this.kuvoURL = arg;
    })

    fs.copyFile(path.join(__dirname, 'play_history.html'), path.join(this.outputPath, 'play_history.html'), (err) => {
      if (err) { };
    });

    fs.copyFile(path.join(__dirname, 'now_playing.html'), path.join(this.outputPath, 'now_playing.html'), (err) => {
      if (err) { };
    });

    fs.copyFile(path.join(__dirname, 'now_playing_right.html'), path.join(this.outputPath, 'now_playing_right.html'), (err) => {
      if (err) { };
    });

    fs.copyFile(path.join(__dirname, 'next_up.html'), path.join(this.outputPath, 'next_up.html'), (err) => {
      if (err) { };
    });

    fs.copyFile(path.join(__dirname, 'asot.html'), path.join(this.outputPath, 'asot.html'), (err) => {
      if (err) { };
    });

  }


  pollTraktor() {

    const server = require('server');
    const { post } = server.router;
    const { error } = server.router;
    const { status } = server.reply;

    this.tracktorDecks = {};

    server({ port: 8081 }, [
      error(ctx => status(500).send(ctx.error.message)),
      post('/deckLoaded', ctx => {
        this.tracktorDecks[ctx.data['deck']] = { artist: ctx.data['artist'], track: ctx.data['title'], dateAdded: ctx.data['date'] }
      }),
      post('/updateDeck', ctx => {
        if ((this.tracktorDecks[ctx.data['deck']].dateAdded > this.traktorTimestamp) || (!this.traktorTimestamp)) {
          this.traktorArtist = this.tracktorDecks[ctx.data['deck']].artist
          this.traktorTrack = this.tracktorDecks[ctx.data['deck']].track
          this.traktorTimestamp = this.tracktorDecks[ctx.data['deck']].dateAdded;
        }
      })
    ]);
  }

  startServer() {
    var app = connect();
    app.use(serveStatic(this.outputPath));
    this.server = app.listen(8080);
  }

  stopServer() {
    this.server.close();
  }

  async scrapeKUVO(kuvoURL) {
    let browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    try {
      const page = await browser.newPage();
      await page.emulateTimezone('Europe/London');
      await page.setViewport({ width: 320, height: 600 })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 9_0_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13A404 Safari/601.1')
      await page.goto(kuvoURL, { waitUntil: 'networkidle0' });
      await page.waitForSelector(".tracklist-area", { timeout: 2000 });
      await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })
      let data = await page.evaluate(() => {
        var data = []
        var playlistLength = $(".tracklist-area").children("div").children().length
        var i;
        for (i = 0; i < playlistLength; i++) {
          var track = $(".tracklist-area").children("div").children()[i];
          var title = track.children[0].textContent
          var artist = track.children[1].textContent
          var timePlayed = track.children[2].textContent
          var a = timePlayed.split(':');
          var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
          data.push([seconds, artist, title])
        }
        return data
      });
      data.sort(sortFunction);
      function sortFunction(a, b) {
        if (a[0] === b[0]) {
          return 0;
        }
        else {
          return (a[0] > b[0]) ? -1 : 1;
        }
      }
      await browser.close();
      return data[0];
    }
    catch (err) {
      await browser.close();
      return [];
    }

  }

  getRecentTracks() {

    var _this = this;

    if (_this.mode === null) {
      return
    }

    if (_this.mode == 'traktor') {
      _this.trackTimestamp = _this.traktorTimestamp;
      var artist = _this.traktorArtist;
      var track = _this.traktorTrack;

      if ((_this.startTimeStamp) && (_this.startTimeStamp > _this.trackTimestamp)) {
        fs.writeFileSync(_this.streamTxtPath, '');
        fs.writeFileSync(_this.streamJSONPath, JSON.stringify({ artist: '', track: '' , remix: '', label: ''}));
        fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}] }));
        _this.playlistHistory = [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}];
      }
      if ((track.toUpperCase() != _this.mostrecentTrack) && (!_this.startTimeStamp || (_this.startTimeStamp < _this.trackTimestamp))) {
        _this.mostRecentArtist = artist.toUpperCase();
        _this.mostrecentTrack = track.toUpperCase();
        fs.access(_this.historyJSONPath, function (error) {
          if (error) {
            fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: _this.mostRecentArtist, track: _this.mostrecentTrack }] }));
          }
          else {
            let history = JSON.parse(fs.readFileSync(_this.historyJSONPath))['tracks'];
            if ((history) && (history.length == 3)) {
              history.pop()
            }
            _this.playlistHistory = [{ artist: artist.toUpperCase(), track: track.toUpperCase() }].concat(history);
          }
        })
      }
    }

    if (_this.mode == 'serato') {
      const path = pathLib.join(os.homedir(), 'Music/_Serato_/');

      getSeratoHistory(path).then(function (history) {

        _this.trackTimestamp = Math.floor(Date.parse(history[0]['songs'][0]['timePlayed']) / 1000);
        var artist = history[0]['songs'][0]['artist'];
        var track = history[0]['songs'][0]['title'];

        if ((_this.startTimeStamp) && (_this.startTimeStamp > _this.trackTimestamp)) {
          fs.writeFileSync(_this.streamTxtPath, '');
          fs.writeFileSync(_this.streamJSONPath, JSON.stringify({ artist: '', track: '' }));
          fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' }, { artist: '', track: '' }, { artist: '', track: '' }] }));
          _this.playlistHistory = [{ artist: '', track: '' }, { artist: '', track: '' }, { artist: '', track: '' }];
        }
        if ((track.toUpperCase() != _this.mostrecentTrack) && (!_this.startTimeStamp || (_this.startTimeStamp < _this.trackTimestamp))) {
          _this.mostRecentArtist = artist.toUpperCase();
          _this.mostrecentTrack = track.toUpperCase();
          fs.access(_this.historyJSONPath, function (error) {
            if (error) {
              fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: _this.mostRecentArtist, track: _this.mostrecentTrack }] }));
            }
            else {
              let history = JSON.parse(fs.readFileSync(_this.historyJSONPath))['tracks'];
              if ((history) && (history.length == 3)) {
                history.pop()
              }
              _this.playlistHistory = [{ artist: artist.toUpperCase(), track: track.toUpperCase() }].concat(history);
            }
          })
        }
      })
    }
    else if (_this.mode == 'mixxx') {
      let db = new sqlite3.Database(_this.mixxxDatabasePath)
      db.serialize(function () {
        db.each(`
          select
            li.artist, li.title, li.bpm, pt.pl_datetime_added
          from PlaylistTracks pt
          left join library li on li.id = pt.track_id
          order by pt.pl_datetime_added desc
          limit 1
        `, function (err, row) {
          var artist = row.artist;
          var track = row.title;
          _this.trackTimestamp = Math.floor(Date.parse(row.pl_datetime_added + " GMT") / 1000);

          if ((_this.startTimeStamp) && (_this.startTimeStamp > _this.trackTimestamp)) {
            fs.writeFileSync(_this.streamTxtPath, '');
            fs.writeFileSync(_this.streamJSONPath, JSON.stringify({ artist: '', track: '' , remix: '', label: ''}));
            fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}] }));
            _this.playlistHistory = [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}];
          }
          if ((track.toUpperCase() != _this.mostrecentTrack) && (!_this.startTimeStamp || (_this.startTimeStamp < _this.trackTimestamp))) {
            _this.mostRecentArtist = artist.toUpperCase();
            _this.mostrecentTrack = track.toUpperCase();
            fs.access(_this.historyJSONPath, function (error) {
              if (error) {
                fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: _this.mostRecentArtist, track: _this.mostrecentTrack }] }));
              }
              else {
                let history = JSON.parse(fs.readFileSync(_this.historyJSONPath))['tracks'];
                if ((history) && (history.length == 3)) {
                  history.pop()
                }
                _this.playlistHistory = [{ artist: artist.toUpperCase(), track: track.toUpperCase() }].concat(history);
              }
            })
          }
        })
      })
      db.close();
    }
    else if (_this.mode == 'rekordbox') {
      let db_path = JSON.parse(fs.readFileSync(_this.optionsPath))['options'][0][1];
      let db = new sqlite3.Database(db_path)
      db.serialize(function () {
        db.run("PRAGMA cipher_compatibility = 4");
        db.run("PRAGMA key = ''");
        db.each(`select 
                  h.created_at, 
                  ifnull(c.Title, '') as Track, 
                  ifnull(c.Subtitle, '') as Mix, 
                  ifnull(l.Name, '') as Label, 
                  ifnull(a.Name, '') as Artist
                  from djmdSongHistory as h
                  join djmdContent as c on h.ContentID = c.ID
                  left join djmdArtist as a on c.ArtistID = a.ID
                  left join djmdLabel as l on l.ID = c.LabelID
                  order by h.created_at desc
                  limit 1;`, function (err, row) {


          _this.scrapeKUVO(_this.kuvoURL).then((value) => {

            var now = new Date;
            var startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
            var timestamp = startOfDay / 1000;

            if ((timestamp + value[0]) > (Math.floor(Date.parse(row.created_at) / 1000))) {
              _this.trackTimestamp = value[0];
              _this.kuvoArist = value[1];
              _this.kuvoTrack = value[2];
            }
            else {
              _this.kuvoArist = null;
              _this.kuvoTrack = null;
            }
          });

          if (_this.kuvoArist) {
            artist = _this.kuvoArist.toUpperCase();
          }
          else {
            artist = row.Artist.toUpperCase();
          }

          if (_this.kuvoTrack) {
            track = _this.kuvoTrack.toUpperCase();
          }
          else {
            track = row.Track.toUpperCase();
          }

          var label = '';
          var remix = '';

          if (!_this.kuvoTrack) {
            label = row.Label.toUpperCase();
            remix = row.Mix.toUpperCase();
          }
            
          _this.trackTimestamp = Math.floor(Date.parse(row.created_at) / 1000);
          if ((_this.startTimeStamp) && (_this.startTimeStamp > _this.trackTimestamp)) {
            fs.writeFileSync(_this.streamTxtPath, '');
            fs.writeFileSync(_this.streamJSONPath, JSON.stringify({ artist: '', track: '' , remix: '', label: ''}));
            fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}] }));
            _this.playlistHistory = [{ artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}, { artist: '', track: '' , remix: '', label: ''}];
          }
          if ((track != _this.mostrecentTrack) && (!_this.startTimeStamp || (_this.startTimeStamp < _this.trackTimestamp))) {
            _this.mostRecentArtist = artist;
            _this.mostrecentTrack = track;
            _this.mostRecentLabel = label;
            _this.mostrecentRemix= remix;
            fs.access(_this.historyJSONPath, function (error) {
              if (error) {
                fs.writeFileSync(_this.historyJSONPath, JSON.stringify({ tracks: [{ artist: _this.mostRecentArtist, track: _this.mostrecentTrack , remix: _this.mostrecentRemix, label: _this.mostRecentLabel}] }));
              }
              else {
                let history = JSON.parse(fs.readFileSync(_this.historyJSONPath))['tracks'];
                if ((history) && (history.length == 3)) {
                  history.pop()
                }
                _this.playlistHistory = [{ artist: artist, track: track , remix: remix, label: label}].concat(history);
              }
            })
          }
        });
      });
      db.close();
    }
  };

  persistHistory() {

    this.getRecentTracks();

    if ((!this.startTimeStamp) || (this.startTimeStamp < this.trackTimestamp)) {
      fs.writeFileSync(this.streamTxtPath, this.mostRecentArtist + ' - ' + this.mostrecentTrack);
      fs.writeFileSync(this.streamJSONPath, JSON.stringify({ artist: this.mostRecentArtist, track: this.mostrecentTrack , label: this.mostRecentLabel, remix: this.mostrecentRemix}));
      fs.writeFileSync(this.historyJSONPath, JSON.stringify({ tracks: this.playlistHistory }));
    }

  }

  updateFrontEnd(mainWindow) {
    if (this.mostRecentArtist) {
      mainWindow.webContents.send('track-update', this.mostRecentArtist + ' - ' + this.mostrecentTrack);
    }
  }

}

if (require('electron-squirrel-startup')) {
  app.quit();
}

let rekordboxPlayHistory = new PlayHistory();

const createWindow = () => {

  rekordboxPlayHistory.buildOutputDir();
  rekordboxPlayHistory.buildOverlays();
  rekordboxPlayHistory.startServer();
  rekordboxPlayHistory.switchMode();
  rekordboxPlayHistory.clearHistoryListener();

  const mainWindow = new BrowserWindow({
    width: 400,
    height: 1000,
    webPreferences: {
      nodeIntegration: true
    }
  });


  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {

    rekordboxPlayHistory.persistHistory();

    setInterval(function () {
      rekordboxPlayHistory.persistHistory();
      rekordboxPlayHistory.updateFrontEnd(mainWindow);
    }, 10000);

  })

  mainWindow.on('closed', function () {
    rekordboxPlayHistory.stopServer();
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