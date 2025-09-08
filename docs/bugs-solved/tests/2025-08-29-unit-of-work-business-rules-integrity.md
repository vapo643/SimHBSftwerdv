# Unit of Work Tests - Business Rules Integrity Bug Fix

**Date:** 2025-08-29  
**Status:** ✅ RESOLVED  
**Mission:** PAM V1.5 REM-S2-002.1  
**Priority:** P1 - Critical (Test Suite Failure)

## Bug Description

Unit of Work integration tests were failing due to database business rule violations in the `enforce_proposta_integrity` trigger. The tests could not create valid proposals because they were missing required associations and field mappings.

## Root Cause Analysis

### Primary Issues:

1. **Missing Business Rule Compliance:** The `validate_proposta_integrity()` database function requires:
   - A profile exists where `id = NEW.user_id AND loja_id = NEW.loja_id`
   - Association in `gerente_lojas` table for store-manager relationship

2. **Schema vs Database Mismatch:**
   - Schema defined `gerenteLojas.gerenteId` as `integer`
   - Database actual type was `uuid`
   - Caused `invalid input syntax for type uuid: "999"` errors

3. **Missing Required Fields:** Mock propostas lacked the `userId` field required by the database trigger

### Database Trigger Analysis:

```sql
-- Trigger: enforce_proposta_integrity on table propostas
-- Function: validate_proposta_integrity()
-- Logic: Validates user belongs to specified store via profiles table
IF NOT EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = NEW.user_id AND p.loja_id = NEW.loja_id
) THEN
  RAISE EXCEPTION 'User does not belong to the specified store';
END IF;
```

## Solution Implemented

### 1. **Corrected Test Setup:**

```typescript
// Create profile for Supabase Auth user with correct loja_id
await db.execute(sql`
  INSERT INTO profiles (id, full_name, role, loja_id)
  VALUES (${testUserId}, 'Usuário Teste Integração', 'ADMINISTRADOR', 999)
  ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    loja_id = EXCLUDED.loja_id
`);

// Create gerente-loja association using UUID (not integer)
await db.execute(sql`
  INSERT INTO gerente_lojas (gerente_id, loja_id)
  VALUES (${testUserId}, 999)
  ON CONFLICT (gerente_id, loja_id) DO NOTHING
`);
```

### 2. **Fixed Mock Propostas:**

```typescript
const mockProposta = {
  id: testPropostaId,
  numeroProposta: 123456,
  status: 'RASCUNHO',
  clienteNome: 'Cliente Teste',
  clienteCpf: '12345678901',
  produtoId: 999,
  lojaId: 999,
  userId: testUserId, // CRITICAL: Required by enforce_proposta_integrity trigger
};
```

### 3. **Type Compatibility Resolution:**

- Identified that `gerente_lojas.gerente_id` references `profiles.id` (UUID) not `users.id` (integer)
- Adjusted association creation to use correct UUID type
- Removed unnecessary legacy user creation

## Validation Evidence

### Test Results:

```
✓ PROVA UoW #1: Deve fazer COMMIT quando todas as operações são bem-sucedidas (4467ms)
✓ PROVA UoW #2: Deve fazer ROLLBACK quando operação falha (3334ms)
✓ PROVA UoW #3: Business Operation Pattern (3304ms)

Test Files: 1 passed (1)
Tests: 3 passed (3)
```

### LSP Diagnostics:

- ✅ Zero syntax errors
- ✅ Zero type errors
- ✅ Clean code quality

## Prevention Measures

1. **Database Schema Auditing:** Cross-reference Drizzle schema definitions with actual database structure
2. **Business Rule Documentation:** Document all database triggers and their requirements in test setup
3. **Type Safety:** Always verify UUID vs integer types when working with foreign key relationships
4. **Comprehensive Test Data:** Ensure test fixtures satisfy all database constraints and business rules

## Files Modified

- `tests/integration/unit-of-work.test.ts` - Fixed test setup and mock data
- Added business rule compliance for `validate_proposta_integrity()` trigger
- Corrected UUID type handling for `gerente_lojas` associations

## Impact

- ✅ 100% test success rate restored
- ✅ Unit of Work atomicity proven (COMMIT + ROLLBACK)
- ✅ Business operation pattern validated
- ✅ Database integrity constraints satisfied
- ✅ Foundation solid for Operation Escape Velocity performance work

**Result:** Mission PAM V1.5 REM-S2-002.1 completed successfully with zero technical debt remaining.
