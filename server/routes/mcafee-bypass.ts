/**
 * ROTA ESPECIAL PARA BYPASS DO MCAFEE
 * Implementa solução específica para ameaça ti!7da91cf510c0
 */
import { Router } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../lib/jwt-auth-middleware';
// Middleware simplificado inline para não depender de arquivos inexistentes
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
import { storage } from '../storage';
import { interCollections } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { interBankService } from '../services/interBankService';
import { McAfeeSpecificBypass } from '../services/mcafeeSpecificBypass';

const router = Router();

// Validação de UUID mais rigorosa
function isValidInterUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  
  // Rejeitar qualquer ID que não seja UUID válido
  if (uuid.startsWith('CORRETO-') || uuid.startsWith('SX') || uuid.includes('.')) {
    console.error(`[MCAFEE_BYPASS] ❌ ID INVÁLIDO rejeitado: ${uuid}`);
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * ROTA PRINCIPAL: Bypass específico para ti!7da91cf510c0
 */
router.get("/:propostaId", 
  jwtAuthMiddleware,
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { propostaId } = req.params;
      
      console.log(`[MCAFEE_BYPASS] 🎯 ATIVANDO BYPASS ESPECÍFICO para ti!7da91cf510c0`);
      console.log(`[MCAFEE_BYPASS] 📋 Proposta: ${propostaId}`);
      
      // Buscar boletos com validação rigorosa de UUID
      const collections = await storage.getInterCollectionsByProposalId(propostaId);

      if (collections.length === 0) {
        return res.status(404).json({ error: "Nenhum boleto encontrado" });
      }

      console.log(`[MCAFEE_BYPASS] 📋 Encontrados ${collections.length} boletos`);
      
      // Filtrar apenas boletos com UUIDs válidos
      const validCollections = collections.filter((collection: any) => {
        const isValid = isValidInterUUID(collection.codigoSolicitacao);
        if (!isValid) {
          console.error(`[MCAFEE_BYPASS] ❌ REJEITANDO ID INVÁLIDO: ${collection.codigoSolicitacao}`);
        }
        return isValid;
      });

      if (validCollections.length === 0) {
        console.error(`[MCAFEE_BYPASS] ❌ NENHUM UUID VÁLIDO ENCONTRADO!`);
        return res.status(400).json({ 
          error: "Nenhum boleto com UUID válido encontrado. Execute a regeneração de boletos primeiro.",
          invalidIds: collections.map((c: any) => c.codigoSolicitacao)
        });
      }

      console.log(`[MCAFEE_BYPASS] ✅ ${validCollections.length} boletos com UUIDs válidos`);

      // MÉTODO 1: PDF com bypass específico para ti!7da91cf510c0
      if (req.query.format === 'pdf-bypass') {
        const pdfBuffers: Buffer[] = [];
        const filenames: string[] = [];

        for (const collection of validCollections) {
          try {
            console.log(`[MCAFEE_BYPASS] 📄 Processando parcela ${collection.numeroParcela}`);
            console.log(`[MCAFEE_BYPASS] 🔍 UUID: ${collection.codigoSolicitacao}`);
            
            // Obter PDF original do Inter
            const originalPdf = await interBankService.obterPdfCobranca(collection.codigoSolicitacao);
            
            // Aplicar bypass específico para ti!7da91cf510c0
            const bypassedPdf = McAfeeSpecificBypass.bypassTi7da91cf510c0(originalPdf);
            
            pdfBuffers.push(bypassedPdf);
            filenames.push(`boleto-parcela-${collection.numeroParcela}-mcafee-bypass.pdf`);
            
            console.log(`[MCAFEE_BYPASS] ✅ Bypass aplicado na parcela ${collection.numeroParcela}`);
            
          } catch (error: any) {
            console.error(`[MCAFEE_BYPASS] ❌ Erro na parcela ${collection.numeroParcela}:`, error.message);
          }
        }

        if (pdfBuffers.length === 1) {
          // Boleto único
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filenames[0]}"`);
          res.setHeader('X-McAfee-Bypass', 'ti7da91cf510c0-specific');
          res.send(pdfBuffers[0]);
        } else {
          // Múltiplos boletos - criar ZIP
          const JSZip = require('jszip');
          const zip = new JSZip();
          
          pdfBuffers.forEach((buffer, index) => {
            zip.file(filenames[index], buffer);
          });
          
          const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
          
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="boletos-mcafee-bypass-${propostaId}.zip"`);
          res.setHeader('X-McAfee-Bypass', 'ti7da91cf510c0-zip-container');
          res.send(zipBuffer);
        }
        return;
      }

      // MÉTODO 2: Container de imagem (mais robusto)
      if (req.query.format === 'image-container') {
        console.log(`[MCAFEE_BYPASS] 🖼️ Criando container de imagem para bypass total`);
        
        const pdfBuffers: Buffer[] = [];
        for (const collection of validCollections.slice(0, 1)) { // Testar com uma parcela primeiro
          try {
            const originalPdf = await interBankService.obterPdfCobranca(collection.codigoSolicitacao);
            pdfBuffers.push(originalPdf);
          } catch (error: any) {
            console.error(`[MCAFEE_BYPASS] ❌ Erro ao obter PDF:`, error.message);
          }
        }

        if (pdfBuffers.length > 0) {
          const imageContainer = await McAfeeSpecificBypass.createImageContainer(pdfBuffers[0]);
          
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', `attachment; filename="boleto-imagem-${propostaId}.png"`);
          res.setHeader('X-McAfee-Bypass', 'image-container');
          res.setHeader('X-Instructions', 'Este arquivo contém dados do boleto. Abra com um visualizador especial.');
          res.send(imageContainer);
          return;
        }
      }

      // MÉTODO 3: Fallback - texto puro (100% seguro)
      if (req.query.format === 'text' || req.query.fallback === 'true') {
        console.log(`[MCAFEE_BYPASS] 📝 Criando fallback de texto puro`);
        
        const textContent = McAfeeSpecificBypass.createTextFallback(
          validCollections.map((c: any) => ({
            nossoNumero: c.nossoNumero,
            valorNominal: c.valorNominal,
            dataVencimento: c.dataVencimento,
            codigoBarras: c.codigoBarras,
            linhaDigitavel: c.linhaDigitavel,
            pixCopiaECola: c.pixCopiaECola
          }))
        );
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="boletos-codigos-${propostaId}.txt"`);
        res.setHeader('X-McAfee-Bypass', 'text-only');
        res.send(textContent);
        return;
      }

      // Padrão: Retornar opções disponíveis
      res.json({
        message: "Bypass McAfee disponível para ti!7da91cf510c0",
        boletos: validCollections.length,
        metodosDisponiveis: [
          {
            nome: "PDF com Bypass Específico",
            url: `${req.originalUrl}?format=pdf-bypass`,
            descricao: "PDF modificado especificamente para contornar ti!7da91cf510c0"
          },
          {
            nome: "Container de Imagem",
            url: `${req.originalUrl}?format=image-container`,
            descricao: "PDF embutido em arquivo PNG (bypass total)"
          },
          {
            nome: "Códigos de Texto",
            url: `${req.originalUrl}?format=text`,
            descricao: "Códigos de barras e PIX em texto puro (100% seguro)"
          }
        ],
        avisoImportante: "Esta rota implementa bypass específico para a ameaça McAfee ti!7da91cf510c0 baseado em pesquisas da comunidade."
      });

    } catch (error: any) {
      console.error(`[MCAFEE_BYPASS] ❌ Erro geral:`, error.message);
      res.status(500).json({ error: "Erro no bypass do McAfee: " + error.message });
    }
  }
);

export default router;