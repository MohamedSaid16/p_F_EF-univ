/**
 * DEBUG: Teacher Assignment Testing Script
 * Tests the complete teacher assignment flow end-to-end
 * Run with: node DEBUG_TEACHER_ASSIGNMENT.js
 */

const API_BASE = 'http://localhost:5000/api/v1';

// Test users (from seed data)
const ADMIN_EMAIL = 'admin@univ-tiaret.dz';
const ADMIN_PASSWORD = 'Test@1234';
const TEACHER_EMAIL = 'teacher@univ-tiaret.dz'; // Enseignant role
const TEACHER_PASSWORD = 'Test@1234';

let adminToken = null;
let adminUserId = null;
let teacherId = null;

// ============================================
// Helper Functions
// ============================================

async function request(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const responseData = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data: responseData,
    };
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Test Steps
// ============================================

async function step1_AdminLogin() {
  console.log('\n📝 STEP 1: Admin Login');
  console.log('━'.repeat(50));

  try {
    const res = await request('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
    }

    adminToken = res.data.data.accessToken;
    adminUserId = res.data.data.user.id;

    console.log('✅ Admin logged in successfully');
    console.log(`   Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   Admin ID: ${adminUserId}`);

    return true;
  } catch (error) {
    console.error('❌ Admin login failed:', error.message);
    return false;
  }
}

