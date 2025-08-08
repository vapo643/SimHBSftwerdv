#!/usr/bin/env node

/**
 * Remove Sensitive Comments Script - OWASP ASVS V14.3.2
 *
 * Removes TODO, FIXME, HACK, XXX, and other revealing comments
 * from production builds to prevent information disclosure.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Patterns to remove
const COMMENT_PATTERNS = [
  // Single line comments with sensitive keywords
  /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|DEPRECATED|NOTA|IMPORTANTE|SECURITY|DEBUG|TEMP|REMOVE|DELETE).*$/gim,
  // Multi-line comments with sensitive keywords
  /\/\*[\s\S]*?(TODO|FIXME|HACK|XXX|BUG|DEPRECATED|NOTA|IMPORTANTE|SECURITY|DEBUG|TEMP|REMOVE|DELETE)[\s\S]*?\*\//gim,
  // Console logs (should be removed in production)
  /console\.(log|debug|info|warn|error|trace)\(.*?\);?$/gim,
  // Debugger statements
  /debugger;?$/gim,
  // Alert statements
  /alert\(.*?\);?$/gim,
];

// Files to process
const FILE_PATTERNS = [
  "dist/**/*.js",
  "dist/**/*.jsx",
  "dist/**/*.ts",
  "dist/**/*.tsx",
  "build/**/*.js",
  "build/**/*.jsx",
];

// Files to exclude
const EXCLUDE_PATTERNS = ["**/node_modules/**", "**/vendor/**", "**/*.min.js", "**/*.map"];

/**
 * Remove comments from a file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    // Apply each pattern
    COMMENT_PATTERNS.forEach(pattern => {
      const newContent = content.replace(pattern, "");
      if (newContent !== content) {
        modified = true;
        content = newContent;
      }
    });

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✓ Cleaned: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log("🔍 Removing sensitive comments from production build...\n");

  let totalFiles = 0;
  let modifiedFiles = 0;

  // Process each file pattern
  FILE_PATTERNS.forEach(pattern => {
    const files = glob.sync(pattern, {
      ignore: EXCLUDE_PATTERNS,
      nodir: true,
    });

    files.forEach(file => {
      totalFiles++;
      if (processFile(file)) {
        modifiedFiles++;
      }
    });
  });

  // Summary
  console.log("\n📊 Summary:");
  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Files modified: ${modifiedFiles}`);
  console.log(`Files unchanged: ${totalFiles - modifiedFiles}`);

  if (modifiedFiles > 0) {
    console.log("\n⚠️  Warning: Sensitive comments were found and removed.");
    console.log("Please ensure no sensitive information remains in the build.");
  } else {
    console.log("\n✅ No sensitive comments found. Build is clean!");
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { processFile, COMMENT_PATTERNS };
