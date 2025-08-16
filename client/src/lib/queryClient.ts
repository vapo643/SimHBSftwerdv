import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { api } from "./apiClient";

async function _throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: { method: string; body?: unknown } = { method: "GET" }
): Promise<unknown> {
  const { method, body } = options;

  // Use the new api client methods
  if (method === "GET") {
    const response = await api.get(url);
    return response.data;
  } else if (method === "POST") {
    const response = await api.post(url, body);
    return response.data;
  } else if (method === "PUT") {
    const response = await api.put(url, body);
    return response.data;
  } else if (method === "PATCH") {
    // PAM V1.0 - HOTFIX: Adicionar suporte para PATCH
    const response = await api.patch(url, body);
    return response.data;
  } else if (method === "DELETE") {
    const response = await api.delete(url);
    return response.data;
  }

  throw new Error(`Unsupported method: ${method}`);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Convert queryKey array to URL string
      const url = queryKey.join("/") as string;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.message?.includes("401")) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
