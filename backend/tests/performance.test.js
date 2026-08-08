const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const mysql = require('mysql2/promise');

// 1. Configure test environment port before loading server
process.env.PORT = 5070;
process.env.NODE_ENV = 'test';

// Load env variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');

// Boot server programmatically
const serverModule = require('../server');

const BASE_URL = 'http://localhost:5070/api';

test.describe('ERCS Performance & Architecture - Phase 3 Integration Tests', () => {
  let citizenToken = '';
  let adminToken = '';
  let adminId = null;

  test.before(async () => {
    // Wait for server to boot
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clear previous tests
    await pool.execute("DELETE FROM users WHERE email LIKE '%@perftest.com'");

    // Register citizen
    const resCitizen = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Perf Citizen',
        email: 'citizen@perftest.com',
        password: 'password123',
        role: 'citizen'
      })
    });
    const dataCitizen = await resCitizen.json();
    citizenToken = dataCitizen.token;

    // Register admin
    const resAdmin = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Perf Admin',
        email: 'admin@perftest.com',
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
    await pool.execute("DELETE FROM logs WHERE emergency_id IN (SELECT id FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@perftest.com'))");
    await pool.execute("DELETE FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@perftest.com')");
    await pool.execute("DELETE FROM users WHERE email LIKE '%@perftest.com'");
    await pool.end();
    process.exit(0);
  });

  test('1. Database Aggregations - Analytics calculates status counts', async () => {
    // Insert mock incidents for perftest users
    const [result] = await pool.execute(
      "INSERT INTO emergencies (citizen_id, emergency_type, latitude, longitude, status) VALUES (?, 'police', 12.34, 56.78, 'pending')",
      [adminId] // use elevated admin as mock owner for simplicity
    );
    const mockEmergId = result.insertId;

    const res = await fetch(`http://localhost:5070/api/admin/analytics`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    
    // Assert structure
    assert.ok(body.totalEmergencies >= 1);
    assert.ok(body.statusCounts);
    assert.ok(body.statusCounts.pending >= 1);

    // Clean up mock emergency
    await pool.execute("DELETE FROM logs WHERE emergency_id = ?", [mockEmergId]);
    await pool.execute("DELETE FROM emergencies WHERE id = ?", [mockEmergId]);
  });

  test('2. Server-side Pagination - List limits outputs by page boundaries', async () => {
    // Create multiple mock incidents
    const [mock1] = await pool.execute(
      "INSERT INTO emergencies (citizen_id, emergency_type, latitude, longitude, status) VALUES (?, 'police', 10.0, 10.0, 'pending')",
      [adminId]
    );
    const [mock2] = await pool.execute(
      "INSERT INTO emergencies (citizen_id, emergency_type, latitude, longitude, status) VALUES (?, 'fire', 20.0, 20.0, 'pending')",
      [adminId]
    );

    // Query page 1 with limit 1
    const resPage1 = await fetch(`http://localhost:5070/api/emergencies?page=1&limit=1`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(resPage1.status, 200);
    const bodyPage1 = await resPage1.json();
    assert.strictEqual(bodyPage1.length, 1);

    // Clean up
    await pool.execute("DELETE FROM logs WHERE emergency_id IN (?, ?)", [mock1.insertId, mock2.insertId]);
    await pool.execute("DELETE FROM emergencies WHERE id IN (?, ?)", [mock1.insertId, mock2.insertId]);
  });

  test('3. Health Check Diagnostics - Verify db connectivity checks', async () => {
    const res = await fetch(`http://localhost:5070/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'UP');
    assert.strictEqual(body.database, 'CONNECTED');
  });
});
