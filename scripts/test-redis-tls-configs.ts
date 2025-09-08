import Redis from 'ioredis';

const testRedisConfigurations = async () => {
  console.log('🔍 [DIAGNÓSTICO AVANÇADO] Testando múltiplas configurações TLS...');
  console.log('📋 [CREDENCIAIS] Verificando variáveis de ambiente:');
  console.log(`   REDIS_HOST: ${process.env.REDIS_HOST || 'NÃO DEFINIDO'}`);
  console.log(`   REDIS_PORT: ${process.env.REDIS_PORT || 'NÃO DEFINIDO'}`);
  console.log(
    `   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '[CONFIGURADO]' : 'NÃO DEFINIDO'}`
  );

  const configurations = [
    {
      name: 'CONFIG 1: TLS Básico (atual)',
      config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: {},
        connectTimeout: 10000,
        lazyConnect: true,
      },
    },
    {
      name: 'CONFIG 2: TLS com rejectUnauthorized false',
      config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: {
          rejectUnauthorized: false,
        },
        connectTimeout: 10000,
        lazyConnect: true,
      },
    },
    {
      name: 'CONFIG 3: Sem TLS (plain text)',
      config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 10000,
        lazyConnect: true,
      },
    },
    {
      name: 'CONFIG 4: TLS com servername',
      config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: {
          servername: process.env.REDIS_HOST,
        },
        connectTimeout: 10000,
        lazyConnect: true,
      },
    },
  ];

  for (const { name, config } of configurations) {
    console.log(`\n🧪 [TESTE] ${name}`);
    console.log('⚙️ [CONFIG]', JSON.stringify(config, null, 2));

    const redis = new Redis(config);

    try {
      console.log('🔌 [CONEXÃO] Tentando conectar...');
      await redis.connect();
      console.log('✅ [SUCESSO] Conectado!');

      const reply = await redis.ping();
      console.log('✅ [PING] Resposta:', reply);

      console.log('🎉 [RESULTADO] Esta configuração FUNCIONOU!');
      await redis.quit();
      break; // Para no primeiro sucesso
    } catch (error) {
      console.error('❌ [FALHA] Erro:');
      console.error('   Mensagem:', error.message);
      console.error('   Code:', error.code || 'N/A');
      console.error('   Syscall:', error.syscall || 'N/A');
      await redis.quit().catch(() => {}); // Ignora erros de quit
    }
  }

  console.log('\n🔍 [DIAGNÓSTICO] Teste de configurações concluído.');
};

// Executar diagnóstico avançado
testRedisConfigurations().catch(console.error);
