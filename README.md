# Content Intelligence Hub

Content Intelligence Hub is a full-stack web application for turning web pages and uploaded documents into readable summaries and streamable audio.

The project combines:
- URL scraping with Cheerio
- PDF, DOCX, and TXT upload parsing on the frontend
- Gemini-based summarization
- chunked text-to-speech generation with WebSocket streaming
- JWT authentication
- MongoDB Atlas persistence
- Cloudinary audio storage

## Highlights

- Multi-page frontend built with HTML, CSS, and vanilla JavaScript
- Premium light/dark UI with theme-aware imagery
- React-based dashboard view via CDN plus a standalone `react-app/`
- MVC backend with Express controllers, routes, models, and middleware
- 150-word TTS chunking with retries and concurrency control
- Live-style audio player with progressive duration growth and chunk-aware playback UI
- Session handoff between pages using `sessionStorage`

## Tech Stack

### Frontend
- HTML
- CSS
- Vanilla JavaScript
- PDF.js
- Mammoth.js
- Lucide icons
- React via CDN for dashboard widgets

### Backend
- Node.js
- Express
- MongoDB Atlas with Mongoose
- JWT authentication
- Cheerio
- `@google/generative-ai`
- `edge-tts-universal`
- WebSocket server via `ws`
- Cloudinary

## Project Structure

```text
content-intelligence-hub/
|- backend/
|  |- controllers/
|  |- middleware/
|  |- models/
|  |- routes/
|  |- utils/
|  |- .env
|  `- server.js
|- frontend/
|  |- css/
|  |- html/
|  |- images/
|  `- js/
|- react-app/
|- .env.example
|- package.json
`- README.md
```

## Frontend Pages

Main HTML pages under `frontend/html`:

- `index.html`
- `about.html`
- `features.html`
- `scraper.html`
- `summary.html`
- `audio.html`
- `dashboard.html`
- `saved.html`
- `register.html`
- `login.html`
- `contact.html`

## Backend Architecture

The backend follows an MVC structure:

- `routes/` defines API endpoints
- `controllers/` contains request handlers
- `models/` defines MongoDB schemas
- `middleware/` handles auth and errors
- `utils/` contains scraping, summarization, chunking, audio, and cloud helpers

### Core Models

`Content`
- user ownership
- source type (`url` or `file`)
- title / file name / source URL
- raw text
- summary
- word count
- audio URL
- audio mode
- job state

`User`
- name
- email
- hashed password
- role

## Environment Variables

Create `backend/.env` and fill in your real values.

Example:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/cih
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
JWT_SECRET=your_jwt_secret_min_32_chars
PORT=3000
```

Notes:
- The server loads `backend/.env` first.
- A root `.env` is also supported if present.
- Gemini model fallback is implemented in `backend/utils/summarizerUtil.js`.

## Installation

From the project root:

```bash
npm install
```

## Running the Project

Development:

```bash
npm run dev
```

Production-style local run:

```bash
npm start
```

Default server URL:

```text
http://localhost:3000
```

Main entry points:

- App: `http://localhost:3000/html/index.html`
- React dashboard: `http://localhost:3000/react-app/index.html`
- Health check: `http://localhost:3000/health`

## User Flow

1. Register or log in
2. Open the scraper page
3. Scrape a URL or upload a PDF, DOCX, or TXT file
4. Save extracted content into MongoDB
5. Generate a summary with Gemini
6. Choose full-text or summary audio
7. Stream chunked TTS in the audio player
8. Save finished audio to Cloudinary
9. Reopen jobs from Saved Content or Dashboard

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Scraping

- `POST /api/scrape`

### Content

- `POST /api/content/save`
- `GET /api/content`
- `GET /api/content/stats`
- `GET /api/content/:contentId`
- `GET /api/content/summarize/:contentId`
- `DELETE /api/content/:contentId`

### Audio

- `POST /api/audio/:contentId/save`

### Contact

- `POST /api/contact`

## WebSocket Audio Streaming

The app opens a WebSocket connection to the same server host for live TTS generation.

Supported messages:

- Client -> server:
  - `ping`
  - `generate`

- Server -> client:
  - `pong`
  - `start`
  - `chunk`
  - `chunk-error`
  - `done`
  - `error`

Expected generate payload:

```json
{
  "type": "generate",
  "contentId": "CONTENT_ID",
  "mode": "full",
  "voice": "en-US-AriaNeural",
  "sessionId": "unique-session-id"
}
```

## Scraping and File Parsing

### URL scraping

Implemented in `backend/utils/scraperUtil.js`.

Behavior:
- fetches a public page
- removes non-content tags like `script`, `style`, `nav`, and `footer`
- extracts readable text from `article`, `main`, `.content`, `.post-content`, or `body`

### File upload parsing

Implemented on the frontend:

- PDF parsing with PDF.js
- DOCX parsing with Mammoth.js
- TXT parsing with native file text reading

Parsed text is then sent to `POST /api/content/save`.

## Summarization

Implemented in `backend/utils/summarizerUtil.js`.

Behavior:
- uses Gemini through `@google/generative-ai`
- tries `GEMINI_MODEL` first if configured
- falls back to:
  - `gemini-2.5-flash`
  - `gemini-2.0-flash`

Frontend behavior:
- summary errors are surfaced in a popup on the summary page
- quota/rate-limit errors are shown clearly to the user

## Text-to-Speech

Implemented in:

- `backend/utils/chunkUtil.js`
- `backend/utils/audioUtil.js`
- `backend/controllers/audioController.js`

Current behavior:
- splits text into 150-word chunks
- retries failed chunks with exponential backoff
- processes chunks with concurrency
- streams base64 audio chunks over WebSocket
- allows saving final merged audio to Cloudinary

Important rule:
- `summary` mode only works when a real summary exists
- it no longer silently falls back to full text

## Frontend UX Notes

- Theme toggle with persistent light/dark mode
- Theme-aware hero/about imagery
- Custom CIH logo in navbar and tab icon
- Feature visuals on the home page
- Audio page supports:
  - voice selection
  - full vs summary mode
  - live chunk label
  - per-chunk timer
  - buffered total duration growth

## Known Notes

- Gemini free-tier quota can cause `429 Too Many Requests` errors during summarization.
- MongoDB Atlas must allow your IP or startup will fail.
- Cloudinary credentials are required to save generated audio.
- Browser hard refresh (`Ctrl + F5`) may be useful after major frontend asset changes.

## Troubleshooting

### MongoDB connection error

Check:
- `MONGODB_URI` format
- Atlas cluster is active
- network access / IP whitelist

### Gemini 404 model error

Set:

```env
GEMINI_MODEL=gemini-2.5-flash
```

### Gemini quota error

This means your current Gemini tier is rate-limited or out of free quota.

### Audio not starting immediately

The player waits for the first generated chunk before advancing the live timer.

## License / Usage

This repository appears to be a project build/demo workspace. Add your preferred license if you plan to publish it publicly.
