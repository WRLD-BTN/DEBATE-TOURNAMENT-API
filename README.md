# Debate Tournament Management API

A REST API for running British Parliamentary (BP) format debate tournaments —
team registration, round draws, adjudicator ballots, and computed standings
and break (elimination-round qualification).

Built out of running BUSE Debating Union tournaments by hand; this replaces
the parts of that process (score tabulation, break calculation, roster
management) that are error-prone to do in a spreadsheet under time pressure.

## Stack

- **Node.js / Express** — HTTP layer
- **PostgreSQL / Prisma** — data model and migrations
- **JWT + bcrypt** — auth, role-based access (`ADMIN`, `ADJUDICATOR`, `DEBATER`)
- **Zod** — request validation
- **Jest + Supertest** — unit and integration tests
- **Swagger (OpenAPI)** — auto-generated interactive API docs at `/docs`
- **GitHub Actions** — CI running lint + full test suite against a real Postgres instance

## Domain model

```
Tournament ─┬─ Team ─── Debater
            └─ Round ─┬─ Motion
                       ├─ RoundTeam (team + BP position + rank/points, one per team per round)
                       └─ RoundAdjudicator (adjudicator assigned to a round)
```

BP rounds seat 4 teams per room in fixed positions — Opening Government,
Opening Opposition, Closing Government, Closing Opposition. Each round
ranks the 4 teams 1st–4th, which maps to 3/2/1/0 team points. Tournament
standings are the sum of team points (speaker points as tiebreaker) across
all rounds, and the "break" is the top N teams that advance to
elimination rounds.

## Features

- **Auth & roles** — JWT-based, with `ADMIN`/`ADJUDICATOR`/`DEBATER` roles enforced per-route
- **Tournament/team/round/ballot CRUD** — see `/docs` for the full route list
- **Computed standings & break** — pure-function scoring logic (`src/services/scoring.service.js`), fully unit tested
- **Swiss-style pairing proposals** (`GET /api/tournaments/:id/pairings/next-round`) — given current standings, proposes the next round's 4-team room draw, swapping teams to avoid rematches where possible. Read-only: it proposes, an admin still creates the actual round via `POST .../rounds`.
- **CSV/PDF export** of standings (`GET .../standings/export.csv` and `.../export.pdf`) — for handing results to a tournament director or debaters directly

## Testing the API without writing code

A Postman collection is included: `postman_collection.json`. Import it into
Postman, set the `baseUrl` variable to your local or deployed URL, and run
requests top-to-bottom — "Register Admin" and "Create Tournament" etc.
automatically save IDs into collection variables for later requests to use.

## Getting started

```bash
git clone <this-repo>
cd debate-tournament-api
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev      # creates tables
npm run prisma:seed         # optional: loads a demo tournament
npm run dev
```

API runs at `http://localhost:4000`, interactive docs at `http://localhost:4000/docs`.

## Running tests

```bash
npm test
```

The pure-logic unit tests (`scoring.service.test.js`, `pairing.service.test.js`,
`export.service.test.js`) run anywhere, no database required — that logic is
deliberately kept as plain functions with no Express/Prisma dependency.
The integration tests (`auth.test.js`, `tournamentFlow.integration.test.js`)
additionally require a reachable `DATABASE_URL`; they're automatically
skipped if one isn't set, so `npm test` never fails in an environment
without Postgres. CI provisions a real Postgres service container so the
full suite — including the full tournament→team→round→ballot→standings
flow — runs on every push.

## Example flow

```bash
# Register an admin
curl -X POST localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"[email protected]","password":"AdminPass123","name":"Admin","role":"ADMIN"}'

# Create a tournament (use the returned token)
curl -X POST localhost:4000/api/tournaments \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"BUSE Easters 2026","startDate":"2026-04-10T00:00:00Z","endDate":"2026-04-12T00:00:00Z","breakSize":4}'

# Check computed standings
curl localhost:4000/api/tournaments/<id>/standings
```

## Architecture decision record

**Decision: scoring logic lives in a pure, framework-free service module,
not inline in controllers or as database triggers.**

`src/services/scoring.service.js` has no dependency on Express or Prisma —
it takes plain arrays/objects in and returns plain objects out. Controllers
fetch rows from Prisma, hand them to the service, and persist the result.

Alternatives considered:
- **Compute in SQL** (window functions for ranking) — faster at scale, but
  BP scoring rules have discrete branches (tie handling, break cutoff
  flags) that get hard to read and test as SQL, and this API's data volumes
  are small (a debate tournament round is tens of rows).
- **Compute inline in the controller** — fastest to write, but couples the
  rules a tournament director actually cares about (how points are
  assigned, how ties at the break are handled) to Express request/response
  plumbing, making them slower to unit test and to change independently.

Trade-off accepted: an extra function call and object-mapping step between
the DB layer and the service, in exchange for scoring rules that are
testable in isolation (see the 9 unit tests covering ranking, aggregation,
and break-tie edge cases) and reusable outside an HTTP context — e.g. a
future CLI that recalculates a break after a late score correction.

## Possible extensions

- WebSocket push for live standings during a tournament
- Swiss-style pairing generator for subsequent rounds based on current standings
- CSV/PDF export of results and adjudicator feedback
- Team/adjudicator conflict-of-interest constraints in the draw
