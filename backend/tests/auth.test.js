const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const mysql = require('mysql2/promise');

process.env.PORT = 5080;
process.env.NODE_ENV = 'test';

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');
const serverModule = require('../server');

const BASE_URL = 'http://localhost:5080/api';

test.describe('ERCS Authentication Hardening - Phase 5A Integration Tests', () => {
  let citizenEmail = 'citizen-auth@authtest.com';
  let citizenPassword = 'password123';
  let accessToken = '';
  let refreshTokenCookie = '';

  test.before(async () => {
    // Wait for server to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await pool.execute("DELETE FROM users WHERE email = ?", [citizenEmail]);
  });

  test.after(async () => {
    await pool.execute("DELETE FROM users WHERE email = ?", [citizenEmail]);
    await pool.end();
    process.exit(0);
  });

  test('1. Registration - registers user, issues access token, sets refresh cookie', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth Citizen',
        email: citizenEmail,
        password: citizenPassword,
        role: 'citizen'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.token, 'Should return access token');
    assert.strictEqual(body.user.email, citizenEmail);

    const cookies = res.headers.getSetCookie();
    assert.ok(cookies.length > 0, 'Should set cookies');
    
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    assert.ok(refreshCookie, 'Should set refreshToken cookie');
    assert.ok(refreshCookie.includes('HttpOnly'), 'Should be HttpOnly');
    assert.ok(refreshCookie.includes('Path=/api/auth'), 'Should limit path');

    accessToken = body.token;
    refreshTokenCookie = refreshCookie.split(';')[0];
  });

  test('2. Login - validates credentials and returns new rotated refresh cookie', async () => {
    // A: Fail on invalid password
    const resFail = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password: 'wrong_password'
      })
    });
    assert.strictEqual(resFail.status, 401);

    // B: Succeed on correct password
    const resOk = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password: citizenPassword
      })
    });

    assert.strictEqual(resOk.status, 200);
    const body = await resOk.json();
    assert.ok(body.token);

    const cookies = resOk.headers.getSetCookie();
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    assert.ok(refreshCookie);
    
    accessToken = body.token;
    refreshTokenCookie = refreshCookie.split(';')[0];
  });

  test('3. Token Refresh - rotates token and generates a new access token', async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': refreshTokenCookie
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.notStrictEqual(body.token, accessToken);

    const cookies = res.headers.getSetCookie();
    const newRefreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    assert.ok(newRefreshCookie);

    // Update session tokens
    accessToken = body.token;
    refreshTokenCookie = newRefreshCookie.split(';')[0];
  });

  test('4. Token Replay Protection - reuse of rotated refresh token invalidates session', async () => {
    const oldCookie = refreshTokenCookie;

    // Trigger normal refresh once to rotate
    const resRotate = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': oldCookie }
    });
    assert.strictEqual(resRotate.status, 200);

    // Attempt reuse of the now-rotated oldCookie
    const resReplay = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': oldCookie }
    });
    // Replay attempts must be blocked with 401
    assert.strictEqual(resReplay.status, 401);
  });

  test('5. Logout - invalidates refresh token and clears cookie', async () => {
    // Log in to get a fresh valid session
    const resLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: citizenEmail,
        password: citizenPassword
      })
    });
    const cookies = resLogin.headers.getSetCookie();
    const validCookie = cookies.find(c => c.startsWith('refreshToken=')).split(';')[0];

    // Call logout
    const resLogout = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': validCookie
      }
    });

    assert.strictEqual(resLogout.status, 200);
    const logoutCookies = resLogout.headers.getSetCookie();
    const deletedCookie = logoutCookies.find(c => c.startsWith('refreshToken='));
    assert.ok(deletedCookie.includes('Max-Age=') || deletedCookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'));

    // Verify token can no longer be used to refresh
    const resRefresh = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': validCookie
      }
    });
    assert.strictEqual(resRefresh.status, 401);
  });
});
