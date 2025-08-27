/**
 * Projeto Cérbero - Demonstração do Semgrep MCP Server
 * Script para testar análise de segurança em tempo real
 */

const API_BASE = 'http://localhost:5000/api/security/mcp';

// Token JWT para autenticação (substitua com um token válido)
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-jwt-token-here';

const headers = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

async function testHealthCheck() {
  console.log('\n🏥 Testando Health Check...');
  try {
    const response = await fetch(`${API_BASE}/health`, { headers });
    const data = await response.json();
    console.log('✅ Health Check:', data);
  }
catch (error) {
    console.error('❌ Health Check falhou:', error);
  }
}

async function testFileAnalysis() {
  console.log('\n📄 Testando análise de arquivo...');
  const filePath = 'server/routes/admin/users.ts';

  try {
    const response = await fetch(`${API_BASE}/scan/${filePath}`, { headers });
    const data = await response.json();

    if (data.success) {
      console.log('✅ Análise concluída:');
      console.log(`  - Arquivo: ${data.file}`);
      console.log(`  - Findings: ${data.analysis.findings.length}`);
      console.log(`  - Tempo de scan: ${data.analysis.metadata.scan_duration_ms}ms`);

      // Mostrar findings críticos
      const criticalFindings = data.analysis.findings.filter((f) => f.severity == 'ERROR');
      if (criticalFindings.length > 0) {
        console.log('\n⚠️  Findings Críticos:');
        criticalFindings.forEach((finding) => {
          console.log(`  - [${finding.rule_id}] ${finding.message}`);
          console.log(`    Arquivo: ${finding.file}:${finding.line}`);
        });
      }
    }
else {
      console.error('❌ Análise falhou:', data.error);
    }
  }
catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

async function testCodeSnippetAnalysis() {
  console.log('\n💻 Testando análise de snippet...');

  // Código com vulnerabilidade intencional
  const vulnerableCode = `
    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;
      
      // SQL Injection vulnerability
      const query = \`SELECT * FROM users WHERE email = '\${email}' AND password = '\${password}'\`;
      const result = await db.query(query);
      
      if (_result.rows.length > 0) {
        const user = _result.rows[0];
        console.log('User CPF:', user.cpf); // PII exposure
        res.json({ token: Math.random().toString(36) }); // Weak token
      }
else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  `;

  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: vulnerableCode,
        context: {
          language: 'typescript',
          framework: 'express',
          user_intent: 'authentication endpoint',
        },
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Análise de snippet concluída:');
      console.log(`  - Findings: ${data.analysis.findings.length}`);
      console.log(`  - Risk Score: ${data.analysis.risk_score}/100`);
      console.log(`  - Compliance:`, data.analysis.compliance_status);

      if (data.analysis.suggestions.length > 0) {
        console.log('\n💡 Sugestões:');
        data.analysis.suggestions.forEach((suggestion) => {
          console.log(`  - ${suggestion}`);
        });
      }
    }
else {
      console.error('❌ Análise falhou:', data.error);
    }
  }
catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

async function testComponentContext() {
  console.log('\n🏗️  Testando contexto de componente...');
  const component = 'auth';

  try {
    const response = await fetch(`${API_BASE}/context/${component}`, { headers });
    const data = await response.json();

    if (data.success) {
      console.log('✅ Contexto do componente:');
      console.log(`  - Componente: ${data.context.component}`);
      console.log(`  - Arquivos analisados: ${data.context.total_files}`);
      console.log(`  - Score de segurança: ${data.context.security_score}/100`);

      if (data.context.top_risks.length > 0) {
        console.log('\n🔴 Top Riscos:');
        data.context.top_risks.slice(0, 5).forEach((risk) => {
          console.log(`  - [${risk.severity}] ${risk.rule_id} (${risk.count}x)`);
        });
      }

      if (data.context.recommendations.length > 0) {
        console.log('\n📋 Recomendações:');
        data.context.recommendations.forEach((rec) => {
          console.log(`  - ${rec}`);
        });
      }
    }
else {
      console.error('❌ Contexto falhou:', data.error);
    }
  }
catch (error) {
    console.error('❌ Erro no contexto:', error);
  }
}

async function testActiveRules() {
  console.log('\n📏 Testando regras ativas...');

  try {
    const response = await fetch(`${API_BASE}/rules`, { headers });
    const data = await response.json();

    if (data.success) {
      console.log('✅ Regras ativas:');
      console.log(`  - Total: ${data.rules.total}`);
      console.log('  - Por severidade:', data.rules.by_severity);
      console.log('  - Por categoria:', data.rules.by_category);
    }
else {
      console.error('❌ Listagem falhou:', data.error);
    }
  }
catch (error) {
    console.error('❌ Erro nas regras:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando testes do Semgrep MCP Server...');
  console.log('================================\n');

  await testHealthCheck();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testFileAnalysis();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testCodeSnippetAnalysis();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testComponentContext();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testActiveRules();

  console.log('\n================================');
  console.log('✅ Testes concluídos!');
}

// Executar testes se rodado diretamente
if (require.main == module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
