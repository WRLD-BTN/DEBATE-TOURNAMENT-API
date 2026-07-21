const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./docs/swagger');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const teamRoutes = require('./routes/team.routes');
const tournamentRoundsRoutes = require('./routes/tournamentRounds.routes');
const roundRoutes = require('./routes/round.routes');

const app = express();

// Helmet's default Content-Security-Policy blocks Swagger UI 

app.use((req, res, next) => {
  if (req.path.startsWith('/docs')) {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        },
      },
    })(req, res, next);
  }
  return helmet()(req, res, next);
});
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'test' ? 'silent' : 'dev'));

// Basic rate limiting to blunt brute-force/abuse on a public API.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// A small landing page at the root, mainly so a bare visit to the deployed

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Debate Tournament Management API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.5rem; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #f4f4f5; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>Debate Tournament Management API</h1>
  <p>REST API for managing British Parliamentary debate tournaments — teams, rounds, ballots, computed standings, Swiss-style pairing, and CSV/PDF export.</p>
  <ul>
    <li><a href="/docs">Interactive API docs (Swagger)</a></li>
    <li><a href="/health">Health check</a></li>
    <li><a href="/api/tournaments">GET /api/tournaments</a> — list tournaments</li>
  </ul>
  <p>Source on <a href="https://github.com/WRLD-BTN/debate-tournament-api">GitHub</a>.</p>
</body>
</html>`);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/tournaments/:tournamentId/teams', teamRoutes);
app.use('/api/tournaments/:tournamentId/rounds', tournamentRoundsRoutes);
app.use('/api/rounds', roundRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use(errorHandler);

module.exports = app;