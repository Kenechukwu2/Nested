const http = require('http');
const assert = require('assert');

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const options = {
      method,
      hostname: 'localhost',
      port: 3000,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (e) {
          // ignore parse errors
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('Running tests...');

  // Register a user
  const reg = await request('POST', '/api/register', { username: 'testuser', password: 'testpass' });
  assert.strictEqual(reg.status, 201, 'register status');
  assert.ok(reg.body && reg.body.message, 'register message');

  // Login the user
  const login = await request('POST', '/api/login', { username: 'testuser', password: 'testpass' });
  assert.strictEqual(login.status, 200, 'login status');
  assert.ok(login.body && login.body.message, 'login message');

  // Get property listings
  const props = await request('GET', '/api/properties');
  assert.strictEqual(props.status, 200, 'get properties status');
  assert.ok(props.body && Array.isArray(props.body.properties), 'properties array');

  // Add a property
  const newProperty = { title: 'Test Home', description: 'A test property', price: 100000 };
  const addProp = await request('POST', '/api/properties', newProperty);
  assert.strictEqual(addProp.status, 201, 'add property status');
  assert.ok(addProp.body && addProp.body.message, 'add property message');

  // Submit contact form
  const contactData = { name: 'Tester', email: 'test@example.com', message: 'Hello there' };
  const contact = await request('POST', '/api/contact', contactData);
  assert.strictEqual(contact.status, 201, 'contact status');
  assert.ok(contact.body && contact.body.message, 'contact message');

  console.log('All tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
