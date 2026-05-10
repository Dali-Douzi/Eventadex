const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { MasterUser, Organization } = require('../models');

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

async function masterLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const master = await MasterUser.findOne({ email: email.toLowerCase().trim() });
    if (!master) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, master.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({ id: master._id, role: 'master' });
    res.json({ token, user: { id: master._id, name: master.name, email: master.email, role: 'master' } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const org = await Organization.findOne({ email: email.toLowerCase().trim() });
    if (!org) return res.status(401).json({ message: 'Invalid credentials' });

    if (org.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended. Contact support.' });
    }
    if (org.status === 'deleted') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, org.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({ id: org._id, organizationId: org._id, role: 'admin' });
    res.json({
      token,
      user: { id: org._id, name: org.name, email: org.email, role: 'admin', slug: org.slug, status: org.status },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const { id, role } = req.user;

    if (role === 'master') {
      const master = await MasterUser.findById(id).select('-password');
      if (!master) return res.status(404).json({ message: 'User not found' });
      return res.json({ ...master.toObject(), role: 'master' });
    }

    if (role === 'admin') {
      const org = await Organization.findById(id).select('-password');
      if (!org) return res.status(404).json({ message: 'Organization not found' });
      return res.json({ ...org.toObject(), role: 'admin' });
    }

    res.status(403).json({ message: 'Unknown role' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

module.exports = { masterLogin, adminLogin, getMe };
