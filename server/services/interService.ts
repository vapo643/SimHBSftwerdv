/**
 * Inter Bank Service
 * Business logic for Inter Bank collections and payments
 * PAM V1.0 - Service layer implementation
 */

import { interRepository } from '../repositories/inter.repository.js';
import { interBankService } from './interBankService.js';
import { storage } from '../storage.js';
import { getQueue } from '../lib/mock-queue.js';
import { getBrasiliaTimestamp } from '../lib/timezone.js';
import { z } from 'zod';
import type { InterCollection, Proposta } from '@shared/schema';

// Validation schemas
const createCollectionSchema = z.object({
  proposalId: z.string(),
  valorTotal: z.number().min(2.5).max(99999999.99),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clienteData: z.object({
    nome: z.string().min(1),
    cpf: z.string().min(11),
    email: z.string().email(),
    telefone: z.string().optional(),
    endereco: z.string().min(1),
    numero: z.string().min(1),
    complemento: z.string().optional(),
    bairro: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
    cep: z.string().min(8),
  }),
});

export class InterService {
  /**
   * Test Inter Bank connection
   */
  async testConnection(): Promise<boolean> {
    return await interBankService.testConnection();
  }

  /**
   * Create a new collection (boleto/PIX)
   */
  async createCollection(data: any, userId?: string): Promise<InterCollection> {
    // Validate input
    const validated = createCollectionSchema.parse(data);

    // Check if proposal exists
    const proposal = await interRepository.getProposal(validated.proposalId);
    if (!proposal) {
      throw new Error('Proposta não encontrada');
    }

    // Check for existing collection
    const existingCollection = await interRepository.findByProposalId(validated.proposalId);
    if (existingCollection) {
      throw new Error('Já existe uma cobrança para esta proposta');
    }

    // Create collection in Inter Bank
    const interResult = await (interBankService as any).createCollection({
      seuNumero: `PROP-${validated.proposalId}`,
      valorNominal: validated.valorTotal,
      dataVencimento: validated.dataVencimento,
      numDiasAgenda: 30,
      pagador: {
        cpfCnpj: validated.clienteData.cpf.replace(/\D/g, ''),
        nome: validated.clienteData.nome,
        email: validated.clienteData.email,
        telefone: validated.clienteData.telefone,
        endereco: validated.clienteData.endereco,
        numero: validated.clienteData.numero,
        complemento: validated.clienteData.complemento,
        bairro: validated.clienteData.bairro,
        cidade: validated.clienteData.cidade,
        uf: validated.clienteData.uf,
        cep: validated.clienteData.cep.replace(/\D/g, ''),
      },
      mensagem: {
        linha1: `Proposta: ${validated.proposalId}`,
        linha2: 'Pagamento via Banco Inter',
      },
    });

    // Save collection to database
    const collection = await interRepository.createCollection({
      propostaId: validated.proposalId,
      codigoSolicitacao: interResult.codigoSolicitacao,
      seuNumero: interResult.seuNumero,
      valorNominal: String(validated.valorTotal),
      dataVencimento: validated.dataVencimento,
      situacao: interResult.situacao,
      linhaDigitavel: interResult.linhaDigitavel,
      pixCopiaECola: interResult.pix?.pixCopiaECola,
      dataEmissao: getBrasiliaTimestamp(),
      // Store additional data in metadata field if needed
    });

    // Update proposal status
    await interRepository.updateProposalStatus(validated.proposalId, 'COBRANÇA_GERADA', userId);

    // Create observation history
    await interRepository.createObservationHistory({
      propostaId: validated.proposalId,
      // tipoObservacao: 'COBRANÇA_GERADA',
      mensagem: `Cobrança gerada com sucesso. Código: ${interResult.codigoSolicitacao}`,
      criadoPor: 'Sistema',
      usuarioId: userId,
      metadata: { codigoSolicitacao: interResult.codigoSolicitacao },
    });

    return collection;
  }

