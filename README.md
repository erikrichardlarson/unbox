# unbox - rekordbox "Now Playing" overlays for Twitch / OBS

Display your current or recent rekordbox 6 tracks to your viewers on Twitch. Inspired by PRACT OBS and ASOT.

**Please back up your library before using this as corruption could occur, we're not responsible for any issues, or corruption that this software may cause to your library.**

## How to use
1. **Download the unbox desktop app.** Here's the mac version: [Mac Download](https://github.com/erikrichardlarson/unbox/releases/download/3.0/mac_unbox.zip) and here's the windows version: [Windows Download](https://github.com/erikrichardlarson/unbox/releases/download/3.0/windows_unbox.zip) Currently there is only support for rekordbox 6. 

2. **Open the zip file you downloaded above, and open the unbox app.** On Windows you'll want to click the unbox.exe file. If Windows or Mac asks you to trust unbox, you'll need to do that. The source code is in this repo if you're concerned about security. When the app is open you'll see this window:

<img src="https://media.discordapp.net/attachments/790269915444805656/790269992322727937/Screen_Shot_2020-12-20_at_9.24.16_AM.png" data-canonical-src="https://media.discordapp.net/attachments/790269915444805656/790269992322727937/Screen_Shot_2020-12-20_at_9.24.16_AM.png" width="500" height="300" />

3. **Just keep unbox open when you're playing.** Now that unbox is open, you have access to three things:  

*  Two browser sources. The browser sources are just web pages that unbox automatically updates when it's open. These are the exact web pages you can add: http://localhost:8080/play_history.html or http://localhost:8080/now_playing.html. Below you can see what these browser sources look like.
 
*  One txt file. You also have access to a "rekordbox_stream.txt" file in your home directory in a folder called unbox_output. You can add this as a text source in OBS, it updates in real time so you can display a plain text view of the current playing track in rekordbox. 

![](https://cdn.discordapp.com/attachments/780172543771410452/783904760880562176/Screen_Shot_2020-12-02_at_7.56.55_PM.png)


![](https://cdn.discordapp.com/attachments/780172543771410452/783841115802959902/unknown.png)

If unbox is useful to you and you'd like to support future development, please feel free to [donate](https://paypal.me/erikrichardlarson?locale.x=en_US). Your support is much appreciated! 
