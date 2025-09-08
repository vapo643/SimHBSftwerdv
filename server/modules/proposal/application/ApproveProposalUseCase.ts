/**
 * Use Case: Aprovar Proposta
 *
 * Orquestra a aprovação de uma proposta por um analista
 * Refatorado para usar Unit of Work - Garantia de Atomicidade
 * 
 * PAM V1.0 - BLINDAGEM DO WORKFLOW:
 * Implementa validação de pré-condições para garantir dados necessários
 * à formalização antes da aprovação
 */

import { IProposalRepository } from '../domain/IProposalRepository';
import { DocumentsRepository } from '../../../repositories/documents.repository';
import { DomainException } from '../../shared/domain/DomainException';

export interface ApproveProposalDTO {
  proposalId: string;
  analistaId: string;
  observacoes?: string;
}

export class ApproveProposalUseCase {
  constructor(
    private repository: IProposalRepository,
    private documentsRepository: DocumentsRepository
  ) {}

  async execute(dto: ApproveProposalDTO): Promise<void> {
    // Buscar agregado usando repositório
    const proposal = await this.repository.findById(dto.proposalId);

    if (!proposal) {
      throw new Error(`Proposta ${dto.proposalId} não encontrada`);
    }

    // PAM V1.0 - VALIDAÇÃO DE PRÉ-CONDIÇÕES PARA FORMALIZAÇÃO
    await this.validateFormalizationRequirements(dto.proposalId);

    // Executar comando de negócio no agregado
    proposal.approve(dto.analistaId, dto.observacoes);

    // Persistir mudanças
    await this.repository.save(proposal);
  }

  /**
   * Valida pré-condições necessárias para aprovação
   * Garante que a proposta tem documentos e dados financeiros para formalização
   */
  private async validateFormalizationRequirements(proposalId: string): Promise<void> {
    // 1. Verificar se existem documentos carregados
    const documentos = await this.documentsRepository.getProposalDocuments(proposalId);
    
    if (!documentos || documentos.length === 0) {
      throw new DomainException(
        'A proposta não pode ser aprovada sem documentos. É necessário carregar ao menos um documento antes da aprovação.'
      );
    }

    // 2. Verificar se existem condições financeiras definidas
    const propostaData = await this.documentsRepository.getProposalById(proposalId);
    
    if (!propostaData) {
      throw new DomainException('Dados da proposta não encontrados para validação.');
    }

    // Verificar se condicoes_data não está nulo e contém dados essenciais
    if (!propostaData.condicoes_data || 
        typeof propostaData.condicoes_data !== 'object' ||
        Object.keys(propostaData.condicoes_data).length === 0) {
      throw new DomainException(
        'A proposta não pode ser aprovada sem as condições financeiras definidas (valor, prazo, finalidade). É necessário completar os dados de formalização antes da aprovação.'
      );
    }

    // Verificar campos essenciais dentro de condicoes_data
    const condicoes = propostaData.condicoes_data;
    const camposEssenciais = ['valor', 'prazo'];
    const camposFaltando = camposEssenciais.filter(campo => !condicoes[campo]);
    
    if (camposFaltando.length > 0) {
      throw new DomainException(
        `A proposta não pode ser aprovada. Campos obrigatórios em falta: ${camposFaltando.join(', ')}. Complete os dados financeiros antes da aprovação.`
      );
    }

    // Log de validação bem-sucedida
    console.log(`✅ [BLINDAGEM] Pré-condições validadas para proposta ${proposalId}: ${documentos.length} documentos, condições financeiras completas`);
  }
}
