// middlewares/deviceAuth.js
require('dotenv').config();
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || null;

module.exports = function deviceAuth(req, res, next) {
  // Devices should send header: x-device-key: <key>
  if (!DEVICE_API_KEY) return next(); // if no key configured, skip (dev convenience)
  const key = req.headers['x-device-key'] || req.headers['x-device-key'.toLowerCase()];
  if (!key || key !== DEVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing device API key' });
  }
  return next();
};
