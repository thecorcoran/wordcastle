# Contributing & Adding a Subject Pack

Word Castle is structured as a monorepo with a subject-agnostic learning engine (`packages/core`) and individual subject apps (`apps/*`).

## Architecture

- `packages/core`: Pure spaced-retrieval scheduler, session queue builder, adaptive placement, unlock policy, local/IndexedDB storage, zip backup/voice-pack import-export, audio player/recorder/TTS, UI kit, and theme interface.
- `apps/spelling`: The Word Castle spelling app (Fry 1000 Instant Words pack, dictation/teach/correction exercises, SVG castle theme, recording studio, parent area).
- `apps/_example-math`: A minimal 20-line stub demonstrating how a second subject (e.g., multiplication facts with a garden theme) plugs into `@word-castle/core` without modifying the engine.

## How to Add a New Subject Pack

1. **Create an app directory** under `apps/<your-subject>/`.
2. **Define your `Item[]`**: Each item has a stable `id`, `groupId`, `superGroupId`, global `order`, and subject-specific `meta`.
3. **Implement `Exercise`**:
   - `present(item, ctx)` -> `Promise<TrialResult>`
   - `teach(item, ctx)` -> `Promise<void>`
   - `correct(item, trial, ctx)` -> `Promise<void>`
4. **Create a `LearningPack`**: Specify `unlockPolicy`, `speedPolicy` (`{ kind: 'none' }` or `{ kind: 'threshold', baseMs, perUnitMs }`), `newPerSessionDefault`, `sessionMinutesDefault`, `exercise`, and `placementSampler`.
5. **Implement a `Theme`**: Render `renderHomePreview`, `renderProgress`, and `onItemAdvance` from the engine's `ProgressView` data object. Themes only draw—they never compute scheduling.
6. **Wire up the app shell**: Initialize `StateStore`, `AudioStore`, `AudioPlayer`, and pass your `LearningPack` + `Theme` to the UI screens.

## Development Commands

```bash
npm install
npm run test          # Run Vitest unit tests
npm run lint          # Run ESLint
npm run build         # Build core and spelling app
npm run validate:pack # Validate the Fry 1000 word pack
```
