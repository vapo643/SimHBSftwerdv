import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Vamos tentar construir a URL baseada no que sabemos
const projectId = 'dvglgxrvhmtsixaabxha';
const password = process.env.SUPABASE_SERVICE_ROLE_KEY || 'senha-aqui';

// Tentativas de URLs conhecidas para Supabase
const urls = [
  `postgresql://postgres.${projectId}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${password}@db.${projectId}.supabase.co:5432/postgres`,
  `postgresql://postgres:${password}@db.${projectId}.supabase.co:6543/postgres`
];

console.log('🔍 Tentando encontrar a URL correta do Supabase...\n');

for (const url of urls) {
  console.log(`Testando: ${url.substring(0, 60)}...`);
  try {
    const sql = postgres(url, { max: 1, idle_timeout: 1 });
    const result = await sql`SELECT 1 as test`;
    if (result) {
      console.log('✅ SUCESSO! Esta URL funciona!');
      console.log('URL completa:', url);
      await sql.end();
      break;
    }
  } catch (error) {
    console.log(`❌ Falhou: ${error.message.substring(0, 50)}...`);
  }
}
