# English Buddy

A personal web app (PWA) for practising spoken English with an avatar conversation partner. It runs in Chrome on Android and Windows and can be installed to the home screen.

## What it does

- Voice conversation: the browser recognises speech, Claude replies and corrects mistakes, and the browser reads the reply aloud.
- Settings: level A0–C2, British or American English, female, male or teen voice, speed, correction mode, topic, and a hands-free mode.
- Two profiles (dad and daughter), each with its own settings, mistake history and learned words.
- Words: topic cards with UK/US transcription, translation, audio and a rough pronunciation score.

## Setup

1. Publish the folder on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).
2. Open the site in Chrome, then go to Settings and paste your key from console.anthropic.com.
3. On Android: Chrome menu → "Add to Home screen".

The key is stored only in the browser's localStorage on that device, and requests go straight to api.anthropic.com.

## Files

- `index.html`: markup and styles
- `app.js`: the app logic
- `vendor/anthropic.js`: the official `@anthropic-ai/sdk` 0.133.0, bundled for the browser with esbuild
- `sw.js`: offline caching of the app shell
- `manifest.webmanifest`, `icons/`: installation as an app
