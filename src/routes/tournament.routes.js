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
  getNextRoundPairings,
  exportStandingsCsv,
  exportStandingsPdf,
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, startDate, endDate]
 *             properties:
 *               name: { type: string, example: BUSE Easters 2026 }
 *               location: { type: string, example: Bindura University of Science Education }
 *               startDate: { type: string, format: date-time, example: "2026-08-01T00:00:00.000Z" }
 *               endDate: { type: string, format: date-time, example: "2026-08-02T00:00:00.000Z" }
 *               breakSize: { type: integer, example: 4 }
 */
router.get('/', listTournaments);
router.post('/', requireAuth, requireRole('ADMIN'), validate(createSchema), createTournament);

/**
 * @openapi
 * /api/tournaments/{id}:
 *   get:
 *     summary: Get a tournament with teams and rounds
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id', getTournament);

/**
 * @openapi
 * /api/tournaments/{id}/standings:
 *   get:
 *     summary: Computed standings (team points, speaker points) across all rounds so far
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id/standings', getStandings);

/**
 * @openapi
 * /api/tournaments/{id}/break:
 *   get:
 *     summary: Which teams break to elimination rounds, based on current standings
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id/break', getBreak);

/**
 * @openapi
 * /api/tournaments/{id}/pairings/next-round:
 *   get:
 *     summary: Propose the next round's room draw (Swiss-style, avoiding rematches). Admin only; does not persist.
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id/pairings/next-round', requireAuth, requireRole('ADMIN'), getNextRoundPairings);

/**
 * @openapi
 * /api/tournaments/{id}/standings/export.csv:
 *   get:
 *     summary: Download standings as a CSV file
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id/standings/export.csv', exportStandingsCsv);

/**
 * @openapi
 * /api/tournaments/{id}/standings/export.pdf:
 *   get:
 *     summary: Download standings as a formatted PDF
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id/standings/export.pdf', exportStandingsPdf);

module.exports = router;
