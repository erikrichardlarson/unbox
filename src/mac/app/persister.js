const fs = require('fs');
const path = require("path");


class Persister {

    constructor() {

        this.homeFolder = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
        this.optionsPath = process.platform != 'darwin' ? this.homeFolder + '\\Pioneer\\rekordboxAgent\\storage\\options.json' : this.homeFolder + '/Pioneer/rekordboxAgent/storage/options.json';
        this.outputPath = process.platform != 'darwin' ? require('os').homedir() + '\\unbox_output' : require('os').homedir() + '/unbox_output';

        this.streamTxtPath = process.env.APPDATA ? this.outputPath + '\\unbox.txt' : this.outputPath + '/unbox.txt';
        this.streamRemixTxtPath = process.env.APPDATA ? this.outputPath + '\\unbox_remix.txt' : this.outputPath + '/unbox_remix.txt';
        this.streamJSONPath = process.env.APPDATA ? this.outputPath + '\\unbox.json' : this.outputPath + '/unbox.json';
        this.historyJSONPath = process.env.APPDATA ? this.outputPath + '\\unbox_history.json' : this.outputPath + '/unbox_history.json';

    }

    clearHistory() {
        fs.writeFileSync(this.streamTxtPath, '');
        fs.writeFileSync(this.streamJSONPath, JSON.stringify({ artist: '', track: '' }));
        fs.writeFileSync(this.historyJSONPath, JSON.stringify({ tracks: [{ artist: '', track: '' }, { artist: '', track: '' }, { artist: '', track: '' }] }));
    }

    writeToLocal(mostRecentArtist, mostrecentTrack, mostRecentLabel, mostrecentRemix, mostRecentArtwork) {

        fs.writeFileSync(this.streamTxtPath, mostRecentArtist + ' - ' + mostrecentTrack);
        fs.writeFileSync(this.streamRemixTxtPath, mostrecentRemix ? mostRecentArtist + ' - ' + mostrecentTrack  + ` (${mostrecentRemix})` : mostRecentArtist + ' - ' + mostrecentTrack);
        fs.writeFileSync(path.join(this.outputPath, 'artist.txt'), mostRecentArtist);
        fs.writeFileSync(path.join(this.outputPath, 'track.txt'), mostrecentTrack);
        fs.writeFileSync(this.streamJSONPath, JSON.stringify({ artist: mostRecentArtist, track: mostrecentTrack, label: mostRecentLabel, remix: mostrecentRemix, artwork: mostRecentArtwork}));

    }
}

module.exports = Persister;