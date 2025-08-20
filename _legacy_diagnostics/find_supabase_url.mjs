import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Informações do Supabase:');
console.log('URL do Projeto:', supabaseUrl);
console.log('ID do Projeto:', supabaseUrl.split('.')[0].replace('https://', ''));

// Baseado no ID, a URL do banco deve ser uma dessas:
const projectId = supabaseUrl.split('.')[0].replace('https://', '');
console.log('\n📍 Possíveis URLs do banco Supabase:');
console.log(`1. postgresql://postgres.[PASSWORD]@db.${projectId}.supabase.co:5432/postgres`);
console.log(`2. postgresql://postgres.${projectId}:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`);
console.log('\nPrecisamos da senha do banco PostgreSQL do Supabase para completar a URL.');
