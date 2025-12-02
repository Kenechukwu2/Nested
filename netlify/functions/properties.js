const { neon } = require('@netlify/neon');
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

exports.handler = async (event, context) => {
  try {
    await ensurePropertiesTable();
    const method = event.httpMethod;
    if (method === 'GET') {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (id) {
        const rows = await sql`SELECT * FROM properties WHERE id = ${id}`;
        if (!rows || rows.length === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Property not found' })
          };
        }
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rows[0])
        };
      } else {
        const rows = await sql`SELECT * FROM properties`;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rows)
        };
      }
    } else if (method === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (err) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON body' })
        };
      }
      const { title, description, price, location, image, address } = body;
      if (!title) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing title' })
        };
      }
      const result = await sql`INSERT INTO properties (title, description, price, location, image, address) VALUES (${title}, ${description}, ${price}, ${location}, ${image}, ${address}) RETURNING *`;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result[0])
      };
    } else {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err && err.message ? err.message : 'Server error' })
    };
  }
};

exports.config = {
  path: '/api/properties'
};
