const { neon } = require('@netlify/neon');

const sql = neon();

async function ensureUsersTable() {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255)
  );`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  await ensureUsersTable();
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }
  const email = body.email;
  const username = body.username || body.name || email;
  const password = body.password;
  const name = body.name || body.username;
  if (!username || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Username and password are required' }) };
  }
  const existing = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email}`;
  if (existing.length > 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User already exists' }) };
  }
  const inserted = await sql`INSERT INTO users (username, email, password, name) VALUES (${username}, ${email}, ${password}, ${name}) RETURNING id, username, email, name`;
  const user = inserted[0];
  return { statusCode: 201, body: JSON.stringify({ message: 'User registered', user }) };
};

exports.config = {
  path: '/api/register',
};
