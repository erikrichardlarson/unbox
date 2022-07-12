const server = require('server');
const { post } = server.router;
const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const { denon } = require('./denon/main')

class Chunk {

    constructor(length, tag, data) {
        this.length = 0;
        this.length = length;
        this.tag = tag;
        this.data = data;
    }
}

class Poller {

    constructor(ipcMain, mainWindow) {
        this.currentTrackDetails = { artist: '', track: '', label: '', remix: '' };
        this.ipcMain = ipcMain;
        this.mainWindow = mainWindow;
    }

    rekordboxRT() {

    }

    rekordbox() {

        let homeFolder = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
        let optionsPath = process.platform != 'darwin' ? homeFolder + '\\Pioneer\\rekordboxAgent\\storage\\options.json' : homeFolder + '/Pioneer/rekordboxAgent/storage/options.json';
        let db_path = JSON.parse(fs.readFileSync(optionsPath))['options'][0][1];

        var sqlite3 = require('@journeyapps/sqlcipher').verbose();

        var db = new sqlite3.Database(db_path);

        let _this = this;

        db.serialize(function () {
            db.run("PRAGMA cipher_compatibility = 4");

            db.run("PRAGMA key = ''");

            db.each(`select 
                    h.created_at, 
                    ifnull(c.Title, '') as Track, 
                    ifnull(c.Subtitle, '') as Mix, 
                    ifnull(l.Name, '') as Label, 
                    ifnull(a.Name, '') as Artist,
                    ifnull(c.ImagePath, '') as Artwork
                    from djmdSongHistory as h
                    join djmdContent as c on h.ContentID = c.ID
                    left join djmdArtist as a on c.ArtistID = a.ID
                    left join djmdLabel as l on l.ID = c.LabelID
                    order by h.created_at desc
                    limit 1;`, function (err, row) {
                if (err) {
                    console.log(err)
                }
                if (row) {
                    let artist = row['Artist'].toUpperCase();
                    let track = row['Track'].toUpperCase();
                    let label = row['Label'].toUpperCase();
                    let remix = row['Mix'].toUpperCase();
                    _this.currentTrackDetails['artist'] = artist;
                    _this.currentTrackDetails['track'] = track;
                    _this.currentTrackDetails['label'] = label;
                    _this.currentTrackDetails['remix'] = remix;
                }
            });
        });
    }

    async kuvo(kuvoURL) {

        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
        }

        var _this = this;

