import { createClientSupabaseClient } from "./supabase";

async function fetchWithToken(url: string, options?: RequestInit) {
  const supabase = createClientSupabaseClient();
  
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    ...options?.headers,
  };

  // Add authorization header if we have a token
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  // Don't set Content-Type for FormData, let the browser set it
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: headers,
  });

  return response;
}

export default fetchWithToken;