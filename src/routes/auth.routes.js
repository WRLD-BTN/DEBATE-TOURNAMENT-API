const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { register, login } = require('../controllers/auth.controller');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'ADJUDICATOR', 'DEBATER']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, example: [email protected] }
 *               password: { type: string, example: AdminPass123 }
 *               name: { type: string, example: Admin }
 *               role: { type: string, enum: [ADMIN, ADJUDICATOR, DEBATER], example: ADMIN }
 */
router.post('/register', validate(registerSchema), register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: [email protected] }
 *               password: { type: string, example: AdminPass123 }
 */
router.post('/login', validate(loginSchema), login);

module.exports = router;
