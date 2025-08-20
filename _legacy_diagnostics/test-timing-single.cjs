#!/usr/bin/env node

/**
 * Single timing test to check if middleware is working
 */

const http = require('http');

async function testSingleRequest(url, description) {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhNjVlZmM1NC05MGNkLTRiOTQtYjk3MS1jOGE1NjAxMDQwMzIiLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTczODMwMzI3MSwiZXhwIjoxNzM4OTA4MDcxfQ.d6VFusQlYnV3shZlpBjcYbD2vdTqgJCT5ZDXU-LUdAM',
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1_000_000;
        
        resolve({
          description,
          responseTime,
          statusCode: res.statusCode,
          data: data.substring(0, 100) // First 100 chars only
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runTest() {
  console.log('🧪 SINGLE TIMING TEST');
  console.log('===================');
  
  try {
    // Test valid ID
    const validResult = await testSingleRequest(
      'http://localhost:5000/api/propostas/formal-test-001',
      'Valid Proposta ID'
    );
    
    console.log(`✅ ${validResult.description}:`);
    console.log(`   Status: ${validResult.statusCode}`);
    console.log(`   Time: ${validResult.responseTime.toFixed(2)}ms`);
    console.log(`   Response: ${validResult.data}...`);
    console.log('');
    
    // Wait a bit to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test invalid ID  
    const invalidResult = await testSingleRequest(
      'http://localhost:5000/api/propostas/invalid-test-999', 
      'Invalid Proposta ID'
    );
    
    console.log(`✅ ${invalidResult.description}:`);
    console.log(`   Status: ${invalidResult.statusCode}`);
    console.log(`   Time: ${invalidResult.responseTime.toFixed(2)}ms`);
    console.log(`   Response: ${invalidResult.data}...`);
    console.log('');
    
    const difference = Math.abs(validResult.responseTime - invalidResult.responseTime);
    console.log('📊 ANALYSIS:');
    console.log(`   Timing Difference: ${difference.toFixed(2)}ms`);
    console.log(`   Expected: Both responses around 25ms ± 5ms`);
    console.log(`   Actual Valid: ${validResult.responseTime.toFixed(2)}ms`);
    console.log(`   Actual Invalid: ${invalidResult.responseTime.toFixed(2)}ms`);
    
    if (validResult.responseTime > 20 && invalidResult.responseTime > 20) {
      console.log('✅ Timing normalization appears to be working');
    } else {
      console.log('❌ Timing normalization may not be working');
      console.log('   Check server logs for middleware execution');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest();