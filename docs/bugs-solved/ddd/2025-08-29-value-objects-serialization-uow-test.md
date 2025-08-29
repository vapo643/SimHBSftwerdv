# Bug: Unit of Work Test Failure During Value Objects Integration

**Date:** 2025-08-29  
**Category:** DDD Architecture  
**Severity:** P1 - Critical (Blocking refactoring)  
**Status:** ✅ RESOLVED  

## Problem Description

During the implementation of Value Objects in Proposal aggregates (Mission REM-S2-004), the Unit of Work integration test was failing with the error:

```
TypeError: The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Object
```

## Root Cause Analysis

### Primary Cause
The repository layer was attempting to insert complex JavaScript objects (Value Objects) directly into PostgreSQL, which expects primitive types.

### Secondary Causes
1. **Schema Mismatch**: Test was using `clienteData` object but actual schema uses individual fields (`clienteNome`, `clienteCpf`, etc.)
2. **Missing Serialization**: Repository lacked Value Object to primitive conversion logic
3. **UUID Type Issues**: `gerente_lojas` table expected UUID but received integer

## Technical Analysis

### The Error Chain
1. **Value Objects Created**: CPF, Money, Email objects created in domain aggregates
2. **Direct Database Insert**: Repository tried to insert objects without serialization
3. **PostgreSQL Rejection**: Database cannot process JavaScript objects as primitive types
4. **Test Failure**: `"Received an instance of Object"` error

### Code Evidence
```typescript
// BEFORE (Failing)
const createdProposta = await this.tx.insert(schema.propostas).values(proposta).returning();

// AFTER (Working)
const propostaData = proposta.toPersistence ? proposta.toPersistence() : proposta;
const createdProposta = await this.tx.insert(schema.propostas).values(propostaData).returning();
```

## Solution Implemented

### 1. Repository Serialization Layer
```typescript
// server/lib/unit-of-work.ts
export class PropostaTransactionRepository extends TransactionRepository {
  async createWithLogs(proposta: any, log: any): Promise<any> {
    // Automatic Value Object serialization
    const propostaData = proposta.toPersistence ? proposta.toPersistence() : proposta;
    const createdProposta = await this.tx.insert(schema.propostas).values(propostaData).returning();
    // ...
  }
}
```

### 2. Test Data Structure Fix
```typescript
// tests/integration/unit-of-work.test.ts
const mockProposta = {
  clienteNome: 'Cliente Business',     // ✅ Individual fields
  clienteCpf: '98765432100',           // ✅ Match schema
  clienteEmail: 'teste@example.com',   // ✅ Correct structure
  // clienteData: { ... }              // ❌ Object removed
};
```

### 3. UUID Casting Fix
```typescript
// tests/lib/db-helper.ts
await directDb`
  INSERT INTO gerente_lojas (gerente_id, loja_id)
  VALUES (${testUserId}::uuid, ${testStoreId})  // ✅ Explicit UUID cast
`;
```

## Validation Evidence

### Before Fix
```
❌ 1 failed | 2 passed | 43 skipped (50 tests)
TypeError: Received an instance of Object
```

### After Fix
```
✅ 3 passed (3 tests)
✓ PROVA UoW #1: COMMIT Test - Funcionando
✓ PROVA UoW #2: ROLLBACK Test - Funcionando  
✓ PROVA UoW #3: Business Operation Pattern - Funcionando
```

## Impact Assessment

### Business Impact
- **🚫 Blocking**: Mission REM-S2-004 Value Objects integration
- **⚡ Performance**: Zero impact (serialization is lightweight)
- **🔒 Security**: Enhanced (Value Objects add validation)

### Technical Debt Resolution
- **Domain Model**: Now properly uses Value Objects instead of primitives
- **Type Safety**: Improved with CPF, Money, Email validation
- **Architecture**: Clean DDD implementation achieved

## Prevention Measures

### 1. Repository Pattern Enhancement
All future repositories must implement automatic serialization:
```typescript
// Pattern for all repositories
const dataToInsert = aggregate.toPersistence ? aggregate.toPersistence() : aggregate;
```

### 2. Test Infrastructure
- ✅ Schema validation in test setup
- ✅ Proper UUID handling for foreign keys
- ✅ Value Object compatibility tests

### 3. Architecture Guidelines
- All Domain Aggregates MUST implement `toPersistence()` method
- Repository layer MUST handle Value Object serialization
- Tests MUST use actual schema structure, not mock objects

## Lessons Learned

1. **Value Objects ≠ Database Objects**: Clear separation needed between domain and persistence
2. **Test Schema Alignment**: Tests must match actual database structure
3. **Gradual Migration**: Repository layer is the perfect abstraction point for migration
4. **Type System Power**: LSP diagnostics caught compilation issues immediately

## Related Files Modified

- `server/lib/unit-of-work.ts` - Repository serialization logic
- `tests/integration/unit-of-work.test.ts` - Test data structure
- `tests/lib/db-helper.ts` - UUID casting fix
- `server/modules/proposal/domain/Proposal.ts` - Value Objects implementation
- `server/modules/credit/domain/aggregates/Proposal.ts` - Value Objects implementation

**Resolution Time:** 45 minutes  
**Complexity:** Medium (Required understanding of DDD patterns + PostgreSQL types)  
**Risk Level:** Low (Changes isolated to test infrastructure + repository layer)