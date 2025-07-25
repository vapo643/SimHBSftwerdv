import { createServerSupabaseAdminClient } from '../server/lib/supabase';

async function testOriginationEndpoint() {
  console.log('🚀 Testing Origination Endpoint...\n');
  
  try {
    const supabase = createServerSupabaseAdminClient();
    
    // 1. Create test users if needed
    console.log('1️⃣ Setting up test data...');
    
    // Create a test partner first
    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .upsert({
        razao_social: 'Parceiro Teste Origination',
        cnpj: '12345678000199',
        comissao_padrao: '10.00'
      }, { onConflict: 'cnpj' })
      .select()
      .single();
    
    if (parceiroError) throw parceiroError;
    console.log('✅ Parceiro criado:', parceiro.razao_social);
    
    // Create a test store
    const { data: loja, error: lojaError } = await supabase
      .from('lojas')
      .insert({
        nome_loja: 'Loja Teste Origination',
        parceiro_id: parceiro.id,
        is_active: true
      })
      .select()
      .single();
    
    if (lojaError) throw lojaError;
    console.log('✅ Loja criada:', loja.nome_loja);
    
    // Create test user
    const testEmail = 'atendente.teste@simpix.com';
    const testPassword = 'Teste123!@#';
    
    // Try to sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Atendente Teste',
        role: 'ATENDENTE',
        loja_id: loja.id
      }
    });
    
    let userId: string;
    if (signUpError && !signUpError.message.includes('already been registered')) {
      throw signUpError;
    } else if (authData?.user) {
      userId = authData.user.id;
    } else {
      // Get existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users.users.find(u => u.email === testEmail);
      if (!existingUser) throw new Error('Could not find or create user');
      userId = existingUser.id;
    }
    
    // Ensure profile exists
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Atendente Teste',
        role: 'ATENDENTE',
        loja_id: loja.id
      }, { onConflict: 'id' });
    
    if (profileError) throw profileError;
    
    console.log('✅ Usuário atendente e perfil criados/atualizados');
    
    // Create test products
    const produtos = [
      {
        nome_produto: 'Crédito Pessoal Express',
        is_active: true,
        tac_valor: '250.00',
        tac_tipo: 'fixo'
      },
      {
        nome_produto: 'Empréstimo Consignado',
        is_active: true,
        tac_valor: '2.50',
        tac_tipo: 'percentual'
      }
    ];
    
    for (const produto of produtos) {
      const { data, error } = await supabase
        .from('produtos')
        .upsert(produto, { onConflict: 'nome_produto' })
        .select()
        .single();
      
      if (error) throw error;
      console.log(`✅ Produto criado: ${produto.nome_produto}`);
      
      // Create commercial tables for each product
      const tabelas = [
        {
          nome_tabela: `${produto.nome_produto} - Personalizada ${parceiro.razao_social}`,
          produto_id: data.id,
          parceiro_id: parceiro.id,
          taxa_juros: '1.99',
          prazos: [12, 24, 36],
          comissao: '15.00'
        },
        {
          nome_tabela: `${produto.nome_produto} - Geral`,
          produto_id: data.id,
          parceiro_id: null,
          taxa_juros: '2.49',
          prazos: [6, 12, 18, 24],
          comissao: '10.00'
        }
      ];
      
      for (const tabela of tabelas) {
        await supabase
          .from('tabelas_comerciais')
          .upsert(tabela, { 
            onConflict: 'nome_tabela',
            ignoreDuplicates: false 
          });
      }
    }
    
    console.log('✅ Tabelas comerciais criadas\n');
    
    // 2. Login to get JWT token
    console.log('2️⃣ Fazendo login...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login failed: ${error}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.session.access_token;
    console.log('✅ Login realizado com sucesso\n');
    
    // 3. Call the origination context endpoint
    console.log('3️⃣ Chamando endpoint de contexto...');
    const contextResponse = await fetch('http://localhost:5000/api/origination/context', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!contextResponse.ok) {
      const error = await contextResponse.text();
      throw new Error(`Context endpoint failed: ${error}`);
    }
    
    const contextData = await contextResponse.json();
    
    // 4. Display the results
    console.log('✅ Resposta recebida com sucesso!\n');
    console.log('📋 CONTEXTO DE ORIGINAÇÃO:');
    console.log('============================\n');
    
    console.log('👤 ATENDENTE:');
    console.log(JSON.stringify(contextData.atendente, null, 2));
    
    console.log('\n📦 PRODUTOS DISPONÍVEIS:');
    contextData.produtos.forEach((produto: any) => {
      console.log(`\n  ${produto.nome} (ID: ${produto.id})`);
      console.log(`  TAC: ${produto.tacTipo === 'fixo' ? `R$ ${produto.tacValor}` : `${produto.tacValor}%`}`);
      console.log(`  Tabelas disponíveis: ${produto.tabelasDisponiveis.length}`);
      produto.tabelasDisponiveis.forEach((tabela: any) => {
        console.log(`    - ${tabela.nomeTabela} (${tabela.tipo})`);
        console.log(`      Taxa: ${tabela.taxaJuros}% | Prazos: ${tabela.prazos.join(', ')} meses`);
      });
    });
    
    console.log('\n📄 DOCUMENTOS OBRIGATÓRIOS:');
    contextData.documentosObrigatorios.forEach((doc: string) => {
      console.log(`  - ${doc}`);
    });
    
    console.log('\n💰 LIMITES DE NEGÓCIO:');
    console.log(JSON.stringify(contextData.limites, null, 2));
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    process.exit(1);
  }
}

// Run the test
testOriginationEndpoint();