// Restricts staff/teacher/admin endpoints so student accounts cannot access or modify institutional data
const staffMiddleware = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'teacher')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Teacher or Admin privileges required'
  });
};

module.exports = staffMiddleware;
