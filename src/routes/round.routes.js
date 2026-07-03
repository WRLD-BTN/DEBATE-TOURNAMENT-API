const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { submitBallot, assignAdjudicator } = require('../controllers/round.controller');

const router = express.Router();

const ballotSchema = z.object({
  results: z
    .array(z.object({ teamId: z.string().uuid(), speakerPts: z.number().int().nonnegative() }))
    .length(4),
});

const adjudicatorSchema = z.object({
  userId: z.string().uuid(),
  isChair: z.boolean().optional(),
});

/**
 * @openapi
 * /api/rounds/{roundId}/ballot:
 *   post:
 *     summary: Submit adjudicator ballot results; server derives rank + team points
 *     tags: [Rounds]
 */
router.post(
  '/:roundId/ballot',
  requireAuth,
  requireRole('ADMIN', 'ADJUDICATOR'),
  validate(ballotSchema),
  submitBallot
);

/**
 * @openapi
 * /api/rounds/{roundId}/adjudicators:
 *   post:
 *     summary: Assign an adjudicator to a round (admin only)
 *     tags: [Rounds]
 */
router.post(
  '/:roundId/adjudicators',
  requireAuth,
  requireRole('ADMIN'),
  validate(adjudicatorSchema),
  assignAdjudicator
);

module.exports = router;
