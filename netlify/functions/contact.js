// netlify/functions/contact.js
// This function accepts messages from users and stores them in a contacts
// table. It only supports POST requests. Each message includes a name,
// email and message body and is timestamped when stored.

import { neon } from '@netlify/neon';

const sql = neon();

async function ensureContactsTable() {
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  await ensureContactsTable();
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { name, email, message } = body || {};
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const inserted = await sql`INSERT INTO contacts (name, email, message) VALUES (${name}, ${email}, ${message}) RETURNING id, name, email, message, created_at`;
  return new Response(JSON.stringify({ message: 'Contact submitted', contact: inserted[0] }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/contact',
};