  /**
   * Search collections with filters
   */
  async searchCollections(params: any): Promise<{
    collections: InterCollection[];
    totalPages: number;
    currentPage: number;
  }> {
    const limit = parseInt(params.limit || '10');
    const page = parseInt(params.page || '1');
    const offset = (page - 1) * limit;

    const collections = await interRepository.searchCollections({
      ...params,
      limit,
      offset,
    });

    // Get total count for pagination
    const allCollections = await interRepository.searchCollections(params);
    const totalPages = Math.ceil(allCollections.length / limit);

    return {
      collections,
      totalPages,
      currentPage: page,
    };
  }

  /**
   * Get collection details by codigoSolicitacao
   */
  async getCollectionDetails(codigoSolicitacao: string): Promise<any> {
    // Get from database
    const collection = await interRepository.findByCodigoSolicitacao(codigoSolicitacao);
    if (!collection) {
      throw new Error('Cobrança não encontrada');
    }

    // Get updated info from Inter Bank
    const interDetails = await (interBankService as any).getCollectionDetails(codigoSolicitacao);

    // Update local database with latest status
    if (interDetails.situacao !== collection.situacao) {
      await interRepository.updateByCodigoSolicitacao(codigoSolicitacao, {
        situacao: interDetails.situacao,
        dataSituacao: interDetails.dataHoraSituacao,
      });
    }

    return {
      ...collection,
      interDetails,
    };
  }

  /**
   * Cancel collection
   */
  async cancelCollection(
    codigoSolicitacao: string,
    motivo: string,
    userId?: string
  ): Promise<InterCollection> {
    // Get collection
    const collection = await interRepository.findByCodigoSolicitacao(codigoSolicitacao);
    if (!collection) {
      throw new Error('Cobrança não encontrada');
    }

    // Cancel in Inter Bank
    await (interBankService as any).cancelCollection(codigoSolicitacao, motivo);

    // Update database
    const updated = await interRepository.updateByCodigoSolicitacao(codigoSolicitacao, {
      situacao: 'CANCELADO',
      motivoCancelamento: motivo,
    });

    // Update proposal status
    await interRepository.updateProposalStatus(collection.propostaId, 'COBRANÇA_CANCELADA', userId);

    // Create observation history
    await interRepository.createObservationHistory({
      propostaId: collection.propostaId,
      tipoObservacao: 'COBRANÇA_CANCELADA',
      mensagem: `Cobrança cancelada. Motivo: ${motivo}`,
      criadoPor: 'Sistema',
      usuarioId: userId,
      metadata: { motivo },
    });

    return updated!;
  }

  /**
   * Batch extend due dates
   */
  async batchExtendDueDates(
    codigosSolicitacao: string[],
    novaDataVencimento: string,
    userId?: string
  ): Promise<{
    success: any[];
    errors: any[];
  }> {
    const results = [];
    const errors = [];

    for (const codigoSolicitacao of codigosSolicitacao) {
      try {
        // Get collection
        const collection = await interRepository.findByCodigoSolicitacao(codigoSolicitacao);
        if (!collection) {
          errors.push({
            codigoSolicitacao,
            error: 'Cobrança não encontrada',
          });
          continue;
        }

        // Extend in Inter Bank
        const extended = await (interBankService as any).extendDueDate(
          codigoSolicitacao,
          novaDataVencimento
        );

        // Update database
        await interRepository.updateByCodigoSolicitacao(codigoSolicitacao, {
          dataVencimento: novaDataVencimento,
          situacao: extended.situacao,
        });

        // Create observation history
        await interRepository.createObservationHistory({
          propostaId: collection.propostaId,
          // tipoObservacao: 'VENCIMENTO_PRORROGADO',
          mensagem: `Vencimento prorrogado para ${novaDataVencimento}`,
          criadoPor: 'Sistema',
          usuarioId: userId,
          metadata: { novaDataVencimento },
        });

        results.push({
          codigoSolicitacao,
          success: true,
          novaDataVencimento,
        });
      } catch (error: any) {
        errors.push({
          codigoSolicitacao,
          error: error.message,
        });
      }
    }

    return { success: results, errors };
  }

