const jwt = require('jsonwebtoken');
const { Organization } = require('../models');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function verifyToken(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireMaster(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'master') {
      return res.status(403).json({ message: 'Access denied: master role required' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: admin role required' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requirePermission(perm) {
  return async (req, res, next) => {
    try {
      const org = await Organization.findById(req.user.organizationId)
        .select('permissions').lean();
      if (!org) return res.status(403).json({ message: 'Organization not found' });
      if (org.permissions && org.permissions[perm] === false) {
        return res.status(403).json({ message: 'Access denied: insufficient permissions' });
      }
      next();
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  };
}

module.exports = { verifyToken, requireMaster, requireAdmin, requirePermission };
