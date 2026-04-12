# VoiceToVoice Overview

## Scope

This repository now keeps only the Ver2Page frontend and the realtime backend it needs.

Removed from the public-safe path:

- the legacy root D-ID page
- the batch pipeline and job artifacts
- Vertex optimization code
- hardcoded D-ID talk API keys

## Runtime Config

The repo uses a single root `.env` file locally. Copy [`.env.example`](../.env.example) to `.env` and fill in your own values.

Backend config is loaded from the root `.env` by [backend/src/bootstrap/loadEnvFile.js](../backend/src/bootstrap/loadEnvFile.js).
The frontend does not require `frontend/.env`; [frontend/src/Ver2Page.jsx](../frontend/src/Ver2Page.jsx) already falls back to the backend URL automatically.

### Environment Groups

- Runtime: `PORT`, `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS`, `PUBLIC_BASE_URL`
- Google auth: `GOOGLE_APPLICATION_CREDENTIALS`
- Google STT: `GOOGLE_STT_LANGUAGE_CODE`, `GOOGLE_STT_ALTERNATIVE_LANGUAGE_CODES`, `GOOGLE_STT_SAMPLE_RATE`, `GOOGLE_STT_MODEL`
- Google TTS: `GOOGLE_TTS_LANGUAGE_CODE`, `GOOGLE_TTS_VOICE_NAME`, `GOOGLE_TTS_AUDIO_ENCODING`
- DeepL: `DEEPL_AUTH_KEY`, `DEEPL_SOURCE_LANGUAGE`, `DEEPL_TARGET_LANGUAGE`
- D-ID embed: `D_ID_AGENT_ID`, `D_ID_CLIENT_KEY`
- TTS cleanup: `TTS_AUDIO_TTL_MS`, `TTS_CLEANUP_INTERVAL_MS`

## Backend Entry Points

- [backend/src/server.js](../backend/src/server.js)
- [backend/src/app.js](../backend/src/app.js)
- [backend/src/config/env.js](../backend/src/config/env.js)
- [backend/src/bootstrap/loadEnvFile.js](../backend/src/bootstrap/loadEnvFile.js)
- [backend/src/routes/realtime.js](../backend/src/routes/realtime.js)
- [backend/src/services/googleStt.js](../backend/src/services/googleStt.js)
- [backend/src/services/googleTts.js](../backend/src/services/googleTts.js)
- [backend/src/services/deeplTranslate.js](../backend/src/services/deeplTranslate.js)
- [backend/src/utils/ensureDir.js](../backend/src/utils/ensureDir.js)
- [backend/src/utils/fileCleanup.js](../backend/src/utils/fileCleanup.js)

## API Surface

- `GET /api/health` - health summary and missing config hints
- `GET /api/embed-config` - returns the D-ID `agentId` and `clientKey` used by Ver2Page
- `POST /api/realtime/translate` - DeepL translation
- `POST /api/realtime/transcribe` - audio upload to Google STT
- `POST /api/realtime/synthesize` - text to Google TTS audio URL

## Data Flow

1. Ver2Page loads the backend embed config.
2. The frontend creates the D-ID agent manager with the returned `agentId` and `clientKey`.
3. The user can speak, upload audio, or type text.
4. The backend translates via DeepL and optionally synthesizes TTS audio through Google.
5. Generated audio files are written under `backend/uploads/tts` and cleaned up automatically.

## Local Development

- Frontend: `npm run dev` from `frontend/`
- Backend: `npm run dev` from `backend/`
- Health check: `curl http://localhost:8081/api/health`

## Notes

- Keep Google credentials outside the repo or use ADC.
- Do not commit `.env` files, credential JSON, or generated uploads.
