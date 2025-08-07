import postgres from 'postgres';

const attempts = [
  {
    name: 'REPLIT_DB_URL',
    url: process.env.REPLIT_DB_URL
  },
  {
    name: 'Constructed from PG vars',
    url: `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`
  },
  {
    name: 'Supabase Direct (port 5432)',
    url: `postgresql://postgres:${process.env.PGPASSWORD}@db.dvglgxrvhmtsixaabxha.supabase.co:5432/postgres`
  },
  {
    name: 'Supabase Pooler (port 6543)',
    url: `postgresql://postgres.dvglgxrvhmtsixaabxha:${process.env.PGPASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  }
];

console.log('🔍 Testando todas as possíveis conexões...\n');

for (const attempt of attempts) {
  if (!attempt.url) continue;
  
  console.log(`Testing: ${attempt.name}`);
  console.log(`URL: ${attempt.url.substring(0, 60)}...`);
  
  try {
    const sql = postgres(attempt.url, { max: 1, idle_timeout: 1, connect_timeout: 3 });
    const result = await sql`SELECT current_database()`;
    console.log(`✅ SUCCESS! Database: ${result[0].current_database}`);
    await sql.end();
    
    if (!attempt.url.includes('neon')) {
      console.log('\n🎯 FOUND WORKING SUPABASE CONNECTION!');
      console.log(`Use this: ${attempt.name}`);
      break;
    } else {
      console.log('⚠️  But this is Neon, not Supabase!\n');
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message.substring(0, 50)}...\n`);
  }
}
