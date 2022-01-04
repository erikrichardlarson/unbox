const  Persister  = require('./persister');
const { Poller } = require('./poller');
const { chromium } = require('playwright');


class Playlist {

  constructor(ipcMain, mainWindow) {

    this.persister = new Persister();
    this.poller = new Poller(ipcMain, mainWindow);
    this.browser = null;
    this.playlistURL = null;
    this.ipcMain = ipcMain;
    this.mainWindow = mainWindow;
  }

  async setMode(mode) {

    this.mode = mode;

    if (mode == 'kuvo') {
      this.ipcMain.on('get-kuvo-playlist', async (event, arg) => {
        this.playlistURL = await this.getPlaylistURL(arg, 'kuvo');    
        this.mainWindow.send('update-kuvo-url', this.playlistURL)
      })
    }

    if (this.mode == 'serato_live') {
      this.ipcMain.on('get-serato-playlist', async (event, arg) => {
        this.playlistURL = await this.getPlaylistURL(arg, 'serato');    
        this.mainWindow.send('update-serato-url', this.playlistURL)
      })
      
    }
  }

  update() {

    if (this.mode == 'kuvo') {
      this.poller.kuvo(this.playlistURL);
    }

    if (this.mode == 'rekordbox_realtime') {
      this.poller.rekordboxRT();
    }

    if (this.mode == 'rekordbox') {
      this.pollerUpdate = this.poller.rekordbox();
    }

    if (this.mode == 'serato') {
      this.poller.serato();
    }

    if (this.mode == 'serato_live') {
      this.poller.seratoLive(this.playlistURL);
    }

    if ((this.mode == 'traktor')) {
      this.poller.traktor();
    }

    if (this.mode == 'mixxx') {
      this.poller.mixxx();
    }

    if (this.mode == 'denon') {
      this.poller.denon();
    }

    if (this.mode == 'virtualdj') {
      this.poller.virtualDJ();
    }

    let mostRecentArtist = this.poller.currentTrackDetails['artist'];
    let mostrecentTrack = this.poller.currentTrackDetails['track'];
    let mostRecentLabel = this.poller.currentTrackDetails['label'];
    let mostrecentRemix = this.poller.currentTrackDetails['remix'];
    let mostRecentArtwork = this.poller.currentTrackDetails['artwork'];

    this.persister.writeToLocal(mostRecentArtist, mostrecentTrack, mostRecentLabel, mostrecentRemix, mostRecentArtwork);
  }


  async getPlaylistURL(userId, mode) {
    let browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    
    try {

      const page = await browser.newPage();
      const context = await browser.newContext({
        timezoneId: 'Europe/London',
      });

      if (mode == 'serato') {
        await page.goto(`https://serato.com/playlists/${userId}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector(".playlist-row-grid", { timeout: 2000 });
        
        var url = await page.evaluate(() => {
          return document.getElementsByClassName('playlist-title')[0].href;
        });
      }

      else if (mode == 'kuvo') {

        await page.goto(`https://kuvo.com/user/${userId}/djmix`, { waitUntil: 'networkidle0' });
        await page.waitForSelector(".playlist-row", { timeout: 2000 });
        
        var url = await page.evaluate(() => {
          return document.getElementsByClassName('playlist-row')[0].href;
        });

      }

      await browser.close();
      return url
    }
    catch (err) {
      await browser.close();
      return
    }
  }
}

module.exports = Playlist;