  /**
   * Generate collection PDF
   */
  async generateCollectionPDF(codigoSolicitacao: string): Promise<Buffer> {
    // Get collection details
    const collection = await interRepository.findByCodigoSolicitacao(codigoSolicitacao);
    if (!collection) {
      throw new Error('Cobrança não encontrada');
    }

    // Generate PDF from Inter Bank
    const pdfBuffer = await (interBankService as any).downloadCollectionPDF(codigoSolicitacao);

    // Save to storage
    const path = `collections/${collection.propostaId}/${codigoSolicitacao}.pdf`;
    await interRepository.uploadToStorage('private-documents', path, pdfBuffer, 'application/pdf');

    return pdfBuffer;
  }

  /**
   * Process webhook from Inter Bank
   */
  async processWebhook(webhookData: any): Promise<void> {
    const { codigoSolicitacao, situacao } = webhookData;

    // Update collection status
    const collection = await interRepository.findByCodigoSolicitacao(codigoSolicitacao);
    if (!collection) {
      console.error(`Collection not found for webhook: ${codigoSolicitacao}`);
      return;
    }

    // Update status
    await interRepository.updateByCodigoSolicitacao(codigoSolicitacao, {
      situacao,
      dataSituacao: getBrasiliaTimestamp(),
    });

    // Handle payment confirmation
    if (situacao === 'RECEBIDO') {
      // Update proposal status
      await interRepository.updateProposalStatus(collection.propostaId, 'PAGAMENTO_CONFIRMADO');

      // Create observation
      await interRepository.createObservationHistory({
        propostaId: collection.propostaId,
        // tipoObservacao: 'PAGAMENTO_CONFIRMADO',
        mensagem: 'Pagamento confirmado via webhook Banco Inter',
        criadoPor: 'Sistema',
        metadata: webhookData,
      });

      // Queue for further processing
      const queue = getQueue('payment-processing');
      await queue.add('process-payment', {
        propostaId: collection.propostaId,
        codigoSolicitacao,
        valorPago: collection.valorNominal,
      });
    }
  }

  /**
   * Sync collections status
   */
  async syncCollectionsStatus(): Promise<{
    updated: number;
    errors: number;
  }> {
    let updated = 0;
    let errors = 0;

    // Get collections pending payment
    const collections = await interRepository.getCollectionsPendingPayment(100);

    for (const collection of collections) {
      try {
        // Get updated status from Inter
        const details = await (interBankService as any).getCollectionDetails(collection.codigoSolicitacao);

        // Update if changed
        if (details.situacao !== collection.situacao) {
          await interRepository.updateByCodigoSolicitacao(collection.codigoSolicitacao, {
            situacao: details.situacao,
            dataSituacao: details.dataHoraSituacao,
          });
          updated++;

          // Handle payment confirmation
          if (details.situacao === 'RECEBIDO') {
            await this.processWebhook({
              codigoSolicitacao: collection.codigoSolicitacao,
              situacao: 'RECEBIDO',
              valorPago: details.valorTotalRecebimento,
            });
          }
        }
      } catch (error) {
        console.error(`Error syncing collection ${collection.codigoSolicitacao}:`, error);
        errors++;
      }
    }

    return { updated, errors };
  }

  /**
   * Get collection statistics
   */
  async getCollectionStatistics(): Promise<any> {
    const collections = await interRepository.searchCollections({});

    const stats = {
      total: collections.length,
      pendentes: 0,
      recebidas: 0,
      canceladas: 0,
      expiradas: 0,
      valorTotal: 0,
      valorRecebido: 0,
    };

    for (const collection of collections) {
      const valor = parseFloat(collection.valorNominal);
      stats.valorTotal += valor;

      switch (collection.situacao) {
        case 'A_RECEBER':
          stats.pendentes++;
          break;
        case 'RECEBIDO':
          stats.recebidas++;
          stats.valorRecebido += valor;
          break;
        case 'CANCELADO':
          stats.canceladas++;
          break;
        case 'EXPIRADO':
          stats.expiradas++;
          break;
      }
    }

    return stats;
  }
}

export const interService = new InterService();
