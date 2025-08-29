#!/bin/bash
# Test Commands - Simpix Project
# Uso: source scripts/test-commands.sh

alias test="npx vitest"
alias test:unit="npx vitest run tests/unit"
alias test:integration="npx vitest run tests/integration"
alias test:watch="npx vitest --watch"

echo "✅ Test aliases loaded:"
echo "  test              - Run all tests"
echo "  test:unit         - Run unit tests"
echo "  test:integration  - Run integration tests"
echo "  test:watch        - Run tests in watch mode"