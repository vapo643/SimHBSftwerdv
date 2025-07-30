import { getSupabase } from './supabase';

export async function fetchWithToken(url: string, options?: RequestInit): Promise<Response> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}