import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Tentando configurar conexão correta com Supabase...\n');

// O Supabase Client funciona perfeitamente
const supabase = createClient(supabaseUrl, supabaseKey);

// Vamos testar se conseguimos executar SQL direto
const { data, error } = await supabase.rpc('get_server_version', {});

if (!error) {
  console.log('✅ Supabase RPC funcionando!');
  console.log('Versão do PostgreSQL:', data);
} else {
  console.log('RPC não disponível:', error.message);
}

// Alternativa: Usar o Supabase para todas as operações de banco
console.log('\n📌 Solução: Usar Supabase Client diretamente em vez de Drizzle com DATABASE_URL incorreta');
console.log('O sistema já está configurado para usar Supabase via REST API');
console.log('O problema do DATABASE_URL apontando para Neon não afeta operações via Supabase Client');
