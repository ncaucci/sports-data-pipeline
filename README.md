# Sports Data Pipeline

This project ingests real sports data, stores it, serves it, and displays it.

## Architecture

```
Python (ingest) -> Postgres (store) -> Express (serve) -> React (display)
```

A player's name starts out as a field called `strPlayer` in a public sports API's raw JSON response. A Python script pulls that JSON over HTTP, renames and fills in the fields the source doesn't provide, and writes it into Postgres with an upsert — so re-running the script never creates duplicates. An Express server sits in front of that database and exposes it as a REST API. A React page fetches from that API on load and renders every player as a row, letting a user filter the list live by typing into a search box.

## What it does

- REST API with full CRUD on `/players` — `GET`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id` — plus a `/health` check
- ETL pipeline (`ingest.py`) against a real third-party sports API, reshaping its raw fields into this project's schema
- Re-runnable ingestion using `INSERT ... ON CONFLICT (name) DO UPDATE` — running the pipeline twice updates existing rows instead of duplicating them
- React front end (`index.html`) with `useEffect`-driven data fetching and a live, state-filtered search box

## Tech stack

- **Node** 22, **Express** 5 — API server
- **Postgres** — datastore, via the `pg` driver
- **Python 3** with `requests` and `psycopg2-binary` — direct-to-Postgres ingestion
- **React** (via CDN + Babel, no build step) — front end

## Running it locally

1. Install dependencies:
   ```
   npm install
   python3 -m pip install psycopg2-binary requests
   ```
2. Make sure Postgres is running and the database exists (one-time):
   ```
   brew services start postgresql@14
   createdb sr_prep
   ```
3. Start the server:
   ```
   node server.js
   ```
   Open `http://localhost:4000/index.html` in a browser (opening the HTML file directly will fail — the page and the API must share an origin, or the fetch is blocked by CORS).
4. Run the ingestion pipeline in a separate terminal, with the server already running:
   ```
   python3 ingest.py
   ```
   It's safe to run more than once — the upsert means repeat runs update existing rows rather than duplicating them.

## Testing

End-to-end tests (`tests/app.spec.js`) run with Playwright against a live instance of the app: the front end loads and renders players from the API, the search box filters the visible list, and `/health` reports OK. Run them locally with:
```
npx playwright install --with-deps chromium
npm test
```

## Data quality notes

The source API is incomplete: it provides a player's name, team, and position, but no points total and no conference. The ingestion pipeline fills those two gaps with defaults (`0` for points, `"Unknown"` for conference) rather than rejecting the row — you can see both defaults show up in the UI for any player the source didn't have full stats for. The pipeline is safe to re-run any number of times because every insert is keyed on the player's unique name and upserts on conflict, rather than blindly inserting. Normalizing messy, incomplete source data like this isn't a flaw in the project — it's the actual day-to-day job in sports-data engineering, where no third-party feed is ever as clean as the schema you want to query.

## Project history

Built in a 13-day, one-layer-per-day sprint: starting with core JavaScript fundamentals, then SQL, then a REST API built from a raw HTTP server up to full CRUD, then a real ingestion pipeline with storage moved to Postgres, and finally a live React front end on top of it all. The day-by-day build log lives in a separate repo; this one holds the finished pipeline.

## What's next

- A CI pipeline to run the Playwright suite on every push
- A real React build setup (Vite or similar) instead of the current CDN + Babel setup
