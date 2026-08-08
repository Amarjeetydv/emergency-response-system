const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const mysql = require('mysql2/promise');

// 1. Configure test environment port before loading server
process.env.PORT = 5050;
process.env.NODE_ENV = 'test';

// 2. Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Load DB pool configuration to execute query checks
const pool = require('../config/db');

// Boot Express server programmatically
const serverModule = require('../server');

const BASE_URL = 'http://localhost:5050/api';

test.describe('ERCS Emergency Management - Phase 1 Integration Tests', () => {
  let citizenToken = '';
  let citizenId = null;
  let citizen2Token = '';
  let responderAToken = '';
  let responderAId = null;
  let responderBToken = '';
  let responderBId = null;
  let adminToken = '';
  let adminId = null;
  let testEmergencyId = null;

  test.before(async () => {
    // Wait for Express server to initialize and DB pool to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clean up any stale test accounts from previous runs
    await pool.execute("DELETE FROM logs WHERE emergency_id IN (SELECT id FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
    await pool.execute("DELETE FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
    await pool.execute("DELETE FROM users WHERE email LIKE '%@test.com'");

    // Register citizen
    const resCitizen = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Citizen',
        email: 'citizen@test.com',
        password: 'password123',
        role: 'citizen'
      })
    });
    const dataCitizen = await resCitizen.json();
    citizenToken = dataCitizen.token;
    citizenId = dataCitizen.user.id;

    // Register second citizen
    const resCitizen2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Citizen 2',
        email: 'citizen2@test.com',
        password: 'password123',
        role: 'citizen'
      })
    });
    const dataCitizen2 = await resCitizen2.json();
    citizen2Token = dataCitizen2.token;

    // Register responder A
    const resRespA = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Responder A',
        email: 'responderA@test.com',
        password: 'password123',
        role: 'police'
      })
    });
    const dataRespA = await resRespA.json();
    responderAToken = dataRespA.token;
    responderAId = dataRespA.user.id;

    // Register responder B
    const resRespB = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Responder B',
        email: 'responderB@test.com',
        password: 'password123',
        role: 'fire'
      })
    });
    const dataRespB = await resRespB.json();
    responderBToken = dataRespB.token;
    responderBId = dataRespB.user.id;

    // Register admin
    const resAdmin = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin'
      })
    });
    const dataAdmin = await resAdmin.json();
    adminToken = dataAdmin.token;
    adminId = dataAdmin.user.id;

    // Elevate admin in db
    await pool.execute('UPDATE users SET role = "admin" WHERE id = ?', [adminId]);

    // Approve responders using admin token
    await fetch(`${BASE_URL}/auth/users/${responderAId}/approve`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    await fetch(`${BASE_URL}/auth/users/${responderBId}/approve`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
  });

  test.after(async () => {
    // Clean up test records
    await pool.execute("DELETE FROM logs WHERE emergency_id IN (SELECT id FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
    await pool.execute("DELETE FROM emergencies WHERE citizen_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
    await pool.execute("DELETE FROM users WHERE email LIKE '%@test.com'");

    // Close database pool connection
    await pool.end();

    // Force server to close and process exit cleanly
    process.exit(0);
  });

  test('1. Emergency Creation validation - Invalid Coordinates', async () => {
    // Test latitude out of bounds
    const resLat = await fetch(`${BASE_URL}/emergencies`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        emergency_type: 'police',
        latitude: 95.0,
        longitude: 45.0,
        description: 'Test Out of bounds'
      })
    });
    assert.strictEqual(resLat.status, 400);
    const dataLat = await resLat.json();
    assert.match(dataLat.message, /Latitude must be between -90 and 90/);

    // Test longitude out of bounds
    const resLng = await fetch(`${BASE_URL}/emergencies`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        emergency_type: 'medical',
        latitude: 45.0,
        longitude: 185.0,
        description: 'Test Out of bounds'
      })
    });
    assert.strictEqual(resLng.status, 400);
  });

  test('2. Emergency Creation validation - Valid coordinates', async () => {
    const res = await fetch(`${BASE_URL}/emergencies`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        emergency_type: 'police',
        latitude: 25.5937,
        longitude: 78.9629,
        description: 'Valid test case'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    testEmergencyId = body.id;
    assert.ok(testEmergencyId);
  });

  test('3. Authorization - Citizen cannot modify another citizen\'s request', async () => {
    const res = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizen2Token}`
      },
      body: JSON.stringify({
        status: 'cancelled'
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Forbidden/);
  });

  test('4. Atomic Claiming Concurrency - Only one responder can claim the emergency', async () => {
    // Responder A claims emergency
    const resClaimA = await fetch(`${BASE_URL}/emergencies/accept-request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderAToken}`
      },
      body: JSON.stringify({
        request_id: testEmergencyId,
        responder_lat: 25.60,
        responder_lng: 78.97
      })
    });
    assert.strictEqual(resClaimA.status, 200);

    // Responder B attempts to claim the same emergency
    const resClaimB = await fetch(`${BASE_URL}/emergencies/accept-request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderBToken}`
      },
      body: JSON.stringify({
        request_id: testEmergencyId,
        responder_lat: 25.61,
        responder_lng: 78.98
      })
    });
    // Expected to fail with 409 Conflict due to atomic WHERE condition
    assert.strictEqual(resClaimB.status, 409);
    const bodyB = await resClaimB.json();
    assert.match(bodyB.message, /Request already taken/);
  });

  test('5. Authorization - Unassigned responder cannot modify emergency status', async () => {
    // Responder B is unassigned; tries to move emergency from accepted to in_progress
    const res = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderBToken}`
      },
      body: JSON.stringify({
        status: 'in_progress'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Only the assigned responder can/);
  });

  test('6. State Transitions - Enforces correct transition sequences', async () => {
    // Current Status: accepted. Invalid Transition: directly to completed
    const resInvalid = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderAToken}`
      },
      body: JSON.stringify({
        status: 'completed'
      })
    });
    assert.strictEqual(resInvalid.status, 400);

    // Valid Transition: accepted -> in_progress
    const resStart = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderAToken}`
      },
      body: JSON.stringify({
        status: 'in_progress'
      })
    });
    assert.strictEqual(resStart.status, 200);

    // Valid Transition: in_progress -> completed
    const resComplete = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderAToken}`
      },
      body: JSON.stringify({
        status: 'completed'
      })
    });
    assert.strictEqual(resComplete.status, 200);

    // Invalid Transition: completed -> in_progress (Terminal state blocks back-transitions)
    const resRev = await fetch(`${BASE_URL}/emergencies/${testEmergencyId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${responderAToken}`
      },
      body: JSON.stringify({
        status: 'in_progress'
      })
    });
    assert.strictEqual(resRev.status, 400);
    const bodyRev = await resRev.json();
    assert.match(bodyRev.message, /Emergency is already closed/);
  });
});
