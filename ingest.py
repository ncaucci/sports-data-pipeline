# Ingestion pipeline: pulls player data from a public sports API and writes
# it straight into Postgres (no web server in between). Re-runnable — an
# upsert on the unique `name` column means running this any number of times
# updates existing rows instead of creating duplicates.
#
# Run with:   python3 ingest.py
# Requires Postgres running with the `sr_prep` database (see server.js) and
# `psycopg2-binary` + `requests` installed.

import psycopg2
import requests

DB_NAME = "sr_prep"
SOURCE_API = "https://www.thesportsdb.com/api/v1/json/3/searchplayers.php"

NAMES = [
    "Anthony Davis",
    "Kawhi Leonard",
    "Jimmy Butler",
    "Devin Booker",
]

conn = psycopg2.connect(dbname=DB_NAME)
cur = conn.cursor()

# The source API only provides name/team/position — points and conference
# aren't part of its schema, so they're defaulted here rather than left null.
done = 0
for name in NAMES:
    hits = requests.get(f"{SOURCE_API}?p={name}").json()["player"]
    if not hits:
        print("skip", name)
        continue
    raw = hits[0]
    row = (raw["strPlayer"], raw["strTeam"], raw["strPosition"], 0, raw.get("conference", "Unknown"))
    cur.execute("""
        INSERT INTO players (name, team, position, points, conference)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (name) DO UPDATE
          SET team = EXCLUDED.team, position = EXCLUDED.position,
              points = EXCLUDED.points, conference = EXCLUDED.conference
        RETURNING id
    """, row)
    print("ok", name, "-> id", cur.fetchone()[0])
    done += 1

conn.commit()
cur.close()
conn.close()
print(f"{done} upserted")
