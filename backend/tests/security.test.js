const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const mysql = require('mysql2/promise');
const { io } = require('../../frontend/node_modules/socket.io-client');

// 1. Configure test environment port before loading server
process.env.PORT = 5060;
process.env.NODE_ENV = 'test';

// 2. Load env variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');

// Boot server programmatically
const serverModule = require('../server');

const BASE_URL = 'http://localhost:5060/api';

test.describe('ERCS Security Hardening - Phase 2 Integration Tests', () => {
  let citizenToken = '';
  let citizenId = null;
  let adminToken = '';
  let adminId = null;

  test.before(async () => {
    // Wait for server to boot
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clear previous tests
    await pool.execute("DELETE FROM users WHERE email LIKE '%@sectest.com'");

    // Register citizen
    const resCitizen = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sec Citizen',
        email: 'citizen@sectest.com',
        password: 'password123',
        role: 'citizen'
      })
    });
    const dataCitizen = await resCitizen.json();
    citizenToken = dataCitizen.token;
    citizenId = dataCitizen.user.id;

    // Register admin
    const resAdmin = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sec Admin',
        email: 'admin@sectest.com',
        password: 'password123',
        role: 'admin'
      })
    });
    const dataAdmin = await resAdmin.json();
    adminToken = dataAdmin.token;
    adminId = dataAdmin.user.id;

    // Elevate admin in database
    await pool.execute('UPDATE users SET role = "admin" WHERE id = ?', [adminId]);
  });

  test.after(async () => {
    // Clean up
    await pool.execute("DELETE FROM users WHERE email LIKE '%@sectest.com'");
    await pool.end();
    process.exit(0);
  });

  test('1. JWT Validation - Invalid / Missing tokens must be rejected with 401', async () => {
    // Missing token
    const resMissing = await fetch(`${BASE_URL}/emergencies`, {
      method: 'GET'
    });
    assert.strictEqual(resMissing.status, 401);

    // Invalid signature token
    const resInvalid = await fetch(`${BASE_URL}/emergencies`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid.token.signature' }
    });
    assert.strictEqual(resInvalid.status, 401);
  });

  test('2. Backend Authorization - Citizen must be blocked from admin logging routes with 403', async () => {
    const res = await fetch(`${BASE_URL}/admin/logs`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Admin role required/);
  });

  test('3. Socket.io Authentication - Sockets must reject unauthenticated and accept valid tokens', async () => {
    // A: Test with missing token
    const socketNoAuth = io('http://localhost:5060', {
      autoConnect: false,
      reconnection: false
    });
    socketNoAuth.connect();
    
    await new Promise((resolve) => {
      socketNoAuth.on('connect_error', (err) => {
        assert.match(err.message, /Token required/);
        socketNoAuth.close();
        resolve();
      });
    });

    // B: Test with invalid token
    const socketInvalid = io('http://localhost:5060', {
      autoConnect: false,
      reconnection: false,
      auth: { token: 'invalid_socket_token' }
    });
    socketInvalid.connect();

    await new Promise((resolve) => {
      socketInvalid.on('connect_error', (err) => {
        assert.match(err.message, /Invalid token/);
        socketInvalid.close();
        resolve();
      });
    });

    // C: Test with valid token
    const socketValid = io('http://localhost:5060', {
      autoConnect: false,
      reconnection: false,
      auth: { token: citizenToken }
    });
    socketValid.connect();

    await new Promise((resolve) => {
      socketValid.on('connect', () => {
        assert.ok(socketValid.connected);
        socketValid.close();
        resolve();
      });
    });
  });

  test('4. Rate Limiting - API returns 429 after threshold abuse', async () => {
    // Set environment to mock production to enable rate limit checks
    process.env.NODE_ENV = 'production';

    let wasThrottled = false;
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'citizen@sectest.com',
          password: 'password123'
        })
      });
      if (res.status === 429) {
        wasThrottled = true;
        const body = await res.json();
        assert.match(body.message, /Too many requests/);
        break;
      }
    }

    assert.ok(wasThrottled, 'Rate limit was not triggered');

    // Restore test environment
    process.env.NODE_ENV = 'test';
  });

  test('5. Security Headers - Helmet-equivalent headers must exist in response', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
  });

  test('6. Input Validation - Register requires valid email formats', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'bademail.com',
        password: 'password123',
        role: 'citizen'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Invalid email address format/);
  });

  test('7. Input Validation - Register requires at least 6 password characters', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Pass User',
        email: 'pass@sectest.com',
        password: '123',
        role: 'citizen'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Password must be at least 6 characters long/);
  });

  test('8. CORS protection - Blocks access from unauthorized external origins', async () => {
    process.env.NODE_ENV = 'production';
    
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'Origin': 'http://unauthorizedattacker.com' }
    });
    // CORS middleware returns 500 error if CORS check fails or doesn't return headers
    assert.ok(res.status === 500 || !res.headers.get('access-control-allow-origin'));

    process.env.NODE_ENV = 'test';
  });
});
