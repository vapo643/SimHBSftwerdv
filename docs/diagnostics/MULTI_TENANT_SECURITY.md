# Multi-Tenant Security Implementation

## 📋 Overview

This document outlines the comprehensive Row Level Security (RLS) implementation for the Simpix Credit Management System. The security model ensures complete data isolation between different partners (parceiros) and their stores (lojas).

## 🏗️ Architecture

### Hierarchy Structure

```
Parceiros (Partners)
  └── Lojas (Stores)
    └── Users (Authenticated Users)
      └── Business Data (Proposals, Products, etc.)
```

### Security Key: `loja_id`

Every sensitive data table contains a `loja_id` foreign key that serves as the multi-tenant isolation boundary.

## 📊 Database Schema Changes

### New Tables Added

```sql
-- Partners table
CREATE TABLE parceiros (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  endereco TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stores table
CREATE TABLE lojas (
  id SERIAL PRIMARY KEY,
  parceiro_id INTEGER REFERENCES parceiros(id) NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  telefone TEXT NOT NULL,
  gerente TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Commercial tables
CREATE TABLE tabelas_comerciais (
  id SERIAL PRIMARY KEY,
  loja_id INTEGER REFERENCES lojas(id) NOT NULL,
  nome TEXT NOT NULL,
  taxa_juros DECIMAL(5,2) NOT NULL,
  taxa_iof DECIMAL(5,2) NOT NULL DEFAULT 0.38,
  taxa_tac DECIMAL(15,2) NOT NULL,
  -- Additional fields...
);

-- Products table
CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  loja_id INTEGER REFERENCES lojas(id) NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  -- Additional fields...
);

-- Communication logs
CREATE TABLE comunicacao_logs (
  id SERIAL PRIMARY KEY,
  proposta_id INTEGER REFERENCES propostas(id) NOT NULL,
  loja_id INTEGER REFERENCES lojas(id) NOT NULL,
  tipo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  -- Additional fields...
);
```

### Modified Tables

```sql
-- Users now belong to a specific store
ALTER TABLE users ADD COLUMN loja_id INTEGER REFERENCES lojas(id) NOT NULL;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Proposals are isolated by store
ALTER TABLE propostas ADD COLUMN loja_id INTEGER REFERENCES lojas(id) NOT NULL;
```

## 🔒 Row Level Security Policies

### Core Security Function

```sql
CREATE OR REPLACE FUNCTION get_current_user_loja_id()
RETURNS INTEGER AS $$
DECLARE
  user_email TEXT;
  user_loja_id INTEGER;
BEGIN
  user_email := (auth.jwt() ->> 'email');

  IF user_email IS NULL THEN
    user_email := (current_setting('app.current_user_email', true));
  END IF;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN -1;
  END IF;

  SELECT loja_id INTO user_loja_id
  FROM users
  WHERE email = user_email
  LIMIT 1;

  RETURN COALESCE(user_loja_id, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Applied Policies

#### 1. Users Table

- **SELECT**: Users can only view users from their own store
- **INSERT**: Store admins can create users for their store
- **UPDATE**: Users can update users from their own store
- **DELETE**: Disabled (soft delete at application level)

#### 2. Proposals Table

- **SELECT**: Users can only view proposals from their own store
- **INSERT**: Users can create proposals for their own store
- **UPDATE**: Users can update proposals from their own store
- **DELETE**: Disabled (soft delete at application level)

#### 3. Commercial Tables

- **SELECT/INSERT/UPDATE/DELETE**: Full CRUD access restricted to own store

#### 4. Products Table

- **SELECT/INSERT/UPDATE/DELETE**: Full CRUD access restricted to own store

#### 5. Communication Logs

- **SELECT/INSERT**: Read and create access restricted to own store
- **UPDATE/DELETE**: Disabled (immutable audit trail)

#### 6. Partners & Stores

- **SELECT**: Users can view their own partner/store information
- **INSERT**: Controlled at application layer
- **UPDATE**: Limited updates to own data
- **DELETE**: Disabled

## 🛠️ Implementation Files

### 1. Database Migration

**File**: `drizzle/migrations/0001_multi_tenant_rls.sql`

- Contains all RLS policy definitions
- Enables RLS on all sensitive tables
- Creates security functions and triggers
- Adds performance indexes

### 2. Schema Updates

**File**: `shared/schema.ts`

- Added new table definitions
- Updated existing tables with `loja_id` columns
- Created comprehensive Zod validation schemas
- Added TypeScript types for all new entities

### 3. Security Middleware

**File**: `server/middleware/multi-tenant.ts`

- Establishes database session context
- Sets user's `loja_id` for RLS enforcement
- Validates resource access permissions
- Enhances request with complete user context

### 4. Database Setup Scripts

**File**: `server/lib/database-setup.sql`

- Supabase-specific RLS functions
- Sample data for testing
- Verification queries
- Permission grants for authenticated users

## 🚀 Integration Guide

### 1. Apply Database Changes

```bash
# Run the migration
npm run db:push

# Or execute the SQL files directly in your database
psql -d your_database -f drizzle/migrations/0001_multi_tenant_rls.sql
psql -d your_database -f server/lib/database-setup.sql
```

### 2. Update Authentication Flow

```typescript
// Replace existing authMiddleware with enhanced version
import { authMiddleware } from './lib/auth';
import { multiTenantMiddleware } from './middleware/multi-tenant';

// Apply both middlewares
app.use('/api/protected', authMiddleware, multiTenantMiddleware);
```

### 3. Update API Routes

```typescript
// All database queries are now automatically filtered by loja_id
// No code changes needed - RLS handles isolation automatically

// Optional: Add extra validation for critical operations
import { validateResourceAccess } from './middleware/multi-tenant';

app.put('/api/proposals/:id', async (req: MultiTenantRequest, res) => {
  const proposal = await getProposal(req.params.id);
  validateResourceAccess(req.user!.lojaId, proposal.lojaId, 'proposal');
  // Continue with update...
});
```

## 🔍 Security Verification

### Test Data Isolation

```sql
-- As user from loja_id = 1
SELECT count(*) FROM propostas; -- Should only see proposals from loja 1

-- As user from loja_id = 2
SELECT count(*) FROM propostas; -- Should only see proposals from loja 2
```

### Monitor RLS Status

```sql
SELECT * FROM rls_security_audit;
```

### Performance Check

```sql
-- Verify indexes are being used
EXPLAIN SELECT * FROM propostas WHERE loja_id = 1;
```

## ⚠️ Security Considerations

1. **JWT Token Integration**: User's `loja_id` must be available during authentication
2. **Bypass Access**: System operations use `simpix_system` role with RLS disabled
3. **Audit Trail**: Communication logs are immutable for compliance
4. **Performance**: All `loja_id` columns are indexed for optimal RLS performance
5. **Validation**: Additional triggers prevent cross-store data corruption

## 📈 Next Steps

1. **Deploy Migration**: Apply the RLS policies to your database
2. **Update Authentication**: Integrate the new middleware in your routes
3. **Test Isolation**: Verify data separation with different user accounts
4. **Monitor Performance**: Check query performance with RLS enabled
5. **Audit Policies**: Regularly review security policies for completeness

## 🛡️ Compliance Features

- **LGPD Compliance**: Complete data isolation between business entities
- **Audit Trail**: Immutable communication logs for regulatory requirements
- **Access Control**: Granular permissions based on business hierarchy
- **Data Integrity**: Prevents accidental cross-contamination of sensitive data

This implementation provides enterprise-grade multi-tenant security while maintaining application performance and developer experience.
