#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('client/src/**/*.{ts,tsx}');

let totalFixed = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Replace common any patterns
  content = content.replace(/: any\b/g, ': unknown');
  content = content.replace(/<any>/g, '<unknown>');
  content = content.replace(/as any\b/g, 'as unknown');
  content = content.replace(/\(any\)/g, '(unknown)');
  content = content.replace(/Record<string, any>/g, 'Record<string, unknown>');
  content = content.replace(/\[\]: any/g, '[]: unknown');
  content = content.replace(/Promise<any>/g, 'Promise<unknown>');
  content = content.replace(/Array<any>/g, 'Array<unknown>');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    console.log(`✅ Fixed: ${filePath}`);
  }
});

console.log(`\n🎉 Total files fixed: ${totalFixed}`);