        try {
            const context = await this.browser.newContext({
                timezoneId: 'Europe/London',
            });
            const page = await context.newPage();
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
            await context.close();
            _this.currentTrackDetails['artist'] = data[0][1];
            _this.currentTrackDetails['track'] = data[0][2];
            _this.currentTrackDetails['label'] = '';
            _this.currentTrackDetails['remix'] = '';
            _this.currentTrackDetails['artwork'] = '';
            return data[0];
        }
        catch (err) {
            await this.browser.close();
            this.browser = null;
            return [];
        }

    }

    async serato() {

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

        const seratoPath = path.join(os.homedir(), 'Music/_Serato_/');
        const sessions = await getSessions(path.join(seratoPath, 'History/history.database'));
        const result = [];

        for (const key in sessions) {
            if (sessions.hasOwnProperty(key)) {
                const session = sessions[key];
                const songlist = await getSessionSongs(path.join(seratoPath, 'History/Sessions/', session + '.session'));
                result.push({ date: key, songs: songlist });
            }
        }

        this.currentTrackDetails['artist'] = result[0]['songs'][0]['artist'];
        this.currentTrackDetails['track'] = result[0]['songs'][0]['title'];
        this.currentTrackDetails['label'] = '';
        this.currentTrackDetails['remix'] = '';
        this.currentTrackDetails['artwork'] = '';

        return result;
    }

    async seratoLive(seratoURL) {

        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
        }

        var _this = this;

        try {
            const context = await this.browser.newContext({
                timezoneId: 'Europe/London',
            });
            const page = await context.newPage();
            await page.goto(seratoURL, { waitUntil: 'networkidle0' });
            await page.waitForSelector(".playlist-track", { timeout: 2000 });
            await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })
            let data = await page.evaluate(() => {
                var data = [];
                var tracks = $('.playlist-track');
                var lastTrack = tracks[tracks.length - 1];
                var timePlayed = lastTrack.children[0].textContent.trim();
                var artistTrack = lastTrack.children[1].textContent.trim();
                let [artist, title] = artistTrack.split(' - ');
                var a = timePlayed.split(':');
                var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
                data.push([seconds, artist, title]);
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
            await context.close();
            _this.currentTrackDetails['artist'] = data[0][1];
            _this.currentTrackDetails['track'] = data[0][2];
            _this.currentTrackDetails['label'] = '';
            _this.currentTrackDetails['remix'] = '';
            _this.currentTrackDetails['artwork'] = '';
            return data[0];
        }
        catch (err) {
            await this.browser.close();
            this.browser = null;
            return [];
        }
    }

    virtualDJ() {

        var tracks = fs.readFileSync(process.env.HOME + '/Documents/VirtualDJ/History/tracklist.txt').toString().split('\n');
        tracks.pop();
        var lastLine = tracks.pop()
        var artistTrack = lastLine.split(' : ').pop().trim()
        var artist = artistTrack.split(' - ')[0]
        var track = artistTrack.split(' - ')[1]
        var time = lastLine.split(' : ')[0];

        this.currentTrackDetails['artist'] = artist;
        this.currentTrackDetails['track'] = track;
        this.currentTrackDetails['label'] = '';
        this.currentTrackDetails['remix'] = '';
        this.currentTrackDetails['artwork'] = '';
    }

    traktor() {

        if (this.webServer) {
            return
        }

        this.traktorTimestamp = null;
        this.traktorDecks = {};
        this.removedDecks = {};

        this.ipcMain.on('update-traktor-decks', (event, arg) => {
            this.removedDecks = { ...this.removedDecks, ...arg };
            Object.keys(this.removedDecks).forEach(key => {
                if (this.removedDecks[key]) delete this.removedDecks[key];
            });
        }
        )

        var _this = this;

        this.webServer = server({ port: 8081, security: { csrf: false } }, [
            post('/deckLoaded', ctx => {
                if ((!Object.keys(_this.removedDecks)) || (!Object.keys(_this.removedDecks).includes(ctx.data['deck']))) {
                    _this.traktorDecks[ctx.data['deck']] = { artist: ctx.data['artist'], track: ctx.data['title'], dateAdded: ctx.data['date'], label: ctx.data['label'], remixer: ctx.data['remixer'] }
                }
            }),
            post('/updateDeck', ctx => {
                if (!ctx.data['propVolume']) {
                    return
                }
                if (((ctx.data['deck'] == 'A') || (ctx.data['deck'] == 'C')) && (ctx.data['propXfaderAdjust'] == 1)) {
                    return
                }
                if (((ctx.data['deck'] == 'B') || (ctx.data['deck'] == 'D')) && (ctx.data['propXfaderAdjust'] == 0)) {
                    return
                }

                if (((!Object.keys(_this.removedDecks)) || (!Object.keys(_this.removedDecks).includes(ctx.data['deck'])))) {
                    _this.traktorTimestamp = _this.traktorDecks[ctx.data['deck']].dateAdded;
                    _this.currentTrackDetails['artist'] = _this.traktorDecks[ctx.data['deck']].artist;
                    _this.currentTrackDetails['track'] = _this.traktorDecks[ctx.data['deck']].track;
                    _this.currentTrackDetails['label'] = _this.traktorDecks[ctx.data['deck']].label;
                    _this.currentTrackDetails['remix'] = _this.traktorDecks[ctx.data['deck']].remixer;
                    _this.currentTrackDetails['artwork'] = '';
                }
            })
        ])
    }

    denon() {

        if (this.denonPoller) {
            return
        }

        var _this = this;
        var denonOutputPath = process.platform == 'darwin' ? 'denon/services/deckState.json' : 'denon\\services\\deckState.json';

        denon().then(() => {

            _this.denonPoller = true;

            fs.watchFile(path.join(__dirname, '../../app/' + denonOutputPath), (curr, prev) => {

                let deckState = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app/' + denonOutputPath), 'utf8'));

                let decks = ['Deck1', 'Deck2', 'Deck3', 'Deck4'];
                let maxVolume = 0;
                decks.forEach(deck => {
                    if ((deckState[deck]['ExternalMixerVolume'] > maxVolume) && (deckState[deck]['PlayState'])) {
                        maxVolume = deckState[deck]['ExternalMixerVolume'];
                    }
                });
                decks.forEach(deck => {
                    if ((deckState[deck]['ExternalMixerVolume'] == maxVolume) && (deckState[deck]['PlayState'])) {
                        _this.currentTrackDetails['artist'] = deckState[deck]['ArtistName'];
                        _this.currentTrackDetails['track'] = deckState[deck]['SongName'];
                    }
                });
            });
        }).catch(err => {
            console.log(err)
        })
    }

    mixxx() {

        let mixxxDatabasePath = process.platform != 'darwin' ? process.env.HOME + '\\AppData\\Local\\Mixxx\\mixxxdb.sqlite' : process.env.HOME + '/Library/Application Support' + '/Mixxx/mixxxdb.sqlite';
        var sqlite3 = require('@journeyapps/sqlcipher').verbose();

        var db = new sqlite3.Database(mixxxDatabasePath);
        let _this = this;

        db.each(`select
                li.artist, li.title, li.bpm, pt.pl_datetime_added
                from PlaylistTracks pt
                left join library li on li.id = pt.track_id
                order by pt.pl_datetime_added desc
                limit 1`, function (err, row) {
            if (err) {
                console.log(err)
            }
            if (row) {
                let artist = row.artist.toUpperCase();
                let track = row.title.toUpperCase();
                let label = '';
                let remix = '';
                _this.currentTrackDetails['artist'] = artist;
                _this.currentTrackDetails['track'] = track;
                _this.currentTrackDetails['label'] = label;
                _this.currentTrackDetails['remix'] = remix;
                _this.currentTrackDetails['artwork'] = '';
            }
        });

        let row = db.prepare(``).all();



    }
}

exports.Poller = Poller;