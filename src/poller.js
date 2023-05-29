const server = require('server');
const {post} = server.router;
const fs = require('fs');
const {chromium} = require('playwright-chromium');
const path = require('path');
const os = require('os');
const Store = require("electron-store");
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const axios = require('axios');
const prolinkConnect = require('prolink-connect');

const store = new Store({name: "unbox"});

class Poller {

    constructor(websocketServer) {
        this.websocketServer = websocketServer;
        this.lastTrack = null;
        this.prodjlinkConnected = false;
    }

    isNewTrack(trackDetails) {
        if (!this.lastTrack || this.lastTrack.artist !== trackDetails.artist || this.lastTrack.track !== trackDetails.track) {
            this.lastTrack = trackDetails;
            return true;
        }
        return false;
    }

    async getTrackMetadata(currentTrackMetadata) {
        const authToken = store.get('authToken');
        if (!authToken) {
            return currentTrackMetadata;
        }
        try {
            let {artist, title, track, remix, artwork} = currentTrackMetadata;
            track = title || track;
            if (artist && track && remix && artwork) {
                return currentTrackMetadata;
            }
            const response = await axios.post('https://unbox-api.herokuapp.com/api/search',
                {artist, track, remix},
                {
                    headers: {
                        'Authorization': authToken
                    }
                });
            await this.storeRecommendedTracks(response.data.recommendedTracks);
            if (response.data.trackDetails.artworkBuffer) {
                response.data.trackDetails.artwork = `data:${response.data.trackDetails.artworkMimeType};base64,${response.data.trackDetails.artworkBuffer}`;
            }

            let mergedTrackDetails = {};

            Object.keys(response.data.trackDetails).forEach((key) => {
                mergedTrackDetails[key] = response.data.trackDetails[key];
            });

            Object.keys(currentTrackMetadata).forEach((key) => {
                if (currentTrackMetadata[key]) {
                    if (key === 'track' && mergedTrackDetails['track']) {
                        return;
                    }
                    mergedTrackDetails[key] = currentTrackMetadata[key];
                }
            });
            return mergedTrackDetails;
        } catch (e) {
            console.error(e);
            return currentTrackMetadata;
        }
    }

    async storeRecommendedTracks(recommendedTracks) {
        if (!recommendedTracks) {
            return;
        }
        let currentRecommendedTracks = store.get('recommendedTracks') || [];
        recommendedTracks = currentRecommendedTracks.concat(recommendedTracks);
        if (recommendedTracks.length > 500) {
            recommendedTracks = recommendedTracks.slice(-500);
        }
        store.set('recommendedTracks', recommendedTracks);
    }

    async prodjlink() {
        if (this.prodjlinkConnected) {
            return;
        }

        try {
            this.prodjlinkConnected = true
            const network = await prolinkConnect.bringOnline();
            network.deviceManager.on("connected", (d) => console.log('Connected to device'));
            await network.autoconfigFromPeers();
            network.connect();
            if (!network.isConnected()) {
                throw new Error("Failed to connect to the network");
            }

            const processor = new prolinkConnect.MixstatusProcessor();
            network.statusEmitter.on("status", (s) => processor.handleState(s));

            processor.on("nowPlaying", async (state) => {
                const {trackDeviceId, trackId, trackSlot, trackType} = state;
                const track = await network.db.getMetadata({
                    trackId,
                    trackType,
                    trackSlot,
                    deviceId: trackDeviceId,
                });

                let trackDetails = {
                    artist: track?.artist?.name,
                    track: track?.title,
                    label: track?.label?.name,
                    remix: track?.remixer?.name
                };

                trackDetails.artwork = await this.getArtworkAsBase64(track.artwork?.path);

                if (this.isNewTrack(trackDetails)) {
                    trackDetails = await this.getTrackMetadata(trackDetails);
                    this.websocketServer.broadcastMessage(trackDetails);
                }
            });
        } catch (error) {
            console.error(error);
        }
    }

