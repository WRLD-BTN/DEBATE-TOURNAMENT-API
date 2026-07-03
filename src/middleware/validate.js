const ApiError = require('../utils/ApiError');

// validate(schema) parses req.body against a Zod schema and replaces
// req.body with the parsed (typed, defaulted) result, or throws a 400.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(400, 'Validation failed.', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
