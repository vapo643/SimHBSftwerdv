#!/bin/bash

echo "🚀 Starting complete ESLint cleanup..."

# Fix all auto-fixable issues
echo "📝 Running ESLint auto-fix..."
npx eslint client/src --ext .ts,.tsx,.js,.jsx --fix

# Count remaining issues
ERRORS=$(npx eslint client/src --ext .ts,.tsx,.js,.jsx 2>&1 | grep -E "error" | wc -l)
WARNINGS=$(npx eslint client/src --ext .ts,.tsx,.js,.jsx 2>&1 | grep -E "warning" | wc -l)

echo "📊 Remaining issues after auto-fix:"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"

# Generate report
echo "📋 Generating detailed report..."
npx eslint client/src --ext .ts,.tsx,.js,.jsx --format compact > error_docs/eslint-report.txt 2>&1

echo "✅ Complete! Check error_docs/eslint-report.txt for details"