<div align="center">

# **unbox**

### Display your Rekordbox, Serato, Traktor, VirtualDJ, Mixxx, DJUCED, and djay Pro tracks to your viewers on Twitch

</div>
<p align="center">
  <img  src="preview.gif" width="50%" height="50%" />
  <img  src="transition.gif" width="50%" height="50%" />
</p>

## **Our Supporters**

<p align="center">
  <a href="https://www.twitch.tv/djaramistv"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/93f54a41-ec11-459a-885f-bb5ce4550aa9-profile_image-300x300.png" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/reorderdj"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/7716d257-49e5-41ec-8404-2a4883507b2a-profile_image-70x70.png" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/hybrid_blak/"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/5596fc47-d7aa-4082-ae88-b4cc07ceb032-profile_image-300x300.png" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/djrexy"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/djrexy-profile_image-de773f4e44dcdeca-70x70.jpeg" width="80" height="80" /></a>
  <a href="https://www.twitch.tv/eddieselnyc"> <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/4a8de8cf-13c7-4c41-880f-25bac2620470-profile_image-70x70.png" width="80" height="80" /></a>
</p>

## **Setup**

Unbox is designed to be simple to use while providing the most accurate track metadata software. Download the app, unzip, launch, pick your mode, and copy the URLs into OBS. If you encounter any issues, please create an issue here, and we'll respond ASAP.

1. **Download and install the Unbox desktop app**. Here's the [Mac version](https://github.com/erikrichardlarson/unbox/releases/download/11.3/unbox-mac.zip) and the [Windows version](https://github.com/erikrichardlarson/unbox/releases/download/11.3/unbox-win.zip).

2. **Launch the app and select Your DJ Mode**. Simply select the mode that corresponds to your DJ software.

3. **For VirtualDJ or Traktor users, we have plugins that allow Unbox to follow the master channel**.

- For Traktor, download this [D2 file](https://github.com/erikrichardlarson/unbox/releases/download/11/D2.zip), extract it, and place it in your CSI folder located at `C:\Program Files\Native Instruments\Traktor Pro 3\Resources64\qml\CSI` on Windows or `/Applications/Native Instruments/Traktor Pro 3/Traktor.app/Contents/Resources/qml/CSI` on Mac. Then, open Traktor and select D2 as your controller: `Traktor > Settings > Controller Manager > Select D2 from dropdown`.

- For VirtualDJ, download our [Windows plugin](https://github.com/erikrichardlarson/unbox/releases/download/11/UnboxPlugin.zip) or [Mac plugin](https://github.com/erikrichardlarson/unbox/releases/download/11/UnboxPlugin.bundle.zip), extract it, and place it in your `SoundEffect Plugins` folder. This is located at `C:\Users\YOUR_USERNAME\Documents\VirtualDJ\Plugins64\SoundEffect` on Windows or `/Users/<USER>/Library/Application Support/VirtualDJ/PluginsMacArm` on Mac. This plugin will be available in the `Sound Effects` dropdown in VirtualDJ as "WindowsUnboxPlugin" or "MacUnboxPlugin". Select the plugin in the dropdown:

<p align="center">
  <img src="virtualdj_plugin_dropdown.png" width="50%" height="50%" />
</p>

## **Usage**

- **Available Overlays**: Unbox offers two overlays: a track overlay at `http://localhost:8001/unbox_overlay.html` and an album overlay at `http://localhost:8001/album_art.html`. The track overlay displays the Artist, Title, Remixer, and Label. The album art overlay shows the album art, if available, or if found through Unbox Plus.

- **Unbox Plus**: Unbox Plus supplements your existing track metadata with corrected metadata or missing metadata via our metadata API. It also provides up to 500 recommended tracks based on your tracklist history.

## **Contact Information**

If you encounter any issues, you can post them here, or you can reach me at erikrichardlarson@gmail.com.
