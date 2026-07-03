/**
 * Integration test for the auth flow. Requires DATABASE_URL to point at a
 * reachable (test) PostgreSQL instance with migrations applied — see
 * README "Running tests" section. Skipped automatically if no DB is
 * configured, so `npm test` still runs the pure unit tests everywhere.
 */
const request = require('supertest');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('POST /api/auth/register + /api/auth/login', () => {
  let app;
  let prisma;

  beforeAll(() => {
    app = require('../src/app');
    prisma = require('../src/config/db');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: '[email protected]' } });
    await prisma.$disconnect();
  });

  const credentials = {
    email: '[email protected]',
    password: 'SuperSecret123',
    name: 'Test Runner',
  };

  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(credentials.email);
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});
