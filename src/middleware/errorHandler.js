const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
    });
  }

  // Prisma known request errors (e.g. unique constraint violations)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with this value already exists.',
      fields: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  console.error(err); // unexpected error — log full detail server-side
  return res.status(500).json({ error: 'Internal server error.' });
}

module.exports = errorHandler;
