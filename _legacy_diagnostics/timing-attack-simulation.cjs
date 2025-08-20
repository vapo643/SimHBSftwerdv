#!/usr/bin/env node

/**
 * TIMING ATTACK SIMULATION SCRIPT
 * 
 * This script simulates a timing attack against the protected endpoint
 * GET /api/propostas/:id to validate that our TimingNormalizer middleware
 * is effectively preventing timing-based enumeration attacks.
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:5000';
const VALID_ID = 'formal-test-001'; // Known valid proposal ID
const INVALID_ID = '9999999999999'; // Known invalid proposal ID
const ITERATIONS = 100;
const JWT_TOKEN = process.env.JWT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhNjVlZmM1NC05MGNkLTRiOTQtYjk3MS1jOGE1NjAxMDQwMzIiLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoiQURNSU5JU1RSQURPUiIsImlhdCI6MTczODMwMzI3MSwiZXhwIjoxNzM4OTA4MDcxfQ.d6VFusQlYnV3shZlpBjcYbD2vdTqgJCT5ZDXU-LUdAM';

console.log('🎯 TIMING ATTACK SIMULATION');
console.log('==========================');
console.log(`Valid ID: ${VALID_ID}`);
console.log(`Invalid ID: ${INVALID_ID}`);
console.log(`Iterations: ${ITERATIONS}`);
console.log('');

/**
 * Make HTTP request and measure response time
 */
function makeTimedRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        resolve({
          responseTime,
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Run timing attack simulation
 */
async function runSimulation() {
  console.log('🔍 Starting timing attack simulation...');
  console.log('');
  
  const validTimes = [];
  const invalidTimes = [];
  
  // Test valid IDs
  console.log(`📊 Testing VALID ID (${VALID_ID}):`);
  process.stdout.write('Progress: ');
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await makeTimedRequest(`${BASE_URL}/api/propostas/${VALID_ID}`);
      validTimes.push(result.responseTime);
      
      if (i % 10 === 0) process.stdout.write('█');
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`\nError on valid ID iteration ${i}:`, error.message);
    }
  }
  
  console.log(`\nCompleted: ${validTimes.length}/${ITERATIONS} requests`);
  console.log('');
  
  // Test invalid IDs
  console.log(`📊 Testing INVALID ID (${INVALID_ID}):`);
  process.stdout.write('Progress: ');
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await makeTimedRequest(`${BASE_URL}/api/propostas/${INVALID_ID}`);
      invalidTimes.push(result.responseTime);
      
      if (i % 10 === 0) process.stdout.write('█');
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`\nError on invalid ID iteration ${i}:`, error.message);
    }
  }
  
  console.log(`\nCompleted: ${invalidTimes.length}/${ITERATIONS} requests`);
  console.log('');
  
  // Statistical Analysis
  console.log('📈 STATISTICAL ANALYSIS');
  console.log('======================');
  
  if (validTimes.length === 0 || invalidTimes.length === 0) {
    console.error('❌ Not enough data points collected. Check authentication and server status.');
    return;
  }
  
  // Calculate statistics
  const validAvg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
  const invalidAvg = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length;
  const difference = Math.abs(validAvg - invalidAvg);
  
  const validMin = Math.min(...validTimes);
  const validMax = Math.max(...validTimes);
  const invalidMin = Math.min(...invalidTimes);
  const invalidMax = Math.max(...invalidTimes);
  
  // Standard deviation calculation
  const validStdDev = Math.sqrt(validTimes.reduce((sq, n) => sq + Math.pow(n - validAvg, 2), 0) / validTimes.length);
  const invalidStdDev = Math.sqrt(invalidTimes.reduce((sq, n) => sq + Math.pow(n - invalidAvg, 2), 0) / invalidTimes.length);
  
  console.log(`Valid ID Responses (${validTimes.length} samples):`);
  console.log(`  Average: ${validAvg.toFixed(2)}ms`);
  console.log(`  Min: ${validMin.toFixed(2)}ms`);
  console.log(`  Max: ${validMax.toFixed(2)}ms`);
  console.log(`  Std Dev: ${validStdDev.toFixed(2)}ms`);
  console.log('');
  
  console.log(`Invalid ID Responses (${invalidTimes.length} samples):`);
  console.log(`  Average: ${invalidAvg.toFixed(2)}ms`);
  console.log(`  Min: ${invalidMin.toFixed(2)}ms`);
  console.log(`  Max: ${invalidMax.toFixed(2)}ms`);
  console.log(`  Std Dev: ${invalidStdDev.toFixed(2)}ms`);
  console.log('');
  
  console.log('🎯 TIMING ATTACK ANALYSIS');
  console.log('========================');
  console.log(`Timing Difference: ${difference.toFixed(2)}ms`);
  console.log(`Expected Range: 15-30ms (20ms ± 10ms tolerance)`);
  console.log('');
  
  // Evaluation
  const isNormalized = validAvg >= 15 && validAvg <= 30 && invalidAvg >= 15 && invalidAvg <= 30;
  const isSecure = difference < 5; // Allow 5ms tolerance for network variance
  
  console.log('🔒 SECURITY EVALUATION');
  console.log('=====================');
  
  if (isNormalized && isSecure) {
    console.log('✅ TIMING ATTACK MITIGATION: SUCCESSFUL');
    console.log('   - Response times are normalized');
    console.log(`   - Timing difference (${difference.toFixed(2)}ms) is below attack threshold`);
    console.log('   - ID enumeration through timing is IMPOSSIBLE');
  } else {
    console.log('❌ TIMING ATTACK MITIGATION: FAILED');
    if (!isNormalized) {
      console.log('   - Response times are not in expected normalized range');
    }
    if (!isSecure) {
      console.log(`   - Timing difference (${difference.toFixed(2)}ms) allows enumeration attacks`);
    }
    console.log('   - Further investigation required');
  }
  
  console.log('');
  console.log('📊 DETAILED TIMING DISTRIBUTION');
  console.log('==============================');
  
  // Create simple histogram
  const createHistogram = (times, label) => {
    const buckets = {};
    times.forEach(time => {
      const bucket = Math.floor(time / 5) * 5; // 5ms buckets
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    
    console.log(`${label}:`);
    Object.keys(buckets).sort((a, b) => a - b).forEach(bucket => {
      const count = buckets[bucket];
      const bar = '█'.repeat(Math.ceil(count / 5));
      console.log(`  ${bucket}ms-${parseInt(bucket) + 4}ms: ${count} ${bar}`);
    });
    console.log('');
  };
  
  createHistogram(validTimes, 'Valid ID Distribution');
  createHistogram(invalidTimes, 'Invalid ID Distribution');
  
  console.log('🎯 CONCLUSION');
  console.log('============');
  if (isSecure) {
    console.log('The TimingNormalizer middleware is WORKING CORRECTLY.');
    console.log('Production deployment is APPROVED from timing attack perspective.');
  } else {
    console.log('The TimingNormalizer middleware needs ADJUSTMENT.');
    console.log('Review configuration and implementation before production deployment.');
  }
}

// Run the simulation
runSimulation().catch(console.error);