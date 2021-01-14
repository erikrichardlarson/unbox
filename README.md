# unbox - rekordbox / Serato "Now Playing" overlays for Twitch / OBS

Display your current or recent rekordbox 6 or serato tracks to your viewers on Twitch. Inspired by PRACT OBS and ASOT.
<p align="center">
 <img src="https://cdn.discordapp.com/attachments/780172543771410452/783904760880562176/Screen_Shot_2020-12-02_at_7.56.55_PM.png" />
</p>

**Please back up your library before using this as corruption could occur, we're not responsible for any issues, or corruption that this software may cause to your library.**

If unbox is useful to you and you'd like to support future development, please feel free to [donate](https://paypal.me/erikrichardlarson?locale.x=en_US). Your support is much appreciated! Please send me your Twitch channel if you've supported and I'll post it here. 

**Our supporters**

<p float="left">
 <a href="https://www.twitch.tv/dj_frankwillard"><img src="https://static-cdn.jtvnw.net/jtv_user_pictures/654c4e52-c532-435e-8641-969666ce348f-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/654c4e52-c532-435e-8641-969666ce348f-profile_image-300x300.png" width="80" height="80" /></a>
<a href="https://www.twitch.tv/djaramistv"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/93f54a41-ec11-459a-885f-bb5ce4550aa9-profile_image-300x300.png" data-canonical-src="https://static-cdn.jtvnw.net/jtv_user_pictures/93f54a41-ec11-459a-885f-bb5ce4550aa9-profile_image-300x300.png" width="80" height="80" /></a>

</p>

## How to use
1. **Download the unbox desktop app.** Here's the mac version: [Mac Download](https://github.com/erikrichardlarson/unbox/releases/download/5.0/unbox_mac.zip) and here's the windows version: [Windows Download](https://github.com/erikrichardlarson/unbox/releases/download/5.0/unbox_windows.zip) Currently there is only support for rekordbox 6 or Serato. 

2. **Open the zip file you downloaded above, and open the unbox app. Select rekordbox or Serato mode.** On Windows you'll want to click the unbox.exe file. If Windows or Mac asks you to trust unbox, you'll need to do that. The source code is in this repo if you're concerned about security. When the app is open you'll see this window:  
<p align="center">
<img src="https://media.discordapp.net/attachments/790269915444805656/798699727783985172/Screen_Shot_2021-01-12_at_3.47.01_PM.png?width=400&height=900" data-canonical-src="https://media.discordapp.net/attachments/790269915444805656/798699727783985172/Screen_Shot_2021-01-12_at_3.47.01_PM.png?width=400&height=900" width="400" height="900" />
</p>

3. **Just keep unbox open when you're playing.** Now that unbox is open, you have access to four things:  

*  Two browser sources. The browser sources are just web pages that unbox automatically updates when it's open. These are the exact web pages you can add: http://localhost:8080/play_history.html or http://localhost:8080/now_playing.html. Below you can see what these browser sources look like. If rekordbox / Serato is on a different computer than you're streaming OBS on, you can grab the IP address of the computer running unbox / rekrdbox and use that in place of localhost for your browser source urls. You'll need to have both machines on the same network to make this work. The now playing overlay could look something like this: http://192.168.0.1:8080/now_playing.html
 
*  One txt file. You also have access to a "rekordbox_stream.txt" file in your home directory in a folder called unbox_output. You can add this as a text source in OBS, it updates in real time so you can display a plain text view of the current playing track in rekordbox or Serato. 

*  Ability to start a new history session. You can click the reset history button and it will start a fresh log for your tracks. 

<p align="center">
 <img src="https://cdn.discordapp.com/attachments/780172543771410452/783904760880562176/Screen_Shot_2020-12-02_at_7.56.55_PM.png" />
</p>
<p align="center">
 <img src="https://cdn.discordapp.com/attachments/780172543771410452/783841115802959902/unknown.png" />
</p>
