const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createTeam, listTeams } = require('../controllers/team.controller');

// mergeParams so :tournamentId from the parent router is available here
const router = express.Router({ mergeParams: true });

const createSchema = z.object({
  name: z.string().min(1),
  debaterNames: z.array(z.string().min(1)).max(2).optional(),
});

/**
 * @openapi
 * /api/tournaments/{tournamentId}/teams:
 *   get:
 *     summary: List teams in a tournament
 *     tags: [Teams]
 *   post:
 *     summary: Register a team (admin only)
 *     tags: [Teams]
 */
router.get('/', listTeams);
router.post('/', requireAuth, requireRole('ADMIN'), validate(createSchema), createTeam);

module.exports = router;
