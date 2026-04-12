# Voice Agent Vn-Ja

Voice Agent Vn-Ja is a realtime speech translation demo for Vietnamese and Japanese. It combines Google Speech-to-Text, DeepL, Google Text-to-Speech, and D-ID to turn spoken or typed input into an interactive avatar experience.

## Demo Video

<!--
Paste your demo video embed here.
Example options:
- <video controls src="https://..." width="100%"></video>
- [![Watch the demo](thumbnail-url)](video-url)
-->

## Overview

The app currently supports two main flows:

- Vietnamese to Japanese text translation.
- Japanese to Vietnamese translation with audio generation for D-ID.

The frontend is a React + Vite app, while the backend is an Express API that handles translation, speech recognition, speech synthesis, and public audio URL generation.

## Features

- Realtime speech-to-speech workflow.
- Vietnamese and Japanese direction switching.
- Google STT for audio transcription.
- DeepL translation for VI and JA.
- Google TTS for generated Vietnamese audio.
- D-ID agent integration for avatar playback.
- Public audio URL support via Cloudflare Tunnel or any HTTPS endpoint.

## Requirements

- Node.js 20 or newer.
- npm.
- A Google Cloud service account JSON key with Speech-to-Text and Text-to-Speech access.
- A DeepL API key.
- A D-ID agent ID and client key.
- Optional: `cloudflared` for exposing the local backend to D-ID.

## Configuration

Copy [`.env.example`](.env.example) to [`.env`](.env) and fill in your own values.

Important notes:

- `GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json` is resolved from the folder where the backend process starts.
- If you run `npm run dev` inside `backend/`, place the JSON file at `backend/google-credentials.json`.
- `PUBLIC_BASE_URL` must be a public HTTPS URL when you use the Japanese to Vietnamese flow, because D-ID needs to fetch the generated audio file from outside your machine.
- The frontend does not need a separate `.env`; it falls back to the backend URL automatically.

### Main Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port, default `8081` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the Google service account JSON |
| `PUBLIC_BASE_URL` | Public HTTPS base URL for generated audio files |
| `DEEPL_AUTH_KEY` | DeepL authentication key |
| `DEEPL_SOURCE_LANGUAGE` | Source language code used by DeepL |
| `DEEPL_TARGET_LANGUAGE` | Target language code used by DeepL |
| `D_ID_AGENT_ID` | D-ID agent ID |
| `D_ID_CLIENT_KEY` | D-ID client key |

## Local Setup

### 1. Install dependencies

```powershell
Set-Location .\backend
npm install

Set-Location ..\frontend
npm install
```

### 2. Start the backend

```powershell
Set-Location .\backend
npm run dev
```

The backend will start on `http://127.0.0.1:8081` by default.

### 3. Start the frontend

```powershell
Set-Location .\frontend
npm run dev
```

Open the app at `http://127.0.0.1:5174/ver2`.

## Cloudflare Tunnel for Public Audio

Use this when you want the Japanese to Vietnamese flow to work correctly with D-ID:

```powershell
cloudflared tunnel --url http://127.0.0.1:8081
```

After the tunnel starts, copy the generated `https://...trycloudflare.com` URL into `PUBLIC_BASE_URL` in [`.env`](.env), then restart the backend.

Do not use `localhost` for `PUBLIC_BASE_URL`. D-ID needs a public HTTPS URL that it can fetch directly.

## Docker Compose

The repository includes a Docker Compose setup for local containerized runs.

Before you start:

- Make sure [`.env`](.env) exists in the repository root.
- Make sure [`backend/google-credentials.json`](backend/google-credentials.json) exists and points to a valid Google service account key.
- If you use the Japanese to Vietnamese flow, `PUBLIC_BASE_URL` must point to a public HTTPS URL, such as a Cloudflare Tunnel URL.

```powershell
docker compose up -d --build
```

What this starts:

- Backend container mapped to host `8443`.
- Frontend container mapped to host `80`.

Useful checks:

```powershell
docker compose ps
curl http://127.0.0.1:8443/api/health
curl http://127.0.0.1/api/health
```

Open the app at:

- `http://localhost/ver2`

Useful commands:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

Important Docker notes:

- Docker Compose injects `env_file` values when the container is created.
- The backend still needs the Google credentials JSON mounted into the container at `/app/google-credentials.json`.
- The frontend container also needs `VITE_API_BASE_URL=http://127.0.0.1:8443` so the browser calls the backend on the published Docker port instead of falling back to `127.0.0.1:8081`.
- If you click Run on an image directly in Docker Desktop, `env_file` is not applied automatically. In that case you must add the environment variables, the frontend API URL, and the credentials mount by hand.

If you use Cloudflare Tunnel with Docker, point it to the published backend port on the host:

```powershell
cloudflared tunnel --url http://127.0.0.1:8443
```

If you use Docker locally, keep the Google credentials outside the image and mount them at runtime, or use Application Default Credentials on the host or VM.

## API Endpoints

- `GET /api/health` - health summary and missing config hints.
- `GET /api/embed-config` - returns the D-ID agent config used by the frontend.
- `POST /api/realtime/translate` - DeepL translation.
- `POST /api/realtime/transcribe` - audio upload to Google STT.
- `POST /api/realtime/synthesize` - text to Google TTS audio URL.

## Project Structure

- `backend/` - Express API, translation, STT, TTS, and file handling.
- `frontend/` - React + Vite client UI.
- `docs/` - deployment and project notes.

## Troubleshooting

- If D-ID returns a validation error for `audio_url`, check that `PUBLIC_BASE_URL` is a reachable HTTPS URL and not `localhost`.
- If Google STT or TTS fails, verify the service account JSON path and make sure the corresponding Google Cloud APIs are enabled.
- If the frontend cannot reach the backend, confirm the backend is running on `127.0.0.1:8081` and that CORS is allowed by the current `.env` settings.

## Notes

- Do not commit `.env` files, credential JSON files, or generated uploads.
- The recommended local flow is `backend/` for the API and `frontend/` for the UI, with `cloudflared` only when public audio access is required.