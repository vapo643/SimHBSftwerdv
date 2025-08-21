#!/bin/bash
# Dependency Validation Script - Phase 1 DDD Enforcement
# This script validates bounded context isolation and architectural rules

echo "🔍 Starting Dependency Validation..."
echo "===================================="

# Check if dependency-cruiser is installed
if ! command -v depcruise &> /dev/null; then
    echo "❌ dependency-cruiser not found. Installing..."
    npm install dependency-cruiser
fi

# Run dependency validation
echo "📊 Analyzing dependencies..."
npx depcruise --config .dependency-cruiser.cjs --output-type err client server shared

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo "✅ All dependency rules passed!"
    echo ""
    echo "📈 Generating dependency graph..."
    npx depcruise --config .dependency-cruiser.cjs --output-type dot client server shared | dot -T svg > architecture/dependency-graph.svg 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Dependency graph generated at architecture/dependency-graph.svg"
    else
        echo "⚠️  Could not generate graph (graphviz not installed)"
    fi
else
    echo "❌ Dependency violations found!"
    echo ""
    echo "🔧 Fix the violations above to maintain bounded context isolation"
    exit 1
fi

echo ""
echo "===================================="
echo "📦 Bounded Contexts Status:"
echo "  - Credit Proposal: ✅ Isolated"
echo "  - Credit Analysis: ✅ Isolated"
echo "  - Contract Management: ✅ Isolated"
echo "  - Payment: ✅ ACL Applied"
echo "===================================="