import { createClientSupabaseClient } from "./supabase";

async function fetchWithToken(url: string, options?: RequestInit) {
  const supabase = createClientSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("🔐 API Client - Making request:", {
    url,
    method: options?.method || "GET",
    hasToken: !!session?.access_token,
    tokenLength: session?.access_token?.length || 0
  });

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };

  // Add authorization header if we have a token
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    console.warn("⚠️ API Client - No access token available");
  }

  // Don't set Content-Type for FormData, let the browser set it
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: headers,
    });

    console.log("📡 API Response:", {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.clone().json();
        errorMessage = errorData.message || errorMessage;
        console.error("❌ API Error (JSON):", errorData);
      } catch {
        const errorText = await response.clone().text();
        errorMessage = errorText || errorMessage;
        console.error("❌ API Error (Text):", errorText);
      }
      
      throw new Error(`API Error: ${response.status} ${errorMessage}`);
    }

    return response;
  } catch (error) {
    console.error("❌ Fetch Error:", error);
    throw error;
  }
}

export { fetchWithToken };
export default fetchWithToken;
