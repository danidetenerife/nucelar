# YouTube Music Plugin for Nuclear Player

Official-quality streaming and rich music metadata provider for [Nuclear](https://nuclearplayer.com), powered by YouTube Music InnerTube and `yt-dlp`.

---

## Why YouTube Music instead of standard YouTube?

| Feature | Standard YouTube Plugin | YouTube Music Plugin |
| :--- | :--- | :--- |
| **Track Cleanliness** | Returns videos with dialogue, sound effects, intros | **Studio Audio (ATV / Official Topic Tracks)** |
| **Search Accuracy** | Low (mixes reaction videos, 10h loops, covers) | **High (targeted to music releases)** |
| **Metadata Support** | Streaming only | **Full (Artists, Albums, Tracklists, Bios)** |
| **Discography** | None | **Structured album listings with track numbers** |

---

## Features

- **Streaming Provider (`youtube-music`)**:
  - Searches YouTube Music with targeted song filtering.
  - Resolves high-bitrate audio streams directly via Nuclear's integrated `yt-dlp`.
- **Metadata Provider (`youtube-music`)**:
  - Search tracks, albums, and artists.
  - Fetch artist biographies, high-resolution artwork, top tracks, and related artists.
  - Fetch complete album details with track numbering and release years.

---

## Plugin Structure

```
nuclear-plugin-youtube-music/
├── package.json              # Nuclear manifest & plugin metadata
├── README.md                 # Documentation
└── src/
    ├── client.ts             # YouTube Music InnerTube API client
    ├── index.test.ts         # Vitest test suite
    ├── index.ts              # Plugin entry point (exports default NuclearPlugin)
    ├── mappers.ts            # Data converters from YTM to Nuclear models
    ├── metadata-provider.ts  # MetadataProvider implementation
    ├── streaming-provider.ts # StreamingProvider implementation
    └── types.ts              # InnerTube & YTM TypeScript types
```

---

## Development & Testing

Run unit and integration tests:

```bash
npx vitest run plugins/nuclear-plugin-youtube-music/src/index.test.ts
```

Compile the bundle manually:

```bash
npx esbuild src/index.ts --bundle --format=cjs --platform=browser --external:@nuclearplayer/plugin-sdk --outfile=dist/index.js
```

---

## Installation in Nuclear

### 1. Development / Local Testing
Place the `nuclear-plugin-youtube-music` folder directly into Nuclear's user plugins directory:
* **Windows**: `%APPDATA%\nuclear\plugins\nuclear-plugin-youtube-music`
* **macOS**: `~/Library/Application Support/nuclear/plugins/nuclear-plugin-youtube-music`
* **Linux**: `~/.config/nuclear/plugins/nuclear-plugin-youtube-music`

### 2. Publishing to Nuclear Plugin Store
1. Push this repository to GitHub (e.g. `NuclearPlayer/nuclear-plugin-youtube-music` or your username).
2. Create a GitHub Release with tag `v0.1.0` containing `plugin.zip` (with `src`, `package.json`, and `README.md`).
3. Submit a Pull Request to [NuclearPlayer/plugin-registry](https://github.com/NuclearPlayer/plugin-registry) adding your plugin to `plugins.json`.