async function step2_GetTeachers() {
  console.log('\n📝 STEP 2: Get Teachers List');
  console.log('━'.repeat(50));

  try {
    const res = await request('GET', '/auth/admin/users?role=enseignant', null, adminToken);

    if (!res.ok) {
      throw new Error(`Failed to fetch teachers: ${JSON.stringify(res.data)}`);
    }

    const teachers = res.data.data || [];
    console.log(`✅ Found ${teachers.length} teachers`);

    if (teachers.length === 0) {
      throw new Error('No teachers found in the system');
    }

    teacherId = teachers[0].id;
    console.log(`   Selected teacher: ${teachers[0].nom} ${teachers[0].prenom} (ID: ${teacherId})`);
    console.log(`   Email: ${teachers[0].email}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to fetch teachers:', error.message);
    return false;
  }
}

async function step3_GetModules() {
  console.log('\n📝 STEP 3: Get Available Modules');
  console.log('━'.repeat(50));

  try {
    const res = await request('GET', '/modules', null, adminToken);

    if (!res.ok) {
      throw new Error(`Failed to fetch modules: ${JSON.stringify(res.data)}`);
    }

    const modules = res.data.data || [];
    console.log(`✅ Found ${modules.length} modules`);

    if (modules.length === 0) {
      throw new Error('No modules found in the system');
    }

    // Show first 5 modules
    console.log('\n   Available modules (first 5):');
    modules.slice(0, 5).forEach((mod, i) => {
      console.log(`   ${i + 1}. ${mod.nom} (ID: ${mod.id}, Specialite: ${mod.specialiteNom || 'N/A'})`);
    });

    return modules.slice(0, 3).map((m) => m.id); // Return first 3 module IDs
  } catch (error) {
    console.error('❌ Failed to fetch modules:', error.message);
    return [];
  }
}

async function step4_GetPromos() {
  console.log('\n📝 STEP 4: Get Available Promos');
  console.log('━'.repeat(50));

  try {
    const res = await request('GET', '/promos', null, adminToken);

    if (!res.ok) {
      throw new Error(`Failed to fetch promos: ${JSON.stringify(res.data)}`);
    }

    const promos = res.data.data || [];
    console.log(`✅ Found ${promos.length} promos`);

    if (promos.length === 0) {
      console.log('   ⚠️  No promos available, will proceed without promoId');
      return null;
    }

    const promo = promos[0];
    console.log(`   Selected promo: ${promo.nom} (ID: ${promo.id})`);

    return promo.id;
  } catch (error) {
    console.error('❌ Failed to fetch promos:', error.message);
    return null;
  }
}

async function step5_AssignTeacher(moduleIds, promoId) {
  console.log('\n📝 STEP 5: Assign Teacher to Modules');
  console.log('━'.repeat(50));

  if (!moduleIds || moduleIds.length === 0) {
    console.error('❌ No modules to assign');
    return false;
  }

  console.log(`   Assigning teacher ${teacherId} to modules: ${moduleIds.join(', ')}`);
  if (promoId) {
    console.log(`   With promo: ${promoId}`);
  }
  console.log(`   Academic year: 2024-2025`);

  try {
    const payload = {
      moduleIds,
      promoId: promoId || undefined,
      anneeUniversitaire: '2024-2025',
    };

    console.log('\n   Request payload:');
    console.log(JSON.stringify(payload, null, 2));

    const res = await request(
      'PUT',
      `/auth/admin/academic/assignments/teachers/${teacherId}`,
      payload,
      adminToken
    );

    console.log('\n   Response:');
    console.log(`   Status: ${res.status}`);
    console.log(`   Success: ${res.data.success}`);
    console.log(`   Data: ${JSON.stringify(res.data.data, null, 2)}`);

    if (!res.ok) {
      throw new Error(`Assignment failed: ${res.data.error?.message || JSON.stringify(res.data)}`);
    }

    console.log('✅ Teacher assignment successful');
    return true;
  } catch (error) {
    console.error('❌ Failed to assign teacher:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response, null, 2));
    }
    return false;
  }
}

async function step6_VerifyAssignment() {
  console.log('\n📝 STEP 6: Verify Assignment');
  console.log('━'.repeat(50));

  try {
    const res = await request('GET', `/enseignants/${teacherId}`, null, adminToken);

    if (!res.ok) {
      console.log('⚠️  Could not fetch teacher details (endpoint may not exist)');
      return;
    }

    const enseignant = res.data.data;
    console.log(`✅ Teacher record found:`);
    console.log(`   ID: ${enseignant.id}`);
    console.log(`   User ID: ${enseignant.userId}`);

    if (enseignant.enseignements && enseignant.enseignements.length > 0) {
      console.log(`   Assigned modules: ${enseignant.enseignements.length}`);
      enseignant.enseignements.forEach((e, i) => {
        console.log(
          `   ${i + 1}. Module ID: ${e.moduleId}, Promo: ${e.promoId || 'None'}, Year: ${e.anneeUniversitaire || 'None'}`
        );
      });
    } else {
      console.log('   ⚠️  No modules assigned');
    }
  } catch (error) {
    console.log('⚠️  Verification failed:', error.message);
  }
}

// ============================================
// Main Flow
// ============================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   TEACHER ASSIGNMENT DEBUG TEST SUITE             ║');
  console.log('║   Testing: Admin assigns teacher to modules        ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    // Step 1: Login as admin
    if (!(await step1_AdminLogin())) {
      throw new Error('Admin login failed');
    }

    await sleep(500);

    // Step 2: Get teachers
    if (!(await step2_GetTeachers())) {
      throw new Error('Failed to fetch teachers');
    }

    await sleep(500);

    // Step 3: Get modules
    const moduleIds = await step3_GetModules();
    if (!moduleIds || moduleIds.length === 0) {
      throw new Error('No modules available');
    }

    await sleep(500);

    // Step 4: Get promos
    const promoId = await step4_GetPromos();

    await sleep(500);

    // Step 5: Assign teacher
    if (!(await step5_AssignTeacher(moduleIds, promoId))) {
      throw new Error('Teacher assignment failed');
    }

    await sleep(500);

    // Step 6: Verify
    await step6_VerifyAssignment();

    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   ✅ TEST COMPLETED                              ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
  } catch (error) {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   ❌ TEST FAILED                                 ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    console.error('\nError:', error.message);
    console.log('');
    process.exit(1);
  }
}

main();
