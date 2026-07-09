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
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roundNumber, teamAssignments]
 *             properties:
 *               roundNumber: { type: integer, example: 1 }
 *               isElimination: { type: boolean, example: false }
 *               motionText: { type: string, example: This House Would abolish standardized testing. }
 *               infoSlide: { type: string, example: "" }
 *               teamAssignments:
 *                 type: array
 *                 example:
 *                   - { teamId: "6b44fc4a-d3dc-4b33-810a-60b307de9f5c", position: "OG" }
 *                   - { teamId: "0ae831e9-6e2b-492e-bb51-4bb9de4b8144", position: "OO" }
 *                   - { teamId: "8e933fab-1e8f-4c5f-9578-50a84dc599ff", position: "CG" }
 *                   - { teamId: "1e3abc58-a99e-4310-ac42-cd8e540e5722", position: "CO" }
 *                 items:
 *                   type: object
 *                   properties:
 *                     teamId: { type: string }
 *                     position: { type: string, enum: [OG, OO, CG, CO] }
 */
router.post('/', requireAuth, requireRole('ADMIN'), validate(createRoundSchema), createRound);

module.exports = router;
