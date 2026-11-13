# Word Castle

A child-friendly, offline-first spelling app built on a reusable spaced-retrieval learning engine (`@word-castle/core`).

- **Fry 1000 Instant Words** taught in frequency order, grouped into 40 rooms of 25 words across 10 castle wings.
- **Parent's Voice First:** Record words, sentences, and slow pronunciations in your own voice, with automatic fallback to device text-to-speech.
- **Castle Theme:** Every word is a stone that grows from Plan → Quarried → Chiseled → Laid → Mortared → Polished → Crowned. Nothing ever crumbles or breaks.
- **100% On-Device:** No accounts, no tracking, no network calls after install. See [PRIVACY.md](./PRIVACY.md).

## Installing on Your Device (PWA)

### Desktop (Chrome / Edge)
1. Open the hosted URL (or local preview).
2. Click the **Install app** icon in the address bar (or open `⋮` → **Cast, save, and share** → **Install Word Castle**).
3. Pin the installed app to your desktop or taskbar.

### iPad / iPhone (Safari)
1. Open the URL in Safari.
2. Tap the **Share** button → **Add to Home Screen**.

Once installed, the app works completely offline.

## Development

```bash
npm install
npm run dev           # Start Word Castle dev server
npm run test          # Run all unit tests
npm run lint          # Lint TypeScript sources
npm run build         # Production build
npm run validate:pack # Validate Fry 1000 word pack
```

## Manual Test Script

1. **Fresh Install & Onboarding:** Open the app in a clean browser profile. Enter a child's name, review the voice explainer, complete or skip the placement check, and verify the Home screen appears with the castle preview.
2. **First Session & Resume Mid-Session:** Start "Build the castle", complete 2–3 words, then close the browser tab. Reopen the app and verify it resumes at the exact trial in the queue.
3. **Dictation & Correction:** In a dictation trial, test "Hear it again", "Hear the sentence again", and "Say it slowly". Submit a misspelled word and verify the calm blue Look-Say-Cover-Write-Check flow runs and the word is re-asked later in the session.
4. **Recording Studio & Playback:** Open Parent Area (gear icon, solve the arithmetic gate), open Recording Studio, allow microphone access, record a word, play it back, and keep it. Start a session and verify your recorded voice plays instead of TTS.
5. **Export / Import Round-Trip:** In Parent Area → Settings, click **Export everything** to download a `.zip`. Reset progress, then **Import** the `.zip` and verify both progress and voice recordings are restored.
6. **Offline Test:** After loading the app once, open DevTools → Network → Offline (or turn off Wi-Fi) and reload. Verify the app loads and plays a full session.
