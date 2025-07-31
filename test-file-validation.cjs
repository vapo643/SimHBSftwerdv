#!/usr/bin/env node

/**
 * Test file upload security validation
 * Tests magic number validation against spoofed MIME types
 */

const fs = require('fs');
const http = require('http');
const FormData = require('form-data');

async function testFileValidation() {
  console.log('🛡️  FILE UPLOAD SECURITY VALIDATION TEST');
  console.log('========================================');
  
  // Test cases: [filename, content, expectedResult]
  const testCases = [
    {
      name: 'Valid PDF',
      filename: 'test.pdf',
      content: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]), // %PDF-1.4
      mimeType: 'application/pdf',
      shouldPass: true
    },
    {
      name: 'Valid PNG',
      filename: 'test.png', 
      content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]), // PNG signature
      mimeType: 'image/png',
      shouldPass: true
    },
    {
      name: 'Valid JPEG',
      filename: 'test.jpg',
      content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]), // JPEG signature
      mimeType: 'image/jpeg', 
      shouldPass: true
    },
    {
      name: 'MALICIOUS: Executable disguised as PDF (MIME spoofing)',
      filename: 'malicious.pdf',
      content: Buffer.from([0x4D, 0x5A, 0x90, 0x00]), // PE executable signature (MZ)
      mimeType: 'application/pdf', // Spoofed MIME type
      shouldPass: false
    },
    {
      name: 'MALICIOUS: Script disguised as image',
      filename: 'script.png',
      content: Buffer.from('#!/bin/bash\nrm -rf /'), // Shell script content
      mimeType: 'image/png', // Spoofed MIME type
      shouldPass: false
    },
    {
      name: 'Invalid extension',
      filename: 'test.exe',
      content: Buffer.from([0x4D, 0x5A, 0x90, 0x00]),
      mimeType: 'application/octet-stream',
      shouldPass: false
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    try {
      const form = new FormData();
      form.append('file', testCase.content, {
        filename: testCase.filename,
        contentType: testCase.mimeType
      });
      form.append('proposalId', 'test-validation');

      const result = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 5000,
          path: '/api/test/file-validation', // Use test endpoint without auth
          method: 'POST',
          headers: {
            ...form.getHeaders()
            // No authorization header needed for test endpoint
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              body: data,
              headers: res.headers
            });
          });
        });

        req.on('error', reject);
        form.pipe(req);
      });

      const passed = result.statusCode === 200 || result.statusCode === 401; // 401 = auth failed (validation passed)
      const blocked = result.statusCode === 400; // 400 = validation failed (good!)
      
      let responseData;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }

      const testResult = {
        name: testCase.name,
        expected: testCase.shouldPass ? 'PASS' : 'BLOCK',
        actual: blocked ? 'BLOCKED' : 'PASSED',
        correct: testCase.shouldPass ? !blocked : blocked,
        statusCode: result.statusCode,
        message: responseData.message || 'No message',
        error: responseData.error || null
      };

      results.push(testResult);

      if (testResult.correct) {
        console.log(`  ✅ CORRECT: ${testResult.actual} (expected ${testResult.expected})`);
      } else {
        console.log(`  ❌ INCORRECT: ${testResult.actual} (expected ${testResult.expected})`);
        console.log(`     Status: ${testResult.statusCode}`);
        console.log(`     Message: ${testResult.message}`);
      }

    } catch (error) {
      console.log(`  🔥 ERROR: ${error.message}`);
      results.push({
        name: testCase.name,
        expected: testCase.shouldPass ? 'PASS' : 'BLOCK',
        actual: 'ERROR',
        correct: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n📊 VALIDATION TEST SUMMARY');
  console.log('==========================');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.correct).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Correct: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🏆 ALL TESTS PASSED - FILE VALIDATION SECURITY WORKING CORRECTLY!');
    console.log('🛡️  Magic number validation successfully prevents MIME type spoofing attacks');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - REVIEW FILE VALIDATION IMPLEMENTATION');
    
    console.log('\nFailed Tests:');
    results.filter(r => !r.correct).forEach(result => {
      console.log(`  - ${result.name}: Expected ${result.expected}, got ${result.actual}`);
    });
  }
}

testFileValidation().catch(console.error);