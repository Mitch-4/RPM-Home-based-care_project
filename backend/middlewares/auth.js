require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // store in .env

module.exports = function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ ok: false, error: "No token provided" });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ ok: false, error: "Token malformed" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach user info (id, role)
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
};
