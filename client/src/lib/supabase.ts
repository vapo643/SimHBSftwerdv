import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientSupabaseInstance: SupabaseClient | null = null;

// Função para criar o cliente Supabase para o lado do servidor (Express.js)
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Função para criar ou retornar a instância única do cliente para o lado do cliente (React)
export const createClientSupabaseClient = () => {
  if (clientSupabaseInstance) {
    return clientSupabaseInstance;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return clientSupabaseInstance;ce;
};
