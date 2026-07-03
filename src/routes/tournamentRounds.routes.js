const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createRound } = require('../controllers/round.controller');

const router = express.Router({ mergeParams: true }); // exposes :tournamentId

const createRoundSchema = z.object({
  roundNumber: z.number().int().positive(),
  isElimination: z.boolean().optional(),
  motionText: z.string().optional(),
  infoSlide: z.string().optional(),
  teamAssignments: z
    .array(z.object({ teamId: z.string().uuid(), position: z.enum(['OG', 'OO', 'CG', 'CO']) }))
    .length(4),
});

/**
 * @openapi
 * /api/tournaments/{tournamentId}/rounds:
 *   post:
 *     summary: Create a round with the 4 BP team assignments (admin only)
 *     tags: [Rounds]
 */
router.post('/', requireAuth, requireRole('ADMIN'), validate(createRoundSchema), createRound);

module.exports = router;
