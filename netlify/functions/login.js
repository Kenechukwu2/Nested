// netlify/functions/login.js
// This serverless function authenticates a user. It accepts a POST request
// containing either a username or email and a password, and verifies the
// credentials against the users table in Netlify DB (Neon Postgres). If the
// credentials are valid, it returns user info; otherwise it returns an error.

import { neon } from '@netlify/neon';

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

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  await ensureUsersTable();
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { username, email, password } = body || {};
  if (!password || (!username && !email)) {
    return new Response(JSON.stringify({ error: 'Email or username and password are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Query user by username or email
  const users = await sql`SELECT id, username, email, password, name FROM users WHERE username = ${username} OR email = ${email}`;
  if (users.length === 0 || users[0].password !== password) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = users[0];
  // Don't include the password in the response
  delete user.password;
  return new Response(JSON.stringify({ message: 'Login successful', user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/login',
};
