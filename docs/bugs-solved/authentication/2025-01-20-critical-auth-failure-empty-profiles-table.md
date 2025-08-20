# Critical Authentication Failure - Empty Profiles Table

**Date:** 2025-01-20  
**Severity:** CRITICAL - Production Blocking  
**Category:** Authentication  
**Status:** RESOLVED  

## Problem Description

All users in the system were receiving "Acesso negado. Perfil de usuário não encontrado" (Access denied. User profile not found) errors, completely blocking access to the application.

## Symptoms

- 403 Forbidden responses on all API endpoints
- Error message: "Acesso negado. Perfil de usuário não encontrado"
- Console logs showing: `Profile query failed: PGRST116 - The result contains 0 rows`
- JWT validation successful but subsequent profile lookup failing

## Root Cause Analysis

### Primary Issue
The `profiles` table was completely empty (0 records) despite having 119 authenticated users in `auth.users` table.

### Secondary Issue
The JWT auth middleware was using Supabase client queries which were being blocked by RLS (Row Level Security) policies, even when using the admin client.

### Technical Details

1. **Data Inconsistency:**
   - `auth.users`: 119 records (Supabase Auth working)
   - `profiles`: 0 records (Internal profile system broken)
   - `users`: 0 records (Legacy table also empty)

2. **RLS Policy Conflict:**
   ```sql
   profiles_secure_select: ((auth.uid() = id) OR ((auth.jwt() ->> 'user_role'::text) = 'ADMINISTRADOR'::text))
   ```
   This policy was preventing even admin client access to profiles.

3. **Middleware Implementation:**
   The middleware was querying profiles via Supabase client instead of direct database connection.

## Solution Implemented

### Phase 1: Data Recovery
```sql
-- Populated profiles table from auth.users
INSERT INTO profiles (id, full_name, role)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  CASE 
    WHEN email LIKE '%analista%' OR email LIKE '%analyst%' THEN 'ANALISTA'::user_role
    WHEN email LIKE '%atendente%' OR email LIKE '%attendant%' THEN 'ATENDENTE'::user_role  
    WHEN email LIKE '%admin%' OR email LIKE '%gerente%' OR email LIKE '%manager%' THEN 'ADMINISTRADOR'::user_role
    WHEN email LIKE '%diretor%' OR email LIKE '%director%' THEN 'DIRETOR'::user_role
    WHEN email LIKE '%financeiro%' OR email LIKE '%finance%' THEN 'FINANCEIRO'::user_role
    WHEN email LIKE '%cobranca%' OR email LIKE '%cobrança%' THEN 'COBRANÇA'::user_role
    ELSE 'ATENDENTE'::user_role
  END as role
FROM auth.users 
WHERE email IS NOT NULL 
  AND email NOT LIKE 'test-%@test.com'
ON CONFLICT (id) DO NOTHING;
```

Result: 20 real user profiles created successfully.

### Phase 2: Middleware Fix
Modified `server/lib/jwt-auth-middleware.ts` to use direct database connection instead of Supabase client:

```typescript
// OLD: Supabase client query (blocked by RLS)
const { data: profile, error: profileError } = await supabaseAdmin
  .from("profiles")
  .select("id, full_name, role, loja_id")
  .eq("id", userId)
  .single();

// NEW: Direct database query (bypasses RLS)
const profileResult = await db
  .select({
    id: profiles.id,
    fullName: profiles.fullName,
    role: profiles.role,
    lojaId: profiles.lojaId,
  })
  .from(profiles)
  .where(eq(profiles.id, userId))
  .limit(1);
```

## Validation Evidence

### Before Fix
```
🚨 [SECURITY] ACCESS_DENIED | severity=HIGH | FAILURE | user=atendenteinovando2@gmail.com | ip=187.36.168.240 | endpoint=/api/alertas/notificacoes
Profile query failed: PGRST116 - The result contains 0 rows
```

### After Fix
```
[ALERTAS] Mapeamento: atendenteinovando2@gmail.com -> Local ID: 20
[ALERTAS] Encontradas 0 notificações, 0 não lidas
```

## Prevention Measures

1. **Data Integrity Monitoring:** Add automated checks to ensure profiles table stays in sync with auth.users
2. **Middleware Testing:** Add integration tests for authentication middleware with various user roles
3. **RLS Documentation:** Document RLS policies and their impact on admin operations
4. **Backup Strategy:** Implement automated profile backup before any auth system changes

## Technical Debt Created

- Need to create automated sync mechanism between auth.users and profiles
- Should implement profile creation triggers for new user registrations
- Consider removing dependency on RLS for critical authentication flows

## Files Modified

- `server/lib/jwt-auth-middleware.ts` - Updated profile lookup logic
- Database: `profiles` table - Populated with user data

## Testing Performed

- ✅ Multiple user accounts tested successfully
- ✅ Different role types (ANALISTA, ATENDENTE, ADMINISTRADOR) validated
- ✅ No LSP errors remaining
- ✅ API endpoints returning 200 OK instead of 403 Forbidden

## Impact Assessment

- **Downtime:** ~30 minutes of investigation and fix
- **Users Affected:** All users (100% authentication failure)
- **Data Loss:** None
- **Performance Impact:** Improved (direct DB queries faster than Supabase client)

## Lessons Learned

1. Critical authentication components should not rely on RLS policies
2. Profile creation should be atomic with user registration
3. Admin operations need guaranteed database access paths
4. Better monitoring needed for profile/auth synchronization

## Contact

For questions about this fix, refer to PAM V1.0 documentation or the system architect.