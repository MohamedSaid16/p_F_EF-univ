#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:5000';

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
  console.log('🔔 NOTIFICATION SYSTEM TEST\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Login as admin
    console.log('\n📍 Step 1: Login as admin');
    const adminLogin = await makeRequest('POST', '/api/v1/auth/login', {
      email: 'admin@univ-tiaret.dz',
      password: 'Test@1234'
    });
    if (!adminLogin.data.data?.accessToken) {
      console.error('❌ Failed to login as admin');
      console.log('Response:', JSON.stringify(adminLogin, null, 2));
      return;
    }
    const adminToken = adminLogin.data.data.accessToken;
    const adminId = adminLogin.data.data.user?.id;
    console.log(`✅ Admin logged in (ID: ${adminId})`);

    // Step 2: Get current notifications for admin
    console.log('\n📍 Step 2: Get admin notifications');
    const adminNotifBefore = await makeRequest('GET', '/api/v1/notifications?limit=100', null, adminToken);
    console.log(`Status: ${adminNotifBefore.status}`);
    const adminNotifCountBefore = adminNotifBefore.data.data?.length || 0;
    console.log(`Admin notifications before: ${adminNotifCountBefore}`);
    if (adminNotifBefore.data.data?.length > 0) {
      console.log('  Sample:', adminNotifBefore.data.data[0]);
    }

    // Step 3: Login as student
    console.log('\n📍 Step 3: Login as student');
    const studentLogin = await makeRequest('POST', '/api/v1/auth/login', {
      email: 'student@univ-tiaret.dz',
      password: 'Test@1234'
    });
    const studentToken = studentLogin.data.data.accessToken;
    const studentId = studentLogin.data.data.user?.id;
    console.log(`✅ Student logged in (ID: ${studentId})`);

    // Step 4: Create a reclamation as student
    console.log('\n📍 Step 4: Create reclamation as student');
    const createRec = await makeRequest('POST', '/api/v1/requests/reclamations', {
      typeId: null,
      typeName: 'Grade Error',
      objet: 'Test Notification Reclamation',
      description: 'This is to test if notifications are created',
      priorite: 'normale'
    }, studentToken);
    console.log(`Status: ${createRec.status}`);
    const reclamationId = createRec.data.data?.id;
    console.log(`✅ Reclamation created (ID: ${reclamationId})`);

    // Step 5: Get student notifications
    console.log('\n📍 Step 5: Get student notifications');
    const studentNotif = await makeRequest('GET', '/api/v1/notifications?limit=100', null, studentToken);
    const studentNotifCount = studentNotif.data.data?.length || 0;
    console.log(`Student notifications: ${studentNotifCount}`);

    // Step 6: Admin approves the reclamation
    console.log('\n📍 Step 6: Admin approves reclamation');
    const approveRec = await makeRequest('POST', `/api/v1/requests/admin/reclamations/${reclamationId}/decision`, {
      action: 'approve',
      responseText: 'Your complaint is valid. We will review it.'
    }, adminToken);
    console.log(`Status: ${approveRec.status}`);
    if (approveRec.status === 200) {
      console.log(`✅ Reclamation approved`);
    } else {
      console.log(`Response:`, approveRec.data);
    }

    // Step 7: Check if student received a notification
    console.log('\n📍 Step 7: Check student notifications after approval');
    const studentNotifAfter = await makeRequest('GET', '/api/v1/notifications?limit=100', null, studentToken);
    const studentNotifCountAfter = studentNotifAfter.data.data?.length || 0;
    console.log(`Student notifications after: ${studentNotifCountAfter}`);
    
    if (studentNotifCountAfter > studentNotifCount) {
      console.log(`✅ NEW NOTIFICATION RECEIVED!`);
      const newNotif = studentNotifAfter.data.data[0];
      console.log(`   Type: ${newNotif.type}`);
      console.log(`   Title: ${newNotif.title}`);
      console.log(`   Message: ${newNotif.message}`);
      console.log(`   Read: ${newNotif.read}`);
    } else {
      console.log(`❌ NO NEW NOTIFICATION - ISSUE FOUND!`);
      console.log('   Notifications:', studentNotifAfter.data.data);
    }

    // Step 8: Check unread count
    console.log('\n📍 Step 8: Check unread notification count');
    const unreadCount = await makeRequest('GET', '/api/v1/notifications/unread-count', null, studentToken);
    console.log(`Status: ${unreadCount.status}`);
    console.log(`Unread count: ${unreadCount.data.data?.unreadCount}`);

    // Step 9: Mark notification as read
    if (studentNotifCountAfter > studentNotifCount) {
      console.log('\n📍 Step 9: Mark notification as read');
      const notifId = studentNotifAfter.data.data[0].id;
      const markRead = await makeRequest('PUT', `/api/v1/notifications/${notifId}/read`, {}, studentToken);
      console.log(`Status: ${markRead.status}`);
      if (markRead.status === 200) {
        console.log(`✅ Notification marked as read`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ NOTIFICATION TEST COMPLETE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
