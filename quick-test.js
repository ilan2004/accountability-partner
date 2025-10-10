#!/usr/bin/env node

/**
 * Quick Testing Script for Accountability Partner System
 * 
 * This script helps you quickly test your deployed system's key endpoints
 * Run with: node quick-test.js
 */

const https = require('https');

const BASE_URL = 'https://accountability-hommj60kl-ilan-usmans-projects.vercel.app';

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AccountabilityTestScript/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testWebAppAccess() {
  console.log('\n🌐 Testing Web App Access...');
  try {
    const response = await makeRequest(BASE_URL);
    if (response.status === 200) {
      console.log('✅ Web app is accessible');
      return true;
    } else {
      console.log(`❌ Web app returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Web app access failed: ${error.message}`);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n🗄️ Testing Database Connection...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/test-db`);
    if (response.status === 200 && response.data.success) {
      console.log('✅ Database connection successful');
      console.log(`   Users: ${response.data.data?.counts?.users || 0}`);
      console.log(`   Tasks: ${response.data.data?.counts?.tasks || 0}`);
      console.log(`   Pairs: ${response.data.data?.counts?.pairs || 0}`);
      return true;
    } else {
      console.log(`❌ Database test failed: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Database test error: ${error.message}`);
    return false;
  }
}

async function testAuthPages() {
  console.log('\n🔐 Testing Auth Pages...');
  try {
    const signinResponse = await makeRequest(`${BASE_URL}/auth/signin`);
    if (signinResponse.status === 200) {
      console.log('✅ Signin page accessible');
    } else {
      console.log(`❌ Signin page returned status ${signinResponse.status}`);
      return false;
    }

    const callbackResponse = await makeRequest(`${BASE_URL}/auth/callback`);
    if (callbackResponse.status === 200) {
      console.log('✅ Auth callback page accessible');
    } else {
      console.log(`❌ Auth callback page returned status ${callbackResponse.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Auth pages test error: ${error.message}`);
    return false;
  }
}

async function testApiRoutes() {
  console.log('\n🛠️ Testing API Routes...');
  let passed = 0;
  let total = 0;

  const routes = [
    '/api/test-db',
  ];

  for (const route of routes) {
    total++;
    try {
      const response = await makeRequest(`${BASE_URL}${route}`);
      if (response.status === 200 || response.status === 401) { // 401 is expected for protected routes
        console.log(`✅ ${route} - Status: ${response.status}`);
        passed++;
      } else {
        console.log(`❌ ${route} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${route} - Error: ${error.message}`);
    }
  }

  console.log(`   API Routes: ${passed}/${total} accessible`);
  return passed === total;
}

// Main testing function
async function runTests() {
  console.log('🧪 Starting Accountability Partner System Tests...');
  console.log(`🎯 Testing URL: ${BASE_URL}`);
  
  const results = {
    webApp: await testWebAppAccess(),
    database: await testDatabaseConnection(),
    authPages: await testAuthPages(),
    apiRoutes: await testApiRoutes(),
  };

  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');
  console.log(`🌐 Web App Access:      ${results.webApp ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🗄️ Database Connection: ${results.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔐 Auth Pages:          ${results.authPages ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🛠️ API Routes:          ${results.apiRoutes ? '✅ PASS' : '❌ FAIL'}`);

  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\n🎯 OVERALL STATUS:');
  console.log(`   ${totalPassed}/${totalTests} test categories passed`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 ALL BASIC TESTS PASSED! Your system is responding correctly.');
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Open the web app in your browser for manual testing');
    console.log('   2. Test user signup/signin flows');
    console.log('   3. Check Railway logs for backend services');
    console.log('   4. Test Notion and WhatsApp integrations');
  } else {
    console.log('⚠️  Some tests failed. Check the details above.');
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   1. Check Vercel deployment logs');
    console.log('   2. Verify environment variables are set');
    console.log('   3. Ensure Supabase project is active');
  }
  
  console.log(`\n🌐 Manual Testing: ${BASE_URL}`);
  console.log('📖 Full Testing Guide: See TESTING_GUIDE.md');
}

// Run the tests
runTests().catch(console.error);
