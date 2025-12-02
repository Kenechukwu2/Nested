// netlify/functions/register.js
// This serverless function handles user registration. It connects to the
// Netlify DB (Neon Postgres) via the @netlify/neon client. When invoked with
// a POST request, it creates a new user record if the username or email does
// not already exist. It returns JSON responses with appropriate status codes.

import { neon } from '@netlify/neon';

// Initialize a query client. When no connection string is provided, the
// library automatically uses the NETLIFY_DATABASE_URL environment variable
// exposed by Netlify DB.
const sql = neon();

// Ensure the users table exists before performing any queries. The table
// includes a unique constraint on username and email to prevent duplicates.
async function ensureUsersTable() {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255)
  );`;
}

export default async (req) => {
  // Only accept POST requests. Other methods are not allowed.
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  await ensureUsersTable();
  // Parse the JSON body. If parsing fails, return an error.
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { username, email, password, name } = body || {};
  // Basic validation
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Check for existing user by username or email
  const existing = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email}`;
  if (existing.length > 0) {
    return new Response(JSON.stringify({ error: 'User already exists' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Insert new user record
  const inserted = await sql`INSERT INTO users (username, email, password, name) VALUES (${username}, ${email}, ${password}, ${name}) RETURNING id, username, email, name`;
  const user = inserted[0];
  return new Response(JSON.stringify({ message: 'User registered', user }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Expose the function at the /api/register endpoint. Netlify uses this
// configuration to map requests to the proper function without requiring
// redirects or a netlify.toml rule.
export const config = {
  path: '/api/register',
};
