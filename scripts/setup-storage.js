#!/usr/bin/env node

/**
 * Script para configurar o bucket de documentos no Supabase Storage
 */

const { createClient } = require("@supabase/supabase-js");

async function setupStorage() {
  console.log("🔧 Configurando Supabase Storage...");

  // Verificar variáveis de ambiente
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados");
    process.exit(1);
  }

  console.log(`🌐 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Service Key: ${serviceKey.substring(0, 10)}...`);

  // Criar cliente admin
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Verificar buckets existentes
    console.log("📋 Verificando buckets existentes...");
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error("❌ Erro ao listar buckets:", listError);
      return;
    }

    console.log(
      "📦 Buckets encontrados:",
      buckets.map(b => b.name)
    );

    // Verificar se bucket 'documents' já existe
    const documentsExists = buckets.some(bucket => bucket.name === "documents");

    if (documentsExists) {
      console.log('✅ Bucket "documents" já existe!');
      return;
    }

    // Criar bucket 'documents'
    console.log('🔨 Criando bucket "documents"...');
    const { data: bucket, error: createError } = await supabase.storage.createBucket("documents", {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif"],
    });

    if (createError) {
      console.error("❌ Erro ao criar bucket:", createError);
      return;
    }

    console.log('✅ Bucket "documents" criado com sucesso!');
    console.log("📊 Configuração:", bucket);
  } catch (error) {
    console.error("❌ Erro geral:", error);
  }
}

// Executar setup
setupStorage();
