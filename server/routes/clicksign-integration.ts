/**
 * ClickSign Integration Routes for Proposal Formalization
 * Handles the electronic signature workflow for attendants
 */

import express from 'express';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { clickSignServiceV3 } from '../services/clickSignServiceV3.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * Send proposal CCB to ClickSign for electronic signature
 * POST /api/propostas/:id/clicksign/enviar
 */
router.post('/propostas/:id/clicksign/enviar', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: propostaId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log(`[CLICKSIGN] ${getBrasiliaTimestamp()} - Iniciando envio para ClickSign - Proposta: ${propostaId}, User: ${userId}, Role: ${userRole}`);

    // Verificar se é ATENDENTE
    if (userRole !== 'ATENDENTE') {
      return res.status(403).json({
        message: 'Apenas atendentes podem enviar contratos para assinatura eletrônica'
      });
    }

    // Import database dependencies
    const { db } = await import("../lib/supabase");
    const { propostas } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");

    // Buscar dados da proposta
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId));

    if (!proposta) {
      return res.status(404).json({ message: 'Proposta não encontrada' });
    }

    console.log(`[CLICKSIGN] Proposta encontrada: ${proposta.id}, Status: ${proposta.status}, CCB Gerado: ${proposta.ccbGerado}`);

    // Verificar se CCB foi gerado
    if (!proposta.ccbGerado || !proposta.caminhoCcbAssinado) {
      return res.status(400).json({
        message: 'CCB deve ser gerada antes de enviar para assinatura eletrônica'
      });
    }

    // Verificar se já foi enviado para ClickSign
    if (proposta.assinaturaEletronicaConcluida) {
      return res.status(400).json({
        message: 'Este contrato já foi processado para assinatura eletrônica'
      });
    }

    // Parse client data from JSONB
    const clienteData = proposta.clienteData as any;
    if (!clienteData || !clienteData.nome || !clienteData.email || !clienteData.cpf) {
      return res.status(400).json({
        message: 'Dados do cliente incompletos. Nome, email e CPF são obrigatórios.'
      });
    }

    console.log(`[CLICKSIGN] Cliente: ${clienteData.nome}, Email: ${clienteData.email}, CPF: ${clienteData.cpf}`);

    // Verificar se arquivo CCB existe
    const { createServerSupabaseAdminClient } = await import('../lib/supabase');
    const supabase = createServerSupabaseAdminClient();

    // Extrair caminho correto do CCB
    let ccbPath = proposta.caminhoCcbAssinado;
    const documentsIndex = ccbPath.indexOf('/documents/');
    if (documentsIndex !== -1) {
      ccbPath = ccbPath.substring(documentsIndex + '/documents/'.length);
    }

    console.log(`[CLICKSIGN] Buscando CCB no caminho: ${ccbPath}`);

    // Baixar o CCB do Supabase Storage
    const { data: ccbFile, error: downloadError } = await supabase.storage
      .from('documents')
      .download(ccbPath);

    if (downloadError || !ccbFile) {
      console.error(`[CLICKSIGN] Erro ao baixar CCB:`, downloadError);
      return res.status(500).json({
        message: 'Erro ao acessar arquivo CCB'
      });
    }

    // Convert file to base64
    const arrayBuffer = await ccbFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    console.log(`[CLICKSIGN] CCB convertido para base64, tamanho: ${base64Content.length} chars`);

    // Preparar dados para ClickSign
    const envelopeData = {
      name: `Contrato CCB - Proposta ${propostaId}`,
      locale: 'pt-BR',
      auto_close: false,
      deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      sequence_enabled: false,
      block_after_refusal: true
    };

    const documentData = {
      type: 'upload' as const,
      content: base64Content,
      filename: `CCB-${propostaId}.pdf`
    };

    const signerData = {
      name: clienteData.nome,
      email: clienteData.email,
      phone: clienteData.telefone || '',
      documentation: clienteData.cpf.replace(/\D/g, ''), // Remove formatação
      birthday: clienteData.dataNascimento || undefined,
      company: clienteData.nomeEmpresa || undefined
    };

    console.log(`[CLICKSIGN] Enviando para ClickSign API...`);

    // Chamar ClickSign API
    const result = await clickSignServiceV3.sendCCBForSignature(
      propostaId,
      base64Content,
      {
        name: clienteData.nome,
        email: clienteData.email,
        phone: clienteData.telefone || '',
        cpf: clienteData.cpf,
        birthday: clienteData.dataNascimento
      }
    );

    console.log(`[CLICKSIGN] ✅ Sucesso! Envelope criado: ${result.envelopeId}`);

    // Atualizar proposta no banco
    await db
      .update(propostas)
      .set({
        clicksignListKey: result.envelopeId, // Using listKey for envelope ID
        clicksignDocumentKey: result.documentId || '',
        clicksignSignerKey: result.signerId || '',
        clicksignSignUrl: result.signUrl || '',
        clicksignStatus: 'pending',
        clicksignSentAt: new Date()
      })
      .where(eq(propostas.id, propostaId));

    // Log de auditoria
    const { propostaLogs } = await import("../../shared/schema");
    await db.insert(propostaLogs).values({
      propostaId,
      autorId: userId || '',
      statusNovo: 'clicksign_enviado',
      observacao: `Contrato enviado para ClickSign. Envelope: ${result.envelopeId}`
    });

    console.log(`[CLICKSIGN] ✅ Proposta atualizada e log registrado`);

    res.json({
      message: 'Contrato enviado para ClickSign com sucesso',
      envelopeId: result.envelopeId, // Keep as envelopeId for frontend compatibility
      documentKey: result.documentId || '',
      signerKey: result.signerId || '',
      signUrl: result.signUrl || '',
      status: 'pending',
      createdAt: getBrasiliaTimestamp()
    });

  } catch (error) {
    console.error(`[CLICKSIGN] ❌ Erro ao enviar para ClickSign:`, error);
    
    res.status(500).json({
      message: 'Erro ao enviar contrato para ClickSign',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * Get ClickSign status for a proposal
 * GET /api/propostas/:id/clicksign/status
 */
router.get('/propostas/:id/clicksign/status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: propostaId } = req.params;

    // Import database dependencies
    const { db } = await import("../lib/supabase");
    const { propostas } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");

    // Buscar dados da proposta
    const [proposta] = await db
      .select({
        id: propostas.id,
        clicksignListKey: propostas.clicksignListKey, // Using correct field name
        clicksignStatus: propostas.clicksignStatus,
        clicksignSignUrl: propostas.clicksignSignUrl,
        assinaturaEletronicaConcluida: propostas.assinaturaEletronicaConcluida
      })
      .from(propostas)
      .where(eq(propostas.id, propostaId));

    if (!proposta) {
      return res.status(404).json({ message: 'Proposta não encontrada' });
    }

    if (!proposta.clicksignListKey) {
      return res.json({
        status: 'not_sent',
        message: 'Contrato ainda não foi enviado para ClickSign'
      });
    }

    // Buscar status atualizado no ClickSign
    try {
      const envelopeStatus = await clickSignServiceV3.getEnvelopeStatus(proposta.clicksignListKey);
      
      res.json({
        envelopeId: proposta.clicksignListKey, // Frontend expects envelopeId
        status: envelopeStatus.status,
        signUrl: proposta.clicksignSignUrl,
        completed: proposta.assinaturaEletronicaConcluida,
        lastUpdated: getBrasiliaTimestamp()
      });
    } catch (error) {
      // Se der erro na API do ClickSign, retorna dados do banco
      res.json({
        envelopeId: proposta.clicksignListKey, // Frontend expects envelopeId
        status: proposta.clicksignStatus || 'unknown',
        signUrl: proposta.clicksignSignUrl,
        completed: proposta.assinaturaEletronicaConcluida,
        lastUpdated: getBrasiliaTimestamp(),
        note: 'Status do banco de dados (ClickSign API indisponível)'
      });
    }

  } catch (error) {
    console.error(`[CLICKSIGN] Erro ao consultar status:`, error);
    res.status(500).json({
      message: 'Erro ao consultar status do ClickSign'
    });
  }
});

export default router;