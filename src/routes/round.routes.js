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
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [results]
 *             properties:
 *               results:
 *                 type: array
 *                 example:
 *                   - { teamId: "6b44fc4a-d3dc-4b33-810a-60b307de9f5c", speakerPts: 160 }
 *                   - { teamId: "0ae831e9-6e2b-492e-bb51-4bb9de4b8144", speakerPts: 150 }
 *                   - { teamId: "8e933fab-1e8f-4c5f-9578-50a84dc599ff", speakerPts: 145 }
 *                   - { teamId: "1e3abc58-a99e-4310-ac42-cd8e540e5722", speakerPts: 140 }
 *                 items:
 *                   type: object
 *                   properties:
 *                     teamId: { type: string }
 *                     speakerPts: { type: integer }
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
 *     parameters:
 *       - in: path
 *         name: roundId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, example: "00000000-0000-0000-0000-000000000000" }
 *               isChair: { type: boolean, example: false }
 */
router.post(
  '/:roundId/adjudicators',
  requireAuth,
  requireRole('ADMIN'),
  validate(adjudicatorSchema),
  assignAdjudicator
);

module.exports = router;
