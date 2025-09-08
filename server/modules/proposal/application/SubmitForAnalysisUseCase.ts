// server/modules/proposal/application/SubmitForAnalysisUseCase.ts
import { IProposalRepository } from '../domain/IProposalRepository';
import { Proposal } from '../domain/Proposal'; // Importe o agregado canónico

interface ISubmitForAnalysisRequest {
  proposalId: string;
  // Adicione outros parâmetros se necessário, ex: userId
}

export class SubmitForAnalysisUseCase {
  private proposalRepository: IProposalRepository;

  constructor(proposalRepository: IProposalRepository) {
    this.proposalRepository = proposalRepository;
  }

  async execute({ proposalId }: ISubmitForAnalysisRequest): Promise<void> {
    // 1. Carregar o agregado
    const proposal = await this.proposalRepository.findById(proposalId);

    if (!proposal) {
      throw new Error('Proposta não encontrada.'); // Lançar exceção de domínio mais específica no futuro
    }

    // 2. Executar a regra de negócio no domínio
    proposal.submitForAnalysis(); // Ou o nome do método que você validou/criou na Fase 1

    // 3. Persistir as alterações
    await this.proposalRepository.save(proposal);

    // 4. (Opcional, mas recomendado) Despachar eventos de domínio aqui no futuro
  }
}
