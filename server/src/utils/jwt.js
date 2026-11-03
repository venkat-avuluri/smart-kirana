import jwt from 'jsonwebtoken';

/**
 * Generate signed JWT token
 * @param {Object} payload User payload with id and role
 * @returns {String} JWT token
 */
export const generateToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'smart_kirana_secure_fallback_secret_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  return jwt.sign(
    {
      id: payload.id || payload._id,
      username: payload.username,
      role: payload.role,
    },
    secret,
    { expiresIn }
  );
};

/**
 * Verify JWT token
 * @param {String} token
 * @returns {Object} Decoded payload
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'smart_kirana_secure_fallback_secret_key';
  return jwt.verify(token, secret);
};
