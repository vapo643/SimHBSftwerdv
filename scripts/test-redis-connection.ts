import Redis from 'ioredis';

const testRedisConnection = async () => {
  console.log('🔍 [DIAGNÓSTICO REDIS] Iniciando teste de conexão...');
  console.log('📋 [CREDENCIAIS] Verificando variáveis de ambiente:');
  console.log(`   REDIS_HOST: ${process.env.REDIS_HOST || 'NÃO DEFINIDO'}`);
  console.log(`   REDIS_PORT: ${process.env.REDIS_PORT || 'NÃO DEFINIDO'}`);
  console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '[CONFIGURADO]' : 'NÃO DEFINIDO'}`);

  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASSWORD) {
    console.error('❌ FALHA: Credenciais Redis incompletas nas variáveis de ambiente.');
    return;
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: {}, // Essencial para a maioria das conexões de Redis Cloud
    connectTimeout: 10000, // 10 segundos
    lazyConnect: true, // Para capturar erros de conexão
  });

  try {
    console.log('🔌 [CONEXÃO] Tentando conectar ao Redis Cloud...');
    await redis.connect();
    console.log('✅ [CONEXÃO] Conectado com sucesso ao Redis Cloud.');
    
    console.log('📡 [PING] Executando comando PING...');
    const reply = await redis.ping();
    console.log('✅ SUCESSO: Conexão com Redis Cloud bem-sucedida. Resposta do PING:', reply);
    
    // Teste adicional - SET e GET
    console.log('🧪 [TESTE] Executando teste SET/GET...');
    await redis.set('test:diagnostic', 'redis-working');
    const getValue = await redis.get('test:diagnostic');
    console.log('✅ TESTE SET/GET: Valor recuperado:', getValue);
    
    // Limpar teste
    await redis.del('test:diagnostic');
    console.log('🧹 [LIMPEZA] Teste removido com sucesso.');
    
  } catch (error) {
    console.error('❌ FALHA: Erro ao conectar com o Redis Cloud:');
    console.error('📄 [DETALHES DO ERRO]:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    console.error('   Code:', error.code || 'N/A');
    console.error('   Errno:', error.errno || 'N/A');
    console.error('   Syscall:', error.syscall || 'N/A');
    console.error('   Address:', error.address || 'N/A');
    console.error('   Port:', error.port || 'N/A');
    console.error('📄 [STACK TRACE]:');
    console.error(error.stack);
  } finally {
    console.log('🔌 [DESCONEXÃO] Encerrando conexão...');
    await redis.quit();
    console.log('✅ [DESCONEXÃO] Conexão encerrada.');
  }
};

// Executar diagnóstico
testRedisConnection().catch(console.error);