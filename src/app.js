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

// Helmet's default Content-Security-Policy blocks Swagger UI from
// dynamically rendering the "Server response" section after Execute is
// clicked (it needs 'unsafe-inline'/'unsafe-eval' for its own bundle to
// inject that content). Apply the strict default everywhere EXCEPT
// /docs, where we allow just enough to let Swagger's own static assets
// run — this doesn't loosen anything on the actual API routes.
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

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/tournaments/:tournamentId/teams', teamRoutes);
app.use('/api/tournaments/:tournamentId/rounds', tournamentRoundsRoutes);
app.use('/api/rounds', roundRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use(errorHandler);

module.exports = app;
