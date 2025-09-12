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
// SECURITY V2.0 - Replace console.log with SecureLogger
import { SecureLogger } from '../modules/shared/infrastructure/SanitizedLogger';

// Utility functions to mask sensitive data in logs (SECURITY FIX)
function maskCPF(cpf: string): string {
  if (!cpf || cpf.length < 11) return '***.***.***-**';
  const cleanCpf = cpf.replace(/\D/g, '');
  return `***.***.***-${cleanCpf.slice(-2)}`;
}

function maskClientName(name: string): string {
  if (!name || name.length < 2) return '*****';
  return `${name.charAt(0)}${'*'.repeat(Math.max(1, name.length - 2))}${name.charAt(name.length - 1)}`;
}

// Validation schemas - UPDATED FOR MULTIPLE BOLETOS
const createCollectionSchema = z.object({
  proposalId: z.string(),
  // clienteData is now optional - will be extracted from proposal
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
  }).optional(),
});

export class InterService {
  /**
   * Test Inter Bank connection
   */
  async testConnection(): Promise<boolean> {
    return await interBankService.testConnection();
  }

  /**
   * Create boletos for loan proposal - FIXED: Generate multiple boletos based on installments
   */
  async createCollection(data: any, userId?: string): Promise<InterCollection[]> {
    // Validate input
    const validated = createCollectionSchema.parse(data);

    // Check if proposal exists
    const proposal = await interRepository.getProposal(validated.proposalId);
    if (!proposal) {
      throw new Error('Proposta não encontrada');
    }

    SecureLogger.info(`Creating boletos for proposal: ${validated.proposalId}`, {
      proposal: {
        client: maskClientName(proposal.clienteNome),
        cpf: maskCPF(proposal.clienteCpf),
        amount: proposal.valor,
        installments: proposal.prazo
      }
    });

    // Check for existing collections
    const existingCollection = await interRepository.findByProposalId(validated.proposalId);
    if (existingCollection) {
      throw new Error('Já existem boletos para esta proposta');
    }

    // Get installments from database
    const parcelas = await interRepository.getParcelas(validated.proposalId);
    if (!parcelas || parcelas.length === 0) {
      throw new Error('Parcelas não encontradas para esta proposta');
    }

    SecureLogger.info(`Found ${parcelas.length} installments for proposal`, { proposalId: validated.proposalId, totalInstallments: parcelas.length });

    // Extract client data from proposal (use real data, not manual input)
    const clienteData = {
      nome: proposal.clienteNome,
      cpf: proposal.clienteCpf.replace(/\D/g, ''),
      email: proposal.clienteEmail || 'cliente@example.com',
      telefone: proposal.clienteTelefone?.replace(/\D/g, '') || '27998538565',
      endereco: proposal.clienteLogradouro || proposal.clienteEndereco || 'Endereço não informado',
      numero: proposal.clienteNumero || '100',
      complemento: proposal.clienteComplemento || '',
      bairro: proposal.clienteBairro || 'Centro',
      cidade: proposal.clienteCidade || 'Serra',
      uf: proposal.clienteUf || 'ES',
      cep: proposal.clienteCep?.replace(/\D/g, '') || '29165460',
    };

    const createdCollections: InterCollection[] = [];
    let successCount = 0;
    let failCount = 0;

    // Create one boleto per installment (REAL DATA)
    for (const parcela of parcelas) {
      try {
        SecureLogger.debug(`Creating boleto for installment ${parcela.numeroParcela}/${parcelas.length}`, {
          installment: parcela.numeroParcela,
          total: parcelas.length,
          amount: parcela.valorParcela,
          dueDate: parcela.dataVencimento
        });

        // Create boleto in Inter Bank API
        const interResult = await interBankService.criarCobrancaParaProposta({
          id: validated.proposalId,
          valorTotal: Number(parcela.valorParcela),
          dataVencimento: parcela.dataVencimento,
          clienteData: clienteData,
        });

        // Fetch detailed collection info
        const detailedResult = await (interBankService as any).recuperarCobranca(interResult.codigoSolicitacao);

        // Save collection to database
        const collection = await interRepository.createCollection({
          propostaId: validated.proposalId,
          codigoSolicitacao: interResult.codigoSolicitacao,
          seuNumero: `${validated.proposalId}-${String(parcela.numeroParcela).padStart(3, '0')}`,
          valorNominal: String(parcela.valorParcela),
          dataVencimento: parcela.dataVencimento,
          situacao: detailedResult.cobranca?.situacao || 'EM_PROCESSAMENTO',
          linhaDigitavel: detailedResult.linhaDigitavel || detailedResult.boleto?.linhaDigitavel,
          pixCopiaECola: detailedResult.pixCopiaECola || detailedResult.pix?.pixCopiaECola,
          dataEmissao: getBrasiliaTimestamp(),
          numeroParcela: parcela.numeroParcela,
          totalParcelas: parcelas.length,
        });

        createdCollections.push(collection);
        successCount++;
        SecureLogger.info(`Boleto ${parcela.numeroParcela} created successfully`);

      } catch (error) {
        failCount++;
        SecureLogger.error(`Failed to create boleto for installment ${parcela.numeroParcela}`, error);
        // Continue with next installment
      }
    }

    if (createdCollections.length === 0) {
      throw new Error('Nenhum boleto foi criado com sucesso');
    }

    // Update proposal status
    await interRepository.updateProposalStatus(validated.proposalId, 'BOLETOS_EMITIDOS', userId);

    // Create observation history
    await interRepository.createObservationHistory({
      propostaId: validated.proposalId,
      mensagem: `${successCount} boletos gerados com sucesso. ${failCount} falharam. Cliente: ${maskClientName(clienteData.nome)}`,
      criadoPor: 'Sistema',
      tipoAcao: 'BOLETOS_GERADOS',
      dadosAcao: { 
        boletosGerados: successCount, 
        boletos: createdCollections.map(c => c.codigoSolicitacao),
        usuarioId: userId 
      },
    });

    SecureLogger.info(`Successfully created ${successCount} boletos for proposal ${validated.proposalId}`, {
      successCount,
      failCount,
      proposalId: validated.proposalId
    });
    return createdCollections;
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
      mensagem: `Cobrança cancelada. Motivo: ${motivo}`,
      criadoPor: 'Sistema',
      tipoAcao: 'COBRANÇA_CANCELADA',
      dadosAcao: { motivo, usuarioId: userId },
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
          mensagem: `Vencimento prorrogado para ${novaDataVencimento}`,
          criadoPor: 'Sistema',
          tipoAcao: 'VENCIMENTO_PRORROGADO',
          dadosAcao: { novaDataVencimento, usuarioId: userId },
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
        mensagem: 'Pagamento confirmado via webhook Banco Inter',
        criadoPor: 'Sistema',
        tipoAcao: 'PAGAMENTO_CONFIRMADO',
        dadosAcao: webhookData,
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
        const details = await (interBankService as any).getCollectionDetails(
          collection.codigoSolicitacao
        );

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
