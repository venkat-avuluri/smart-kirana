// Automated Test Suite for Smart Kirana Phase 1 Foundation

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMART KIRANA - PHASE 1 FOUNDATION VERIFICATION TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  };

  try {
    // 1. Health check & DB connectivity
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds with 200');
    assert(health.database?.connected === true, 'MongoDB database is actively connected');

    // 2. Reject invalid credentials
    const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    const badLogin = await badLoginRes.json();
    assert(badLoginRes.status === 401, 'Invalid password is systematically rejected with 401');

    // 3. Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword123' }),
    });
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin successfully logs in');
    assert(adminData.user?.role === 'ADMIN', 'Admin has ADMIN role');
    assert(typeof adminData.token === 'string', 'Admin receives valid JWT token');

    const adminToken = adminData.token;

    // 4. Staff login
    const staffLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'staff', password: 'staffpassword123' }),
    });
    const staffData = await staffLoginRes.json();
    assert(staffLoginRes.status === 200, 'Staff successfully logs in');
    assert(staffData.user?.role === 'STAFF', 'Staff has STAFF role');
    assert(typeof staffData.token === 'string', 'Staff receives valid JWT token');

    const staffToken = staffData.token;

    // 5. Check protected session /me for Admin
    const meAdminRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meAdmin = await meAdminRes.json();
    assert(meAdminRes.status === 200 && meAdmin.user?.username === 'admin', 'Admin can fetch /me session');

    // 6. Check protected session /me for Staff
    const meStaffRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const meStaff = await meStaffRes.json();
    assert(meStaffRes.status === 200 && meStaff.user?.username === 'staff', 'Staff can fetch /me session');

    // 7. Security Boundary: Staff tries to access Admin user management
    const staffForbiddenRes = await fetch(`${BASE_URL}/api/v1/auth/users`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffForbiddenRes.status === 403, 'RBAC correctly blocks Staff from Admin users list with 403');

    // 8. Admin accesses user management
    const adminUsersRes = await fetch(`${BASE_URL}/api/v1/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsers = await adminUsersRes.json();
    assert(adminUsersRes.status === 200, 'Admin can list store users');
    assert(Array.isArray(adminUsers.users) && adminUsers.users.length >= 2, 'User list contains seeded accounts');

    // 9. Admin creates a new staff account
    const testUsername = `counter_${Date.now().toString().slice(-4)}`;
    const createStaffRes = await fetch(`${BASE_URL}/api/v1/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Test Trainee',
        username: testUsername,
        password: 'traineepassword123',
        role: 'STAFF',
        phone: '9876500000',
      }),
    });
    const createdStaff = await createStaffRes.json();
    assert(createStaffRes.status === 201, 'Admin can successfully create a new Staff account');

    // 10. Deactivate the new account
    const toggleRes = await fetch(`${BASE_URL}/api/v1/auth/users/${createdStaff.user._id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const toggleData = await toggleRes.json();
    assert(toggleRes.status === 200 && toggleData.user.isActive === false, 'Admin can deactivate a user account');

    // 11. Deactivated user cannot log in
    const deactLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'traineepassword123' }),
    });
    assert(deactLoginRes.status === 403, 'Deactivated user is blocked from logging in with 403');

    // 12. Safety: Admin cannot deactivate their own active account
    const selfDeactRes = await fetch(`${BASE_URL}/api/v1/auth/users/${adminData.user.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(selfDeactRes.status === 400, 'Safety guard prevents Admin from deactivating their own active session');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Test Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
