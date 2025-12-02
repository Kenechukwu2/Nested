// netlify/functions/like.js
// This function toggles a like on a property for a given user. When a user
// likes a property for the first time, a record is created with liked = true.
// If the same user calls again on the same property, the liked value is
// toggled. The current liked state is returned. Only POST requests are
// supported.

import { neon } from '@netlify/neon';

const sql = neon();

async function ensureTables() {
  // Ensure dependent tables exist
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255)
  );`;
  await sql`CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC,
    location VARCHAR(255),
    image TEXT,
    address VARCHAR(255)
  );`;
  await sql`CREATE TABLE IF NOT EXISTS property_likes (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    liked BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(property_id, user_id)
  );`;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  await ensureTables();
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { propertyId, userId } = body || {};
  if (!propertyId || !userId) {
    return new Response(JSON.stringify({ error: 'propertyId and userId are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Check existing like record
  const existing = await sql`SELECT id, liked FROM property_likes WHERE property_id = ${propertyId} AND user_id = ${userId}`;
  let liked;
  if (existing.length > 0) {
    liked = !existing[0].liked;
    await sql`UPDATE property_likes SET liked = ${liked} WHERE id = ${existing[0].id}`;
  } else {
    liked = true;
    await sql`INSERT INTO property_likes (property_id, user_id, liked) VALUES (${propertyId}, ${userId}, ${liked})`;
  }
  return new Response(JSON.stringify({ propertyId, userId, liked }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/properties/like',
};
