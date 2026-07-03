const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  createTournament,
  listTournaments,
  getTournament,
  getStandings,
  getBreak,
} = require('../controllers/tournament.controller');

const router = express.Router();

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  breakSize: z.number().int().positive().optional(),
});

/**
 * @openapi
 * /api/tournaments:
 *   get:
 *     summary: List all tournaments
 *     tags: [Tournaments]
 *   post:
 *     summary: Create a tournament (admin only)
 *     tags: [Tournaments]
 */
router.get('/', listTournaments);
router.post('/', requireAuth, requireRole('ADMIN'), validate(createSchema), createTournament);

/**
 * @openapi
 * /api/tournaments/{id}:
 *   get:
 *     summary: Get a tournament with teams and rounds
 *     tags: [Tournaments]
 */
router.get('/:id', getTournament);

/**
 * @openapi
 * /api/tournaments/{id}/standings:
 *   get:
 *     summary: Computed standings (team points, speaker points) across all rounds so far
 *     tags: [Tournaments]
 */
router.get('/:id/standings', getStandings);

/**
 * @openapi
 * /api/tournaments/{id}/break:
 *   get:
 *     summary: Which teams break to elimination rounds, based on current standings
 *     tags: [Tournaments]
 */
router.get('/:id/break', getBreak);

module.exports = router;
