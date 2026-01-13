# Storytel → Goodreads Sync Inspector

Client-side web app that highlights Storytel listens that never made it into Goodreads so you can re-import them quickly. All parsing happens in the browser—uploads never leave your machine.

## Features

- Dual CSV uploads with column mapping helpers for Goodreads and Storytel exports
- Date-range filtering that narrows the Storytel window before comparison
- Smart title/author normalization to reduce formatting mismatches
- Inline format checks, file-name display, and quick links to generate the CSV exports
- Searchable, sortable results table that shows started/finished dates plus a formatted duration chip for each missing listen
- Lightweight Express server for local or containerized hosting

## Getting Started

```bash
npm install
npm start
```

The app runs on http://localhost:4173 by default.

## Docker

```bash
docker build -t storytel-goodreads-sync .
docker run --rm -p 4173:4173 storytel-goodreads-sync
```

Visit http://localhost:4173 once the container is up.

## CSV Tips

1. Export your Goodreads library (desktop site → Profile → "Export Library").
2. Export Storytel history from the History page.
3. After uploading, pick the matching columns: Goodreads needs Title, Author, and Finished Date, while Storytel supports Title, optional Author, Started Date, Duration (seconds), and Finished Date. The app will auto-guess common header names.
