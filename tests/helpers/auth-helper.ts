/**
 * Authentication Helper for Integration Tests
 * PAM V1.1 - Helper reutilizável para autenticação em testes
 * 
 * Encapsula a complexidade de login e gerenciamento de token JWT,
 * fornecendo instâncias autenticadas do supertest para testes de API.
 * 
 * @file tests/helpers/auth-helper.ts
 * @created 2025-08-20 - PAM V1.1 Testes Integração Autenticados
 */

import request from "supertest";
import type { Express } from "express";
import { createServerSupabaseAdminClient } from "../../server/lib/supabase";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
}

export interface AuthenticatedTestClient {
  request: typeof request;
  app: Express;
  user: TestUser;
  accessToken: string;
  // Helper methods for authenticated requests
  get: (url: string) => request.Test;
  post: (url: string) => request.Test;
  put: (url: string) => request.Test;
  patch: (url: string) => request.Test;
  delete: (url: string) => request.Test;
}

/**
 * Creates a test user in Supabase Auth and public.users table
 * Uses a simple approach for test environment
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const timestamp = Date.now();
  const defaultUser: TestUser = {
    id: "",
    email: `test-user-${timestamp}@example.com`,
    password: "TestPassword123!", 
    name: "Integration Test User",
    role: "ATENDENTE",
    ...overrides,
  };

  console.log(`[AUTH HELPER] 👤 Creating test user: ${defaultUser.email}`);

  try {
    // Use Supabase Admin Client to create user in auth.users
    const supabaseAdmin = createServerSupabaseAdminClient();
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: defaultUser.email,
      password: defaultUser.password,
      email_confirm: true, // Auto-confirm for tests
      user_metadata: {
        name: defaultUser.name,
        role: defaultUser.role,
      },
    });

    if (error) {
      console.warn(`[AUTH HELPER] ⚠️ Supabase user creation failed: ${error.message}`);
      // For tests, continue with a mock user ID if Supabase creation fails
      const mockUserId = `mock-${timestamp}`;
      return {
        ...defaultUser,
        id: mockUserId,
      };
    }

    if (!data.user) {
      console.warn(`[AUTH HELPER] ⚠️ No user data returned, using mock ID`);
      return {
        ...defaultUser,
        id: `fallback-${timestamp}`,
      };
    }

    console.log(`[AUTH HELPER] ✅ Test user created: ${data.user.id}`);
    
    return {
      ...defaultUser,
      id: data.user.id,
    };
    
  } catch (error) {
    console.error(`[AUTH HELPER] ❌ Failed to create test user:`, error);
    console.log(`[AUTH HELPER] 🔄 Using fallback approach for tests...`);
    
    // Fallback: return user data for testing even if creation fails
    return {
      ...defaultUser,
      id: `test-fallback-${timestamp}`,
    };
  }
}

/**
 * Performs login via HTTP API and returns access token
 * Includes fallback for test environment
 */
export async function loginTestUser(
  app: Express, 
  user: TestUser
): Promise<string> {
  console.log(`[AUTH HELPER] 🔐 Logging in test user: ${user.email}`);

  try {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password,
      });

    console.log(`[AUTH HELPER] 📡 Login response status: ${response.status}`);

    if (response.status === 200 && response.body.session?.access_token) {
      const accessToken = response.body.session.access_token;
      console.log(`[AUTH HELPER] ✅ Login successful - Token obtained`);
      return accessToken;
    }

    // If login fails, try to create and login the user
    console.log(`[AUTH HELPER] ⚠️ Login failed (${response.status}), attempting to create user first...`);
    
    // Try to create user via signup endpoint
    const signupResponse = await request(app)
      .post("/api/auth/register")
      .send({
        email: user.email,
        password: user.password,
        name: user.name,
      });

    console.log(`[AUTH HELPER] 📝 Signup response status: ${signupResponse.status}`);

    if (signupResponse.status === 200 && signupResponse.body.session?.access_token) {
      const accessToken = signupResponse.body.session.access_token;
      console.log(`[AUTH HELPER] ✅ User created and logged in - Token obtained`);
      return accessToken;
    }

    // If all else fails, throw error - tests must use real auth
    throw new Error(`Authentication failed - Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
    
  } catch (error) {
    console.error(`[AUTH HELPER] ❌ Auth process failed:`, error);
    throw error;
  }
}

/**
 * Creates an authenticated test client with all helper methods
 * This is the main function to use in tests
 */
export async function createAuthenticatedTestClient(
  app: Express,
  userOverrides: Partial<TestUser> = {}
): Promise<AuthenticatedTestClient> {
  console.log(`[AUTH HELPER] 🚀 Creating authenticated test client...`);

  // Create test user in Supabase
  const user = await createTestUser(userOverrides);
  
  // Login and get access token
  const accessToken = await loginTestUser(app, user);
  
  // Create helper methods for authenticated requests
  const createAuthenticatedRequest = (method: string) => (url: string) => {
    return (request(app) as any)[method](url)
      .set("Authorization", `Bearer ${accessToken}`);
  };

  const client: AuthenticatedTestClient = {
    request: request,
    app,
    user,
    accessToken,
    get: createAuthenticatedRequest("get"),
    post: createAuthenticatedRequest("post"),
    put: createAuthenticatedRequest("put"),
    patch: createAuthenticatedRequest("patch"),
    delete: createAuthenticatedRequest("delete"),
  };

  console.log(`[AUTH HELPER] ✅ Authenticated client ready for user: ${user.email}`);
  
  return client;
}

/**
 * Cleanup test user from Supabase Auth
 * Should be called in test cleanup
 */
export async function deleteTestUser(userId: string): Promise<void> {
  try {
    console.log(`[AUTH HELPER] 🗑️ Cleaning up test user: ${userId}`);
    
    const supabaseAdmin = createServerSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (error) {
      console.warn(`[AUTH HELPER] ⚠️ Could not delete test user: ${error.message}`);
      // Don't throw error - cleanup is best effort
    } else {
      console.log(`[AUTH HELPER] ✅ Test user deleted: ${userId}`);
    }
    
  } catch (error) {
    console.warn(`[AUTH HELPER] ⚠️ Error during test user cleanup:`, error);
    // Don't throw - cleanup should not fail tests
  }
}

/**
 * Quick helper for tests that need a simple authenticated request
 * Usage: const response = await authenticatedRequest(app, 'post', '/api/propostas', data);
 */
export async function authenticatedRequest(
  app: Express,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  data?: any,
  userOverrides: Partial<TestUser> = {}
): Promise<request.Response> {
  const client = await createAuthenticatedTestClient(app, userOverrides);
  
  try {
    let req = client[method](url);
    
    if (data && ['post', 'put', 'patch'].includes(method)) {
      req = req.send(data);
    }
    
    const response = await req;
    
    // Cleanup
    await deleteTestUser(client.user.id);
    
    return response;
    
  } catch (error) {
    // Cleanup even on error
    await deleteTestUser(client.user.id);
    throw error;
  }
}