/**
 * Role-Based Access Control Middleware
 * @param  {...String} roles Allowed roles, e.g. 'ADMIN', 'STAFF'
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking permissions.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Requires ${roles.join(' or ')} privileges.`,
      });
    }

    next();
  };
};
