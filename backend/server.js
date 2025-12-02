/*
 * Simple HTTP backend for the Nested real estate website.
 *
 * This server implements a handful of JSON‑based endpoints to support
 * registration, login, property listings and a contact form.  No
 * external dependencies are used; everything relies on Node’s built‑in
 * modules so it can run in restricted environments without access to
 * npm.  Data is persisted to JSON files located under the `data`
 * directory relative to this file.  Passwords are hashed with SHA‑256
 * via the built‑in `crypto` module.  Note that this implementation is
 * intentionally simple and should not be used for production without
 * additional security hardening (e.g. proper authentication tokens,
 * rate limiting, input validation).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Helper to ensure data directory and files exist.  If missing, they
// are created with sensible defaults.
function ensureDataFiles() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const usersPath = path.join(dataDir, 'users.json');
  const propsPath = path.join(dataDir, 'properties.json');
  const contactPath = path.join(dataDir, 'contacts.json');
  if (!fs.existsSync(usersPath)) fs.writeFileSync(usersPath, '[]', 'utf8');
  if (!fs.existsSync(propsPath)) {
    // Seed with a few example properties so the listing page has content.
    const seed = [
      {
        id: 1,
        title: '3‑Bedroom Apartment in Port Harcourt',
        description: 'Spacious apartment located in the heart of Port Harcourt with modern amenities.',
        price: 25000000,
        address: 'Port Harcourt, Rivers State, Nigeria',
        imageUrl: '/img/listing1.jpg'
      },
      {
        id: 2,
        title: 'Luxury Villa in Lagos',
        description: 'A luxurious villa with sea view situated in Banana Island.',
        price: 120000000,
        address: 'Banana Island, Lagos, Nigeria',
        imageUrl: '/img/listing2.jpg'
      }
    ];
    fs.writeFileSync(propsPath, JSON.stringify(seed, null, 2), 'utf8');
  }
  if (!fs.existsSync(contactPath)) fs.writeFileSync(contactPath, '[]', 'utf8');
}

// Read JSON file safely.  Returns an array/object or a default value on
// error.
function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading', filePath, err);
    return [];
  }
}

// Write JSON file safely.
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing', filePath, err);
    return false;
  }
}

// Compute a simple hash of a password.  We use SHA‑256 and return a
// hexadecimal string.  In a production system you would use a
// stronger password hashing algorithm like bcrypt or argon2.
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(String(password))
    .digest('hex');
}

// Generate a rudimentary session token.  Here we simply base64‑encode
// 32 random bytes.  There is no built‑in expiry or signature.
function generateToken() {
  return crypto.randomBytes(32).toString('base64');
}

// Parse request body into a JSON object.  Returns a promise that
// resolves when parsing completes.  If the body isn’t valid JSON the
// promise will resolve with null.
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // Limit body size to 1MB to avoid memory abuse
      if (data.length > 1e6) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const obj = JSON.parse(data);
        resolve(obj);
      } catch (err) {
        resolve(null);
      }
    });
  });
}

// Main request handler.  Dispatches based on method and URL.  All
// responses are JSON except for invalid routes.
async function handleRequest(req, res) {
  // Enable CORS to allow the front‑end to call the API from another
  // domain or port.  In production you might restrict the origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Helper to send JSON responses
  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  try {
    // User registration
    if (req.method === 'POST' && pathname === '/api/register') {
      const body = await parseBody(req);
      if (!body || !body.email || !body.password || !body.name) {
        return send(400, { error: 'Missing required fields' });
      }
      const dataDir = path.join(__dirname, 'data');
      const usersPath = path.join(dataDir, 'users.json');
      const users = readJson(usersPath);
      const existing = users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
      if (existing) {
        return send(409, { error: 'User already exists' });
      }
      const newUser = {
        id: users.length ? users[users.length - 1].id + 1 : 1,
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(body.password),
      };
      users.push(newUser);
      writeJson(usersPath, users);
      return send(201, { message: 'Registration successful', userId: newUser.id });
    }

    // User login
    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      if (!body || !body.email || !body.password) {
        return send(400, { error: 'Missing email or password' });
      }
      const dataDir = path.join(__dirname, 'data');
      const usersPath = path.join(dataDir, 'users.json');
      const users = readJson(usersPath);
      const user = users.find((u) => u.email === body.email.toLowerCase());
      if (!user || user.passwordHash !== hashPassword(body.password)) {
        return send(401, { error: 'Invalid email or password' });
      }
      const token = generateToken();
      // In a real backend you would persist the token and use it
      // subsequently for authentication.  Here we simply return it.
      return send(200, { message: 'Login successful', token, userId: user.id });
    }

    // Property list
    if (req.method === 'GET' && pathname === '/api/properties') {
      const propsPath = path.join(__dirname, 'data', 'properties.json');
      const properties = readJson(propsPath);
      return send(200, { properties });
    }

    // Single property by id
    if (req.method === 'GET' && pathname.startsWith('/api/properties/')) {
      const idStr = pathname.split('/').pop();
      const id = parseInt(idStr, 10);
      if (isNaN(id)) return send(400, { error: 'Invalid property id' });
      const propsPath = path.join(__dirname, 'data', 'properties.json');
      const properties = readJson(propsPath);
      const property = properties.find((p) => p.id === id);
      if (!property) return send(404, { error: 'Property not found' });
      return send(200, { property });
    }

    // Add property
    if (req.method === 'POST' && pathname === '/api/properties') {
      const body = await parseBody(req);
      if (!body || !body.title || !body.description || !body.price || !body.address) {
        return send(400, { error: 'Missing required property fields' });
      }
      const propsPath = path.join(__dirname, 'data', 'properties.json');
      const properties = readJson(propsPath);
      const newProp = {
        id: properties.length ? properties[properties.length - 1].id + 1 : 1,
        title: body.title,
        description: body.description,
        price: body.price,
        address: body.address,
        imageUrl: body.imageUrl || ''
      };
      properties.push(newProp);
      writeJson(propsPath, properties);
      return send(201, { message: 'Property added', property: newProp });
    }

    // Contact form
    if (req.method === 'POST' && pathname === '/api/contact') {
      const body = await parseBody(req);
      if (!body || !body.name || !body.email || !body.message) {
        return send(400, { error: 'Missing contact fields' });
      }
      const contactPath = path.join(__dirname, 'data', 'contacts.json');
      const contacts = readJson(contactPath);
      const newMsg = {
        id: contacts.length ? contacts[contacts.length - 1].id + 1 : 1,
        name: body.name,
        email: body.email,
        message: body.message,
        timestamp: new Date().toISOString()
      };
      contacts.push(newMsg);
      writeJson(contactPath, contacts);
      return send(201, { message: 'Message received', id: newMsg.id });
    }

    // 404 for unknown API routes
    if (pathname.startsWith('/api/')) {
      return send(404, { error: 'Endpoint not found' });
    }
    // Fallback: simple response for root
    if (pathname === '/' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Nested backend up and running');
      return;
    }
    // If none of the above matched, return 404.
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
  } catch (err) {
    console.error('Unexpected server error', err);
    send(500, { error: 'Internal server error' });
  }
}

// Ensure data files exist before starting the server.
ensureDataFiles();

const port = process.env.PORT || 3000;
const server = http.createServer(handleRequest);
server.listen(port, () => {
  console.log(`Nested backend listening on port ${port}`);
});
