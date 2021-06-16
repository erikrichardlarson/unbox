# unbox - rekordbox / Serato / Traktor / VirtualDJ / Denon / Mixxx "Now Playing" overlays for Twitch / OBS

Display your current or recent rekordbox / serato / traktor / virtualdj / denon / mixxx tracks to your viewers on Twitch. Inspired by PRACT OBS and ASOT.
<p align="center">
 <img src="https://cdn.discordapp.com/attachments/780172543771410452/783904760880562176/Screen_Shot_2020-12-02_at_7.56.55_PM.png" />
</p>

**Please back up your library before using this as corruption could occur, we're not responsible for any issues, or corruption that this software may cause to your library.**

If unbox is useful to you and you'd like to support future development, please feel free to [donate](https://paypal.me/erikrichardlarson?locale.x=en_US). Your support is much appreciated! Please send me your Twitch channel if you've supported and I'll post it here. 

**Our supporters**

<p float="left">
 <a href="https://www.twitch.tv/dj_frankwillard"><img src="https://static-cdn.jtvnw.net/jtv_user_pictures/e00acb7c-4b8b-4227-9642-c4f0a5ce5962-profile_image-70x70.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/e00acb7c-4b8b-4227-9642-c4f0a5ce5962-profile_image-70x70.png" width="80" height="80" /></a>
<a href="https://www.twitch.tv/djaramistv"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/93f54a41-ec11-459a-885f-bb5ce4550aa9-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/93f54a41-ec11-459a-885f-bb5ce4550aa9-profile_image-300x300.png" width="80" height="80" /></a>
<a href="https://www.twitch.tv/djtaylornorris"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/d533704e-55a7-4912-b744-82e0c63e93b9-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/d533704e-55a7-4912-b744-82e0c63e93b9-profile_image-300x300.png" width="80" height="80" /></a>
 <a href="https://www.twitch.tv/geoffbutler"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/42c50839-6fe5-4a18-b61c-09d0f1d44ab2-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/42c50839-6fe5-4a18-b61c-09d0f1d44ab2-profile_image-300x300.png" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/reorderdj"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/7716d257-49e5-41ec-8404-2a4883507b2a-profile_image-70x70.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/7716d257-49e5-41ec-8404-2a4883507b2a-profile_image-70x70.png" width="80" height="80" /></a>
 <a href="https://www.twitch.tv/djnixinthemix"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/9aa5b25e-8b92-4fe3-9fba-e5055a98a77e-profile_image-70x70.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/9aa5b25e-8b92-4fe3-9fba-e5055a98a77e-profile_image-70x70.png" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/hybrid_blak/"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/5596fc47-d7aa-4082-ae88-b4cc07ceb032-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/5596fc47-d7aa-4082-ae88-b4cc07ceb032-profile_image-300x300.png" width="80" height="80" /></a>
 <a href="https://www.twitch.tv/nt_demon_au	"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/d0ae4349-cbe5-4af2-83b6-3d407328fbde-profile_image-70x70.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/d0ae4349-cbe5-4af2-83b6-3d407328fbde-profile_image-70x70.png" width="80" height="80" /></a>
</p>

## How to use
1. **Download the unbox desktop app.** Here's the mac version: [Mac Download](https://github.com/erikrichardlarson/unbox/releases/download/8.2/unbox-mac.zip) and here's the windows version: [Windows Download](https://github.com/erikrichardlarson/unbox/releases/download/8.2/unbox-windows.zip) Currently there is support for rekordbox 5 / 6, Traktor, Serato, and VirtualDJ. 

**Extra step for Traktor users only: If you're on Traktor, you also need to download this [D2 file](https://github.com/erikrichardlarson/unbox/releases/download/7.0/D2.zip), unzip and just place it in your CSI folder located at C:\Program Files\Native Instruments\Traktor Pro 3\Resources64\qml\CSI on Windows or /Applications/Native Instruments/Traktor Pro 3/Traktor.app/Contents/Resources/qml/CSI on Mac. There is a D2 folder already in this CSI directory so it's best to make a backup of that. And if you don't own a Kontrol D2, go to Controller Manager in your preferences, click Add beneath the device dropdown, and add Traktor then select Kontrol D2. I would automate this for you but permissioning makes it tricky, sorry Traktor users.**

**Denon users: Please make sure your player is online before selecting the Denon mode.**

2. **Open the unbox zip file you downloaded above, and open the unbox app, on Windows you'll want to click the unbox.exe file. When it's open just select your mode. If you select real-time rekordbox on Windows another launcher will come up, select the version of rekordbox you're on in the dropdown and click launch, please leave all other settings intact.** If Windows or Mac asks you to trust unbox, you'll need to do that. The source code is in this repo if you're concerned about security. When the app is open you'll see this window:  
<p align="center">
<img src="https://media.discordapp.net/attachments/790269915444805656/842113372522676274/Screen_Shot_2021-05-12_at_11.57.24_AM.png?width=614&height=614" data-canonical-src="https://media.discordapp.net/attachments/790269915444805656/842113372522676274/Screen_Shot_2021-05-12_at_11.57.24_AM.png?width=614&height=614" />
</p>

3. **Just keep unbox open when you're playing.** Now that unbox is open, you have access to a few things:  

*  Browser sources. The browser sources are just web pages that unbox automatically updates when it's open. The dropdown on the second step of the app gives you all available sources, on the third step of the app you can copy the link to your clipboard. For example you can add: http://localhost:8080/history.html or http://localhost:8080/asot.html. Below you can see what these browser sources look like. If rekordbox / Serato / Traktor is on a different computer than you're streaming OBS on, you can grab the IP address of the computer running unbox / rekordbox / Serato / Traktor and use that in place of localhost for your browser source urls. You'll need to have both machines on the same network to make this work. The now playing overlay could look something like this: http://192.168.0.1:8080/asot.html
 
*  Three txt files. You also have access to a "rekordbox_stream.txt" file in your home directory in a folder called unbox_output. You can add this as a text source in OBS, it updates in real time so you can display a plain text view of the current playing track. The other two files are artist.txt and track.txt which are just the artist and track separated. 

*  To use KUVO live playlists. Just paste in your user id, click get playlist, and we'll find your latest playlist.

<p align="center">
 <img src="https://media.discordapp.net/attachments/790269915444805656/802319468609011712/Screen_Shot_2021-01-22_at_3.30.39_PM.png" />
</p>

### Customize

You can customize the text by adding CSS into the browser source in OBS. One use case would be to add a shadow. This can be useful to brighten or change the background lighting.
You can use [CSS Shadow generator](https://html-css-js.com/css/generator/text-shadow/) to help you find the right CSS code. Then just **add** the lines into the existing browser source Custom CSS box in OBS to avoid overriding the pre-existing CSS.

<p align="center">
 <img src="images/shadow.jpg?raw=true" />
</p>

