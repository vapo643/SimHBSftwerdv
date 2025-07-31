/**
 * ClickSign Integration Routes
 * Handles electronic signature workflow
 */

import express from 'express';
import { clickSignService } from '../services/clickSignService.js';
import { interBankService } from '../services/interBankService.js';
import { storage } from '../storage.js';
import { jwtAuthMiddleware, type AuthenticatedRequest } from '../lib/jwt-auth-middleware.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';

const router = express.Router();

/**
 * Send CCB to ClickSign for electronic signature
 * POST /api/clicksign/send-ccb/:propostaId
 */
router.post('/send-ccb/:propostaId', jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    
    console.log(`[CLICKSIGN] Initiating CCB signature for proposal: ${propostaId}`);

    // 1. Get proposal data
    const proposta = await storage.getPropostaById(propostaId);
    if (!proposta) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Validate proposal is approved and CCB is generated
    if (proposta.status !== 'aprovado') {
      return res.status(400).json({ error: 'Proposta deve estar aprovada para envio ao ClickSign' });
    }

    if (!proposta.ccbGerado) {
      return res.status(400).json({ error: 'CCB deve estar gerado antes do envio ao ClickSign' });
    }

    // Check if already sent to ClickSign
    if (proposta.clicksignDocumentKey) {
      return res.status(400).json({ 
        error: 'CCB já foi enviado ao ClickSign',
        clicksignStatus: proposta.clicksignStatus,
        clicksignSignUrl: proposta.clicksignSignUrl
      });
    }

    // 2. Get CCB file from Supabase Storage
    const ccbUrl = await storage.getCcbUrl(propostaId);
    if (!ccbUrl) {
      return res.status(404).json({ error: 'CCB não encontrado no storage' });
    }

    // Download CCB as buffer
    const ccbResponse = await fetch(ccbUrl);
    if (!ccbResponse.ok) {
      throw new Error(`Failed to download CCB: ${ccbResponse.status}`);
    }
    const ccbBuffer = Buffer.from(await ccbResponse.arrayBuffer());

    // 3. Prepare client data
    const clienteData = JSON.parse(proposta.clienteData || '{}');
    const clientData = {
      name: clienteData.nomeCompleto || proposta.clienteNome,
      email: clienteData.email || proposta.clienteEmail,
      cpf: clienteData.cpf || proposta.clienteCpf,
      phone: clienteData.telefone || proposta.clienteTelefone
    };

    // Validate required client data
    if (!clientData.name || !clientData.email || !clientData.cpf) {
      return res.status(400).json({ 
        error: 'Dados do cliente incompletos para envio ao ClickSign',
        missingFields: {
          name: !clientData.name,
          email: !clientData.email,
          cpf: !clientData.cpf
        }
      });
    }

    // 4. Send to ClickSign
    const filename = `CCB-${propostaId}-${Date.now()}.pdf`;
    const clickSignResult = await clickSignService.sendCCBForSignature(
      ccbBuffer,
      filename,
      clientData
    );

    // 5. Update proposal with ClickSign data
    await storage.updateProposta(propostaId, {
      clicksignDocumentKey: clickSignResult.documentKey,
      clicksignSignerKey: clickSignResult.signerKey,
      clicksignListKey: clickSignResult.listKey,
      clicksignStatus: 'pending',
      clicksignSignUrl: clickSignResult.signUrl,
      clicksignSentAt: new Date(getBrasiliaTimestamp())
    });

    console.log(`[CLICKSIGN] ✅ CCB sent successfully for proposal: ${propostaId}`);

    res.json({
      success: true,
      message: 'CCB enviado ao ClickSign com sucesso',
      clickSignData: {
        documentKey: clickSignResult.documentKey,
        status: 'pending',
        signUrl: clickSignResult.signUrl
      }
    });

  } catch (error) {
    console.error(`[CLICKSIGN] ❌ Error sending CCB:`, error);
    res.status(500).json({ 
      error: 'Erro ao enviar CCB para ClickSign',
      details: (error as Error).message 
    });
  }
});

/**
 * Get ClickSign status for a proposal
 * GET /api/clicksign/status/:propostaId
 */
