# AppiStream 🎵🎬
**Full-featured Offline/Online Audio & Video Media Player PWA**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![PWA](https://img.shields.io/badge/PWA-ready-green)
![Offline](https://img.shields.io/badge/offline-ready-brightgreen)

---

## ✨ Features

### Playback
- 🎵 Audio: MP3, WAV, FLAC, AAC, M4A, OGG, OPUS, WMA, AIFF
- 🎬 Video: MP4, WebM, MOV, MKV, AVI, M4V, 3GP
- Play from local device files — no upload needed
- Background audio playback (Media Session API)
- Lock screen / notification controls
- 10-band Equalizer with 10 presets (Bass, Rock, Pop, Jazz, etc.)
- Playback speed: 0.5× – 2×
- Seek forward/backward 10 seconds
- Repeat (none / one / all) + Shuffle
- Sleep timer (5m – 60m)
- Volume control with mute

### Organization
- 📚 Library — browse, filter, sort all loaded tracks
- 📋 Playlists — create & manage unlimited playlists
- ♥ Favorites — heart tracks for quick access
- 🕐 History — grouped play history (last 200 plays)
- Queue management — reorder, remove, clear

### App
- 📱 Installable PWA — works like a native app
- ✈️ Fully offline after first load
- IndexedDB persistence (playlists, favorites, history, EQ, settings)
- Drag & drop file loading
- Mini player bar on all pages
- Dark Navy + Electric Blue neon design

---

## 🚀 Quick Start (Local Dev)

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## 📦 Production Build

```bash
npm run build
# Output in /dist — ready to deploy
```

---

## 🌐 Deploying (Online + Offline)

### Option 1: Netlify (Recommended — free)
1. Go to [netlify.com](https://netlify.com) → New site → Drag & drop the `/dist` folder
2. Done! Your app is live with HTTPS (required for PWA install)

### Option 2: Vercel
```bash
npm i -g vercel
vercel --prod
# Select the dist folder when prompted
```

### Option 3: GitHub Pages
```bash
npm run build
# Push /dist contents to a gh-pages branch
# Enable GitHub Pages in repo settings
```

### Option 4: Self-hosted (Nginx)
```nginx
server {
    listen 80;
    root /var/www/appistream;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|png|ico|json)$ { expires 1y; add_header Cache-Control "public, immutable"; }
}
```

---

## 📱 Installing as PWA (Android — No App Store needed)

### Method 1: Chrome Browser (Easiest)
1. Open your deployed URL in Chrome on Android
2. Tap the **⋮ menu** → **"Add to Home screen"** (or banner appears automatically)
3. Tap **Install** → AppiStream icon appears on home screen
4. Opens fullscreen like a native app ✅

### Method 2: Samsung Internet
1. Open URL → Tap **⊕ icon** in address bar → "Add page to" → "Home screen"

### Method 3: Firefox Android
1. Open URL → Tap **⋮** → "Install" or "Add to Home screen"

---

## 📦 Building a Real APK (Android App)

### Using Bubblewrap (Google's Official PWA→APK tool)

```bash
# Prerequisites: Node.js 14+, Java JDK 8+, Android SDK

npm install -g @bubblewrap/cli

# Initialize (run in appistream folder)
bubblewrap init --manifest https://YOUR_DEPLOYED_URL/manifest.webmanifest

# Build APK
bubblewrap build

# Output: app-release-signed.apk
# Sideload on Android: Settings → Install unknown apps → enable
# Or submit to Google Play Store
```

### Using PWABuilder (No-code, free)
1. Deploy app to Netlify/Vercel/etc.
2. Go to **[pwabuilder.com](https://pwabuilder.com)**
3. Enter your deployed URL → Click **Start**
4. Click **Package for stores** → **Android** → Download APK
5. Install APK on device (enable "Unknown sources" in Settings)

### Using Capacitor (Full native wrapper)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init AppiStream com.appistream.app
npm run build
npx cap add android
npx cap copy android
npx cap open android   # Opens Android Studio → Build APK
```

---

## 🍎 iOS Installation (PWA)

1. Open deployed URL in **Safari** (must be Safari on iOS)
2. Tap **Share button** (box with arrow) → **"Add to Home Screen"**
3. Tap **Add** → App icon appears on home screen

> Note: iOS PWAs have some limitations (no background audio in older iOS). iOS 16.4+ supports Web Push. For full native iOS app, use Capacitor above.

---

## 🏗 Project Structure

```
appistream/
├── public/               # Static assets (icons, manifest, sw)
├── src/
│   ├── context/
│   │   └── PlayerContext.jsx   # Global player state + Web Audio API
│   ├── pages/
│   │   ├── NowPlaying.jsx      # Main player screen
│   │   ├── Library.jsx         # Track browser
│   │   ├── Playlists.jsx       # Playlist manager
│   │   ├── PlaylistDetail.jsx  # Single playlist view
│   │   ├── Favorites.jsx       # Favorited tracks
│   │   ├── History.jsx         # Play history
│   │   ├── Settings.jsx        # App settings
│   │   └── Equalizer.jsx       # 10-band EQ
│   ├── components/
│   │   ├── PlayerBar.jsx       # Mini player (non-player pages)
│   │   ├── VideoOverlay.jsx    # Video player with controls
│   │   ├── TrackRow.jsx        # Reusable track list item
│   │   └── Notification.jsx    # Toast notifications
│   ├── utils/
│   │   ├── db.js               # IndexedDB (idb) helpers
│   │   └── helpers.js          # Format, EQ presets, file utils
│   ├── App.jsx                 # Router + shell layout
│   ├── main.jsx                # React entry
│   └── index.css               # Global CSS + design tokens
├── vite.config.js              # Vite + PWA plugin config
├── index.html                  # HTML shell
└── package.json
```

---

## 🔧 Customization

### Colors (src/index.css :root)
```css
--navy: #0F172A;
--blue: #2563EB;
--sky:  #38BDF8;
```

### EQ Presets (src/utils/helpers.js)
Add your own in `EQ_PRESETS` object — 10 band values from -12 to +12 dB.

### Supported Formats
Edit `isAudioFile` / `isVideoFile` in `helpers.js` to add more extensions.

---

## 📄 License
MIT — free to use, modify, and distribute.
