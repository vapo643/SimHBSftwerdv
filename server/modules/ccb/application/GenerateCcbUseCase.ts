/**
 * Use Case: Gerar CCB (Cédula de Crédito Bancário)
 *
 * Orquestra a geração de CCB com auditoria completa
 * PAM V1.0 - Remediação de Segurança Crítica
 * Implementa trilha de auditoria mandatória para geração de documentos
 */

import { IUnitOfWork } from '../../shared/domain/IUnitOfWork';
import { auditService } from '../../../services/auditService';

export interface GenerateCcbDTO {
  proposalId: string;
  userId: string;
  templateVersion?: string;
  generateSignatureFields?: boolean;
  metadata?: Record<string, any>;
}

export interface CcbGenerationResult {
  ccbId: string;
  ccbUrl: string;
  documentHash: string;
  generatedAt: Date;
}

export class GenerateCcbUseCase {
  constructor(private unitOfWork: IUnitOfWork) {}

  async execute(dto: GenerateCcbDTO): Promise<CcbGenerationResult> {
    return await this.unitOfWork.executeInTransaction(async () => {
      console.log(
        `[GENERATE CCB USE CASE] Iniciando geração de CCB para proposta ${dto.proposalId}`
      );

      // 1. Buscar proposta
      const proposal = await this.unitOfWork.proposals.findById(dto.proposalId);

      if (!proposal) {
        throw new Error(`Proposta ${dto.proposalId} não encontrada`);
      }

      // 2. Validar status da proposta
      if (proposal.status !== 'aprovado') {
        throw new Error(
          `CCB só pode ser gerada para propostas aprovadas. Status atual: ${proposal.status}`
        );
      }

      // 3. Verificar se já existe CCB para esta proposta
      const existingCcbs = await this.unitOfWork.ccbs.findByPropostaId(dto.proposalId, dto.userId);
      if (existingCcbs.length > 0) {
        const existingCcb = existingCcbs[0]; // Pega a primeira CCB encontrada
        console.warn(`[GENERATE CCB USE CASE] CCB já existe para proposta ${dto.proposalId}`);
        return {
          ccbId: existingCcb.id,
          ccbUrl: existingCcb.urlDocumentoOriginal || '',
          documentHash: existingCcb.hashDocumento || '',
          generatedAt: existingCcb.createdAt || new Date(),
        };
      }

      // 4. Gerar documento CCB (simplificado - normalmente chamaria serviço de geração)
      const ccbId = `ccb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ccbUrl = `/documents/ccb/${ccbId}.pdf`;
      const documentHash = `hash_${Date.now()}`;
      const generatedAt = new Date();

      // 5. Salvar CCB no repositório
      const ccbData = {
        id: ccbId,
        propostaId: dto.proposalId,
        numeroCCB: `CCB-${Date.now()}`, // Número único da CCB
        valorCCB: '0.00', // Será preenchido com valor da proposta
        status: 'gerada',
        urlDocumentoOriginal: ccbUrl,
        hashDocumento: documentHash,
        versaoTemplate: dto.templateVersion || '1.0',
        criadoPor: dto.userId,
        observacoes: `Gerada automaticamente via ${dto.metadata?.useCase || 'GenerateCcbUseCase'}`,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        deletedAt: null,
      } as any;

      await this.unitOfWork.ccbs.save(ccbData);

      // 6. Atualizar status da proposta
      (proposal as any)._status = 'ccb_gerada';
      (proposal as any)._ccbUrl = ccbUrl;
      (proposal as any)._updatedAt = generatedAt;

      await this.unitOfWork.proposals.save(proposal);

      // 7. AUDITORIA MANDATÓRIA - Registrar geração
      try {
        await auditService.logStatusTransition({
          propostaId: dto.proposalId,
          fromStatus: 'aprovado',
          toStatus: 'ccb_gerada',
          triggeredBy: 'api',
          userId: dto.userId,
          metadata: {
            ...dto.metadata,
            ccbId,
            ccbUrl,
            documentHash,
            templateVersion: dto.templateVersion,
            useCase: 'GenerateCcbUseCase',
            securityContext: 'CCB_GENERATION',
            timestamp: generatedAt.toISOString(),
          },
        });

        console.log(`[GENERATE CCB USE CASE] ✅ Auditoria de geração registrada com sucesso`);
      } catch (auditError: any) {
        console.error(`[GENERATE CCB USE CASE] ❌ Falha crítica na auditoria:`, auditError);
        // Falha na auditoria deve quebrar a transação (segurança crítica)
        throw new Error(
          `Falha crítica na auditoria de CCB: ${auditError?.message || 'Erro desconhecido'}`
        );
      }

      console.log(`[GENERATE CCB USE CASE] ✅ CCB gerada com sucesso: ${ccbId}`);

      return {
        ccbId,
        ccbUrl,
        documentHash,
        generatedAt,
      };
    });
  }
}