    async getArtworkAsBase64(artworkPath) {
        if (!artworkPath) return null;

        try {
            const data = await fs.promises.readFile(artworkPath);
            return `data:image/jpeg;base64,${data.toString('base64')}`;
        } catch (error) {
            console.error(`Failed to convert artwork to base64: ${error}`);
            return null;
        }
    }

    async rekordbox() {

        let homeFolder = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
        let optionsPath = path.join(homeFolder, 'Pioneer', 'rekordboxAgent', 'storage', 'options.json');
        let db_path = JSON.parse(fs.readFileSync(optionsPath))['options'][0][1];
        let db = new sqlite3.Database(db_path);

        db.serialize(() => {
            db.run("PRAGMA cipher_compatibility = 4");
            let key = process.env.RB_KEY;
            db.run(`PRAGMA key = '${key}'`);
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
                    limit 1;`, async (err, row) => {
                if (err) {
                    console.log(err)
                }
                if (row) {
                    let artist = row['Artist'].toUpperCase();
                    let track = row['Track'].toUpperCase();
                    let label = row['Label'].toUpperCase();
                    let remix = row['Mix'].toUpperCase();
                    let artwork = row['Artwork'];
                    let rekordboxArtworkDir = path.join(os.homedir(), 'Library', 'Pioneer', 'rekordbox', 'share', artwork);
                    let imageDataUrl = await this.getArtworkAsBase64(rekordboxArtworkDir);
                    let trackDetails = {
                        artist: artist, track: track, label: label,
                        remix: remix, artwork: imageDataUrl
                    };
                    if (this.isNewTrack(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                }
            });
        });
    }

    async serato(seratoUserId) {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        try {
            const context = await this.browser.newContext({timezoneId: 'Europe/London'});
            const page = await context.newPage();
            await page.goto(`https://serato.com/playlists/${seratoUserId}`, {waitUntil: 'networkidle'});
            await page.waitForSelector(".playlist-row-grid", {timeout: 2000});
            const url = await page.evaluate(() => {
                return document.getElementsByClassName('playlist-title')[0].href;
            });
            await page.goto(url, {waitUntil: 'networkidle'});
            await page.waitForSelector(".playlist-track", {timeout: 2000});
            const data = await page.evaluate(() => {
                const tracks = document.querySelectorAll('.playlist-track');
                const lastTrack = tracks[tracks.length - 1];
                const timePlayed = lastTrack.children[0].textContent.trim();
                const artistTrack = lastTrack.children[1].textContent.trim();
                const [artist, title] = artistTrack.split(' - ');
                const timeParts = timePlayed.split(':');
                const seconds = (+timeParts[0]) * 60 * 60 + (+timeParts[1]) * 60 + (+timeParts[2]);

                return [[seconds, artist, title]];
            });
            data.sort((a, b) => {
                if (a[0] === b[0]) {
                    return 0;
                } else {
                    return (a[0] > b[0]) ? -1 : 1;
                }
            });
            await context.close();
            const [seconds, artist, title] = data[0];
            let trackDetails = {
                artist: artist, track: title, label: '',
                remix: '', artwork: ''
            };
            if (this.isNewTrack(trackDetails)) {
                trackDetails = await this.getTrackMetadata(trackDetails);
                this.websocketServer.broadcastMessage(trackDetails);
            }
            return data[0];
        } catch (err) {
            await this.browser.close();
            this.browser = null;
            return [];
        }
    }

    virtualDJ() {

        if (this.virtualDJWebServer) {
            return
        }

        this.virtualDJDecks = {};
        this.virtualDJWebServer = server({port: 8081, security: {csrf: false}}, [
            post('/deckLoaded', async ctx => {
                try {
                    const {deck, artist, title, remix} = ctx.data;
                    this.virtualDJDecks[deck] = {
                        artist,
                        track: title,
                        remix
                    };
                    let trackDetails = {
                        artist: this.virtualDJDecks[deck].artist,
                        track: this.virtualDJDecks[deck].track, label: '',
                        remix: this.virtualDJDecks[deck].remix, artwork: ''
                    };
                    trackDetails = await this.getTrackMetadata(trackDetails);
                    ctx.status = 200;
                    ctx.body = {message: "Deck loaded successfully."};
                } catch (error) {
                    ctx.status = 500;
                    ctx.body = {error: "Internal Server Error"};
                }
            }),
            post('/activeDeck', async ctx => {
                try {
                    const {deck} = ctx.data;
                    let trackDetails = {
                        artist: this.virtualDJDecks[deck].artist,
                        track: this.virtualDJDecks[deck].track, label: '',
                        remix: this.virtualDJDecks[deck].remix, artwork: ''
                    };
                    if (this.isNewTrack(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                    ctx.status = 200;
                    ctx.body = {message: "Active deck recorded."};
                } catch (error) {
                    ctx.status = 500;
                    ctx.body = {error: "Internal Server Error"};
                }
            }),
        ])
    }

    djuced() {
        const djucedDB = process.platform === 'win32'
            ? path.join(process.env.USERPROFILE, 'Documents', 'DJUCED', 'DJUCED.db')
            : path.join(os.homedir(), 'Documents', 'DJUCED', 'DJUCED.db');
        let db = new sqlite3.Database(djucedDB);
        db.serialize(() => {
            db.get(`SELECT
            artist, title
            FROM tracks
            WHERE last_played IS NOT NULL
            ORDER BY last_played DESC
            LIMIT 1`, async (err, row) => {
                if (err) {
                    console.log(err);
                }
                if (row) {
                    let artist = row.artist.toUpperCase();
                    let track = row.title.toUpperCase();
                    let trackDetails = {
                        artist: artist,
                        track: track, label: '',
                        remix: '', artwork: ''
                    };
                    if (this.isNewTrack(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                }
            });
            db.close();
        });

    }

    _getMostLikelyPlayingTraktorDeck(deckData) {
        let mostLikelyPlayingDeck = null;
        let highestScore = -Infinity;

        for (const deck in deckData) {
            if (deckData.hasOwnProperty(deck)) {
                const deckDetails = deckData[deck];

                let score;
                if (deck === 'A' || deck === 'C') {
                    score = deckDetails.propVolume * (1 - deckDetails.propXfaderAdjust);
                } else {
                    score = deckDetails.propVolume * deckDetails.propXfaderAdjust;
                }

                if (score > highestScore && deckDetails.isPlaying) {
                    highestScore = score;
                    mostLikelyPlayingDeck = deck;
                }
            }
        }

        return mostLikelyPlayingDeck;
    }

    traktor() {

        if (this.webServer) {
            return
        }

        this.traktorDecks = {};

        this.webServer = server({port: 8081, security: {csrf: false}}, [
            post('/deckLoaded', async ctx => {
                try {
                    const {
                        deck,
                        artist,
                        title,
                        date,
                        label,
                        remixer,
                        propXfaderAdjust,
                        propVolume,
                        isPlaying
                    } = ctx.data;
                    if (!deck || typeof deck !== 'string' || !['A', 'B', 'C', 'D'].includes(deck)) {
                        ctx.status = 400;
                        ctx.body = {error: "Invalid or missing 'deck' parameter."};
                        return;
                    }
                    this.traktorDecks[deck] = {
                        artist,
                        track: title,
                        dateAdded: date,
                        label: label,
                        remixer: remixer,
                        propVolume: propVolume,
                        propXfaderAdjust: propXfaderAdjust
                    };
                    this.traktorDecks[deck].propVolume = propVolume;
                    this.traktorDecks[deck].propXfaderAdjust = propXfaderAdjust;
                    if (isPlaying) {
                        this.traktorDecks[deck].isPlaying = isPlaying;
                    }
                    const mostLikelyPlayingDeck = this._getMostLikelyPlayingTraktorDeck(this.traktorDecks);
                    let trackDetails = {
                        artist: this.traktorDecks[mostLikelyPlayingDeck].artist,
                        track: this.traktorDecks[mostLikelyPlayingDeck].track,
                        label: this.traktorDecks[mostLikelyPlayingDeck].label,
                        remix: this.traktorDecks[mostLikelyPlayingDeck].remixer,
                        artwork: ''
                    };
                    if (this.isNewTrack(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                    ctx.status = 200;
                    ctx.body = {message: "Deck loaded successfully."};
                } catch (error) {
                    ctx.status = 500;
                    ctx.body = {error: "Internal Server Error"};
                }
            }),
            post('/updateDeck', async ctx => {
                try {
                    const {deck, propVolume, propXfaderAdjust, isPlaying} = ctx.data;
                    if (!deck || typeof deck !== 'string' || !['A', 'B', 'C', 'D'].includes(deck)) {
                        ctx.status = 400;
                        ctx.body = {error: "Invalid or missing 'deck' parameter."};
                        return;
                    }
                    if (!propVolume) {
                        ctx.status = 400;
                        ctx.body = {error: "Missing 'propVolume' parameter."};
                        return;
                    }
                    if (((deck === 'A') || (deck === 'C')) && (propXfaderAdjust === 1)) {
                        return
                    }
                    if (((deck === 'B') || (deck === 'D')) && (propXfaderAdjust === 0)) {
                        return
                    }

                    this.traktorDecks[deck].propVolume = propVolume;
                    this.traktorDecks[deck].propXfaderAdjust = propXfaderAdjust;
                    if (isPlaying) {
                        this.traktorDecks[deck].isPlaying = isPlaying;
                    }
                    const mostLikelyPlayingDeck = this._getMostLikelyPlayingTraktorDeck(this.traktorDecks);
                    let trackDetails = {
                        artist: this.traktorDecks[mostLikelyPlayingDeck].artist,
                        track: this.traktorDecks[mostLikelyPlayingDeck].track,
                        label: this.traktorDecks[mostLikelyPlayingDeck].label,
                        remix: this.traktorDecks[mostLikelyPlayingDeck].remixer,
                        artwork: ''
                    };
                    if (this.websocketServer.isNewMessage(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                } catch (error) {
                    ctx.status = 500;
                    ctx.body = {error: "Internal Server Error"};
                }
            }),
            post('/updateChannel/', async ctx => {
                try {
                } catch (error) {
                    ctx.status = 500;
                    ctx.body = {error: "Internal Server Error"};
                }
            })
        ])
    }

    mixxx() {
        const mixxxDatabasePath = process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Containers', 'org.mixxx.mixxx', 'Data', 'Library', 'Application Support', 'Mixxx', 'mixxxdb.sqlite')
            : path.join(process.env.HOME, 'AppData', 'Local', 'Mixxx', 'mixxxdb.sqlite');
        let db = new sqlite3.Database(mixxxDatabasePath);
        db.serialize(() => {
            db.get(`SELECT
            li.artist, li.title, li.bpm, pt.pl_datetime_added
            FROM PlaylistTracks pt
            LEFT JOIN library li ON li.id = pt.track_id
            ORDER BY pt.pl_datetime_added DESC
            LIMIT 1`, async (err, row) => {
                if (err) {
                    console.log(err);
                }
                if (row) {
                    let artist = row.artist.toUpperCase();
                    let track = row.title.toUpperCase();
                    let trackDetails = {
                        artist: artist,
                        track: track,
                    };
                    if (this.isNewTrack(trackDetails)) {
                        trackDetails = await this.getTrackMetadata(trackDetails);
                        this.websocketServer.broadcastMessage(trackDetails);
                    }
                }
            });
            db.close();
        });
    }
}

module.exports = {
    Poller
};
