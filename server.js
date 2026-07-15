// Express API backed by Postgres. Serves the players resource (full CRUD) and
// the static front end (index.html) from the same origin.
//
// Run with:   node server.js
// Requires Postgres running locally with a `sr_prep` database created
// (createdb sr_prep) and `npm install` for dependencies.

const express = require('express');
const { Pool } = require('pg');

// A Pool manages a set of reusable Postgres connections. Defaults connect as
// the OS user over the local socket; we just name the database.
const pool = new Pool({ database: 'sr_prep' });

const PORT = 4000;
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const SEED = [
  ['LeBron James',          'Lakers',    'Forward', 27, 'West'],
  ['Stephen Curry',         'Warriors',  'Guard',   30, 'West'],
  ['Kevin Durant',          'Suns',      'Forward', 29, 'West'],
  ['Nikola Jokic',          'Nuggets',   'Center',  26, 'West'],
  ['Luka Doncic',           'Mavericks', 'Guard',   33, 'West'],
  ['Jayson Tatum',          'Celtics',   'Forward', 24, 'East'],
  ['Joel Embiid',           '76ers',     'Center',  35, 'East'],
  ['Damian Lillard',        'Bucks',     'Guard',   28, 'East'],
  ['Giannis Antetokounmpo', 'Bucks',     'Forward', 31, 'East'],
];

// Create the table if it doesn't exist and seed it once. Awaited before the
// server starts listening (see start() at the bottom).
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE,
      team       TEXT,
      position   TEXT,
      points     INTEGER,
      conference TEXT
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM players');
  if (rows[0].n === 0) {
    for (const p of SEED) {
      await pool.query(
        'INSERT INTO players (name, team, position, points, conference) VALUES ($1, $2, $3, $4, $5)',
        p
      );
    }
    console.log('seeded 9 players into Postgres (sr_prep)');
  }
}

app.get('/health', async (req, res) => {
  const result = await pool.query('SELECT COUNT(*)::int AS total FROM players');
  res.json({ status: 'ok', playerCount: result.rows[0].total });
});

app.get('/players', async (req, res) => {
  const result = await pool.query('SELECT * FROM players');
  res.json(result.rows);
});

app.get('/players/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'no player with that id' });
  }
  res.json(result.rows[0]);
});

// Upsert on name: a repeat POST for an existing player updates it instead of
// erroring or creating a duplicate, which keeps ingestion re-runnable.
app.post('/players', async (req, res) => {
  const { name, team, position, points, conference } = req.body;
  if (!name || !team || !position) {
    return res.status(400).json({ error: 'name, team, and position are required' });
  }
  const result = await pool.query(
    `INSERT INTO players (name, team, position, points, conference)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (name) DO UPDATE
       SET team = EXCLUDED.team, position = EXCLUDED.position,
           points = EXCLUDED.points, conference = EXCLUDED.conference
     RETURNING id`,
    [name, team, position, points, conference]
  );
  res.status(201).json({ id: result.rows[0].id, name, team, position, points, conference });
});

app.put('/players/:id', async (req, res) => {
  const { points } = req.body;
  if (points === undefined) return res.status(400).json({ error: 'points is required' });
  const result = await pool.query(
    'UPDATE players SET points = $1 WHERE id = $2',
    [points, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'no player with that id' });
  res.json({ id: Number(req.params.id), points });
});

app.delete('/players/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'no player with that id' });
  res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({ error: 'route not found' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`listening on http://localhost:${PORT}`));
}
start();
