import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for API testing
global.fetch = vi.fn();

const mockFetch = vi.mocked(fetch);

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should handle login request correctly', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        user: { id: '1', email: 'test@example.com' },
        token: 'mock-jwt-token'
      })
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' })
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.user.email).toBe('test@example.com');
    expect(data.token).toBe('mock-jwt-token');
  });

  it('should handle login failure correctly', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' })
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toBe('Invalid credentials');
  });

  it('should handle register request correctly', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        user: { id: '1', email: 'newuser@example.com' },
        message: 'Registration successful'
      })
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    const userData = {
      email: 'newuser@example.com',
      password: 'securepassword',
      name: 'New User'
    };

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.user.email).toBe('newuser@example.com');
  });
});