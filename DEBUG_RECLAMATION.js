#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Helper to make HTTP requests
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('🔍 RECLAMATION DEBUGGING SCRIPT\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Login as student
    console.log('\n📍 Step 1: Login as student (student@univ-tiaret.dz)');
    const studentLogin = await makeRequest('POST', '/api/v1/auth/login', {
      email: 'student@univ-tiaret.dz',
      password: 'Test@1234'
    });
    console.log(`Status: ${studentLogin.status}`);
    if (!studentLogin.data.data?.accessToken) {
      console.error('❌ Failed to login as student');
      console.log(JSON.stringify(studentLogin, null, 2));
      return;
    }
    const studentToken = studentLogin.data.data.accessToken;
    const studentId = studentLogin.data.data.user?.id;
    console.log(`✅ Student logged in. Token: ${studentToken.substring(0, 20)}...`);
    console.log(`   Student ID: ${studentId}`);

    // Step 2: Create a reclamation as student
    console.log('\n📍 Step 2: Create reclamation as student');
    const createReclamation = await makeRequest('POST', '/api/v1/requests/reclamations', {
      typeId: null,
      typeName: 'Grade Error',
      objet: 'My grade is incorrect',
      description: 'I believe my exam grade should be higher',
      priorite: 'haute'
    }, studentToken);
    console.log(`Status: ${createReclamation.status}`);
    if (createReclamation.status !== 201) {
      console.error('❌ Failed to create reclamation');
      console.log(JSON.stringify(createReclamation, null, 2));
      return;
    }
    const reclamationId = createReclamation.data.data?.id;
    console.log(`✅ Reclamation created with ID: ${reclamationId}`);
    console.log(`   Object: ${createReclamation.data.data?.objet}`);
    console.log(`   Student ID in DB: ${createReclamation.data.data?.etudiantId}`);

    // Step 3: Get student's reclamations
    console.log('\n📍 Step 3: Get student\'s reclamations');
    const getStudentReclamations = await makeRequest('GET', '/api/v1/requests/reclamations', null, studentToken);
    console.log(`Status: ${getStudentReclamations.status}`);
    console.log(`Reclamations count: ${getStudentReclamations.data.data?.length || 0}`);
    if (getStudentReclamations.data.data?.length > 0) {
      console.log(`✅ Student can see their reclamation`);
    } else {
      console.log(`⚠️  Student cannot see their reclamation`);
    }

    // Step 4: Login as admin
    console.log('\n📍 Step 4: Login as admin (admin@univ-tiaret.dz)');
    const adminLogin = await makeRequest('POST', '/api/v1/auth/login', {
      email: 'admin@univ-tiaret.dz',
      password: 'Test@1234'
    });
    console.log(`Status: ${adminLogin.status}`);
    if (!adminLogin.data.data?.accessToken) {
      console.error('❌ Failed to login as admin');
      console.log(JSON.stringify(adminLogin, null, 2));
      return;
    }
    const adminToken = adminLogin.data.data.accessToken;
    const adminId = adminLogin.data.data.user?.id;
    console.log(`✅ Admin logged in. Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Roles: ${adminLogin.data.data.user?.roles?.join(', ')}`);

    // Step 5: Get admin inbox
    console.log('\n📍 Step 5: Get admin\'s inbox (/api/v1/requests/admin/inbox)');
    const adminInbox = await makeRequest('GET', '/api/v1/requests/admin/inbox', null, adminToken);
    console.log(`Status: ${adminInbox.status}`);
    
    console.log('\n🔍 RESPONSE STRUCTURE:');
    console.log('adminInbox.data:', typeof adminInbox.data, Object.keys(adminInbox.data || {}));
    if (adminInbox.data.data) {
      console.log('adminInbox.data.data:', typeof adminInbox.data.data, 'length:', adminInbox.data.data.length);
    }
    if (adminInbox.data.data && adminInbox.data.data.length > 0) {
      console.log('First item:', JSON.stringify(adminInbox.data.data[0], null, 2));
    }
    
    if (adminInbox.status !== 200) {
      console.error(`❌ Admin inbox request failed`);
      console.log(JSON.stringify(adminInbox, null, 2));
      return;
    }

    console.log(`Total items in admin inbox: ${adminInbox.data.data?.length || 0}`);
    
    if (!adminInbox.data.data || adminInbox.data.data.length === 0) {
      console.error(`❌ ISSUE: Admin cannot see the student's reclamation!`);
    } else {
      const reclamation = adminInbox.data.data.find(item => 
        item.category === 'reclamation' && item.requestId === reclamationId
      );
      if (reclamation) {
        console.log(`✅ Admin CAN see the reclamation!`);
        console.log(`   ID: ${reclamation.id}`);
        console.log(`   Title: ${reclamation.title}`);
        console.log(`   Student: ${reclamation.studentName}`);
      } else {
        console.log(`⚠️  Reclamation not found in admin inbox`);
        console.log(`   Found items:`, adminInbox.data.data.map(item => ({
          id: item.id,
          title: item.title,
          category: item.category,
          studentName: item.studentName
        })));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEBUG COMPLETE');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