router.get('/status/:propostaId', jwtAuthMiddleware, async (req, res) => {
  try {
    const { propostaId } = req.params;
    
    const proposta = await storage.getPropostaById(propostaId);
    if (!proposta) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    if (!proposta.clicksignDocumentKey) {
      return res.json({
        status: 'not_sent',
        message: 'CCB não foi enviado ao ClickSign ainda'
      });
    }

    // Get current status from ClickSign
    let clickSignStatus = null;
    try {
      clickSignStatus = await clickSignService.getDocumentStatus(proposta.clicksignDocumentKey);
    } catch (error) {
      console.error(`[CLICKSIGN] Error getting status:`, error);
    }

    res.json({
      propostaId,
      clickSignData: {
        documentKey: proposta.clicksignDocumentKey,
        signerKey: proposta.clicksignSignerKey,
        listKey: proposta.clicksignListKey,
        status: proposta.clicksignStatus,
        signUrl: proposta.clicksignSignUrl,
        sentAt: proposta.clicksignSentAt,
        signedAt: proposta.clicksignSignedAt
      },
      externalStatus: clickSignStatus
    });

  } catch (error) {
    console.error(`[CLICKSIGN] Error getting status:`, error);
    res.status(500).json({ 
      error: 'Erro ao consultar status ClickSign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Webhook endpoint for ClickSign notifications
 * POST /api/clicksign/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log(`[CLICKSIGN WEBHOOK] Received notification:`, req.body);

    const { event, data } = req.body;
    
    if (!event || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Find proposal by ClickSign document or list key
    const documentKey = data.document?.key;
    const listKey = data.list?.key;
    
    let proposta = null;
    if (documentKey) {
      proposta = await storage.getPropostaByClickSignKey('document', documentKey);
    } else if (listKey) {
      proposta = await storage.getPropostaByClickSignKey('list', listKey);
    }

    if (!proposta) {
      console.log(`[CLICKSIGN WEBHOOK] Proposal not found for keys: doc=${documentKey}, list=${listKey}`);
      return res.status(404).json({ error: 'Proposal not found' });
    }

    console.log(`[CLICKSIGN WEBHOOK] Processing event '${event}' for proposal: ${proposta.id}`);

    // Process different events
    const updateData: any = {};
    
    switch (event) {
      case 'sign':
        updateData.clicksignStatus = 'signed';
        updateData.clicksignSignedAt = getBrasiliaTimestamp();
        updateData.assinaturaEletronicaConcluida = true;
        updateData.dataAssinatura = getBrasiliaTimestamp();
        
        // Move to next stage (biometry)
        updateData.status = 'contratos_assinados';
        
        console.log(`[CLICKSIGN WEBHOOK] ✅ Document signed for proposal: ${proposta.id}`);
        
        // 🚀 NOVO: Gerar boleto automaticamente após assinatura da CCB
        try {
          console.log(`[CLICKSIGN → INTER] Generating boleto for signed CCB: ${proposta.id}`);
          
          // Verificar se já existe cobrança para esta proposta
          const existingCollection = await storage.getInterCollectionByProposalId(proposta.id);
          if (!existingCollection) {
            
            // Obter dados do cliente da proposta
            const clienteData = typeof proposta.clienteData === 'string' 
              ? JSON.parse(proposta.clienteData) 
              : proposta.clienteData || {};
            
            const condicoesData = typeof proposta.condicoesData === 'string'
              ? JSON.parse(proposta.condicoesData)
              : proposta.condicoesData || {};

            // Dados para criação do boleto conforme API oficial Inter Bank
            const boletoData = {
              seuNumero: proposta.id.slice(0, 15), // Max 15 chars
              valorNominal: parseFloat(String(condicoesData.valorTotalFinanciado || condicoesData.valor || 0)),
              dataVencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
              numDiasAgenda: 60, // Cancelamento automático após 60 dias do vencimento
              pagador: {
                cpfCnpj: clienteData.cpf?.replace(/\D/g, '') || '',
                tipoPessoa: 'FISICA' as const,
                nome: clienteData.nome || '',
                email: clienteData.email || '',
                ddd: clienteData.telefone ? clienteData.telefone.replace(/\D/g, '').slice(0, 2) : '',
                telefone: clienteData.telefone ? clienteData.telefone.replace(/\D/g, '').slice(2) : '',
                endereco: clienteData.logradouro || clienteData.endereco || '',
                numero: clienteData.numero || '',
                complemento: clienteData.complemento || '',
                bairro: clienteData.bairro || 'Centro',
                cidade: clienteData.cidade || 'São Paulo',
                uf: clienteData.uf || 'SP',
                cep: clienteData.cep?.replace(/\D/g, '') || ''
              },
              mensagem: {
                linha1: `Pagamento referente ao empréstimo`,
                linha2: `Proposta: ${proposta.id}`,
                linha3: `SIMPIX - Soluções Financeiras`
              },
              formasRecebimento: ['BOLETO', 'PIX'] as ('BOLETO' | 'PIX')[]
            };

            // Criar cobrança no Inter Bank usando método oficial
            const createResponse = await interBankService.emitirCobranca(boletoData);
            
            // Aguardar um momento e consultar os detalhes completos
            console.log(`[CLICKSIGN → INTER] Waiting for collection details: ${createResponse.codigoSolicitacao}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
            
            const interCollection = await interBankService.recuperarCobranca(createResponse.codigoSolicitacao);
            
            // Salvar no banco de dados
            await storage.createInterCollection({
              propostaId: proposta.id,
              codigoSolicitacao: createResponse.codigoSolicitacao,
              seuNumero: boletoData.seuNumero,
              valorNominal: String(boletoData.valorNominal),
              dataVencimento: boletoData.dataVencimento,
              situacao: interCollection.cobranca.situacao,
              dataSituacao: interCollection.cobranca.dataSituacao,
              nossoNumero: interCollection.boleto?.nossoNumero || '',
              codigoBarras: interCollection.boleto?.codigoBarras || '',
              linhaDigitavel: interCollection.boleto?.linhaDigitavel || '',
              pixTxid: interCollection.pix?.txid || '',
              pixCopiaECola: interCollection.pix?.pixCopiaECola || '',
              dataEmissao: interCollection.cobranca.dataEmissao || new Date().toISOString().split('T')[0],
              isActive: true
            });

            console.log(`[CLICKSIGN → INTER] ✅ Boleto created successfully: ${createResponse.codigoSolicitacao}`);
            
            // Log da geração do boleto
            await storage.createPropostaLog({
              propostaId: proposta.id,
              autorId: 'clicksign-webhook',
              statusAnterior: proposta.status,
              statusNovo: 'contratos_assinados',
              observacao: `Boleto gerado automaticamente após assinatura CCB - Código: ${createResponse.codigoSolicitacao}`
            });
            
          } else {
            console.log(`[CLICKSIGN → INTER] Boleto already exists for proposal: ${proposta.id}`);
          }
          
        } catch (boletoError) {
          console.error(`[CLICKSIGN → INTER] ❌ Error generating boleto for proposal ${proposta.id}:`, boletoError);
          
          // Log do erro mas não bloquear o webhook
          await storage.createPropostaLog({
            propostaId: proposta.id,
            autorId: 'clicksign-webhook',
            statusAnterior: proposta.status,
            statusNovo: 'contratos_assinados',
            observacao: `Erro ao gerar boleto automaticamente: ${(boletoError as Error).message}`
          });
        }
        
        break;

      case 'cancel':
        updateData.clicksignStatus = 'cancelled';
        console.log(`[CLICKSIGN WEBHOOK] ❌ Signature cancelled for proposal: ${proposta.id}`);
        break;

      case 'deadline':
        updateData.clicksignStatus = 'expired';
        console.log(`[CLICKSIGN WEBHOOK] ⏰ Signature expired for proposal: ${proposta.id}`);
        break;

      default:
        console.log(`[CLICKSIGN WEBHOOK] Unhandled event: ${event}`);
        break;
    }

    // Update proposal with new status
    if (Object.keys(updateData).length > 0) {
      await storage.updateProposta(proposta.id, updateData);
      
      // Log the status change
      await storage.createPropostaLog({
        propostaId: proposta.id,
        autorId: 'clicksign-webhook',
        statusAnterior: proposta.status,
        statusNovo: updateData.status || proposta.status,
        observacao: `ClickSign webhook: ${event} - ${data.message || 'Status updated'}`
      });
    }

    res.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error(`[CLICKSIGN WEBHOOK] ❌ Error processing webhook:`, error);
    res.status(500).json({ 
      error: 'Erro ao processar webhook ClickSign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test ClickSign connection
 * GET /api/clicksign/test
 */
router.get('/test', jwtAuthMiddleware, async (req, res) => {
  try {
    const isConnected = await clickSignService.testConnection();
    
    res.json({
      connected: isConnected,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      message: isConnected ? 'ClickSign conectado com sucesso' : 'Falha na conexão com ClickSign'
    });

  } catch (error) {
    console.error(`[CLICKSIGN] Connection test error:`, error);
    res.status(500).json({ 
      error: 'Erro ao testar conexão ClickSign',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as clickSignRouter };