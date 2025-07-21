import { createClientSupabaseClient } from "./supabase";

async function fetchWithToken(url: string, options?: RequestInit) {
  const supabase = createClientSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    ...options?.headers,
    Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
  };

  // Don't set Content-Type for FormData, let the browser set it
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers: headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${errorText}`);
  }

  return response;
}

export default fetchWithToken;
