// netlify/functions/properties.js
// This function serves as both a list and create endpoint for property
// listings. On GET requests it returns all properties, or a single property
// when an `id` query parameter is provided. On POST requests it creates a new
// property record. The data is stored in a Postgres database via Netlify DB.

import { neon } from '@netlify/neon';

const sql = neon();

async function ensurePropertiesTable() {
  await sql`CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC,
    location VARCHAR(255),
    image TEXT,
    address VARCHAR(255)
  );`;
}

export default async (req) => {
  await ensurePropertiesTable();
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const rows = await sql`SELECT * FROM properties WHERE id = ${id}`;
      if (rows.length === 0) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(JSON.stringify(rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const all = await sql`SELECT * FROM properties ORDER BY id`; 
    return new Response(JSON.stringify(all), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { title, description, price, location, image, address } = body || {};
    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const inserted = await sql`INSERT INTO properties (title, description, price, location, image, address) VALUES (${title}, ${description}, ${price}, ${location}, ${image}, ${address}) RETURNING *`;
    return new Response(JSON.stringify(inserted[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('Method Not Allowed', { status: 405 });
};

export const config = {
  path: '/api/properties',
};
