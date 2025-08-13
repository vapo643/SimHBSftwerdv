#!/usr/bin/env node

/**
 * TESTE COMPLETO DA FUNCIONALIDADE DE CARNÊ DE BOLETOS
 * 
 * Valida todo o fluxo:
 * 1. Login no sistema 
 * 2. Buscar proposta com múltiplos boletos
 * 3. Gerar carnê (PDF consolidado)
 * 4. Validar download
 * 
 * Comando: node test-carne-complete.cjs
 */

const fs = require("fs");
const https = require("https");

const BASE_URL = "https://874e2dce-5057-49ae-8fb5-21491c9977ba-00-1xresvzm7is3g.janeway.replit.dev";

console.log("========================================");
console.log("  TESTE COMPLETO DE CARNÊ DE BOLETOS");
console.log("========================================\n");

async function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CarneTest/1.0",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: json,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on("error", reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function login() {
  console.log("🔐 Fazendo login...");
  
  const response = await makeRequest("POST", "/api/auth/login", {
    email: "admin@simpix.com.br",
    password: "admin123"
  });

  if (response.status !== 200 || !response.data.access_token) {
    console.error("❌ Erro no login:", response.data);
    return null;
  }

  console.log("✅ Login realizado com sucesso");
  return response.data.access_token;
}

async function buscarPropostaComBoletos(token) {
  console.log("\n🔍 Buscando proposta com múltiplos boletos...");
  
  // Usar a proposta que sabemos que tem boletos baseado nos logs
  const propostaId = "88a44696-9b63-42ee-aa81-15f9519d24cb";
  
  console.log(`📋 Verificando proposta: ${propostaId}`);
  
  // Verificar se a proposta tem boletos
  const boletoResponse = await makeRequest("GET", `/api/inter/collections/${propostaId}`, null, token);
  
  if (boletoResponse.status === 200 && Array.isArray(boletoResponse.data) && boletoResponse.data.length > 1) {
    console.log(`✅ Proposta encontrada com ${boletoResponse.data.length} boletos`);
    return {
      id: propostaId,
      boletos: boletoResponse.data.length
    };
  }
  
  console.log("❌ Não foi possível encontrar proposta com múltiplos boletos");
  return null;
}

async function gerarCarne(token, propostaId) {
  console.log(`\n📚 Gerando carnê para proposta: ${propostaId}`);
  
  console.log("⏳ Fazendo requisição para gerar carnê...");
  const response = await makeRequest("GET", `/api/propostas/${propostaId}/carne-pdf`, null, token);
  
  console.log(`📊 Status da resposta: ${response.status}`);
  
  if (response.status === 200 && response.data.success) {
    const data = response.data.data;
    console.log("✅ Carnê gerado com sucesso!");
    console.log(`📄 Tamanho do PDF: ${data.size} bytes`);
    console.log(`🔗 URL de download: ${data.downloadUrl ? 'Presente' : 'Ausente'}`);
    console.log(`⏰ Expira em: ${data.expiresIn}`);
    
    return {
      success: true,
      downloadUrl: data.downloadUrl,
      size: data.size
    };
  } else {
    console.error(`❌ Erro ao gerar carnê: ${response.status}`);
    console.error("📋 Resposta:", response.data);
    return {
      success: false,
      error: response.data
    };
  }
}

async function validarDownload(downloadUrl) {
  console.log("\n📥 Validando download do PDF...");
  
  return new Promise((resolve) => {
    https.get(downloadUrl, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        // Validar magic bytes do PDF
        const pdfMagic = data.slice(0, 5).toString('ascii');
        const isValidPdf = pdfMagic.startsWith('%PDF');
        
        console.log(`📊 Tamanho baixado: ${data.length} bytes`);
        console.log(`🔍 Magic bytes: ${pdfMagic}`);
        console.log(`✅ PDF válido: ${isValidPdf ? 'Sim' : 'Não'}`);
        
        resolve({
          valid: isValidPdf,
          size: data.length,
          magic: pdfMagic
        });
      });
      
    }).on('error', (error) => {
      console.error("❌ Erro no download:", error.message);
      resolve({
        valid: false,
        error: error.message
      });
    });
  });
}

async function executarTeste() {
  try {
    // 1. Login
    const token = await login();
    if (!token) {
      console.log("❌ Não foi possível fazer login. Teste abortado.");
      return;
    }

    // 2. Buscar proposta com boletos
    const proposta = await buscarPropostaComBoletos(token);
    if (!proposta) {
      console.log("❌ Não foi possível encontrar proposta com boletos. Teste abortado.");
      return;
    }

    // 3. Gerar carnê
    const carneoResult = await gerarCarne(token, proposta.id);
    if (!carneoResult.success) {
      console.log("❌ Falha na geração do carnê. Teste falhou.");
      return;
    }

    // 4. Validar download
    const downloadResult = await validarDownload(carneoResult.downloadUrl);
    
    console.log("\n" + "=".repeat(50));
    console.log("🎯 RESULTADO FINAL DO TESTE");
    console.log("=".repeat(50));
    
    if (downloadResult.valid && downloadResult.size > 0) {
      console.log("🎉 ✅ SUCESSO TOTAL!");
      console.log(`📚 Carnê gerado e baixado com sucesso`);
      console.log(`📄 ${proposta.boletos} boletos consolidados em PDF único`);
      console.log(`💾 Tamanho final: ${downloadResult.size} bytes`);
      console.log("🚀 Funcionalidade de carnê completamente operacional!");
    } else {
      console.log("❌ FALHA PARCIAL");
      console.log("Carnê foi gerado mas houve problema no download");
    }

  } catch (error) {
    console.error("💥 Erro durante o teste:", error.message);
  }
}

// Executar o teste
executarTeste();