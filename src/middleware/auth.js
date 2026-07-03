const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// Verifies the Bearer token and attaches { id, role, email } to req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new ApiError(401, 'Missing or malformed Authorization header.');

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token.');
  }
}

// Usage: requireRole('ADMIN'), requireRole('ADMIN', 'ADJUDICATOR')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new ApiError(401, 'Not authenticated.');
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Requires one of roles: ${roles.join(', ')}.`);
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
