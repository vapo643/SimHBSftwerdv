import { Worker, Job } from 'bullmq';
import logger from '../lib/logger';
import { GenerateCcbUseCase } from '../modules/ccb/application/GenerateCcbUseCase';
import { UnitOfWork } from '../modules/shared/infrastructure/UnitOfWork';
import { getRedisConnectionConfig } from '../lib/redis-config';
// ClickSign service will be imported when needed

interface ProposalApprovedPayload {
  aggregateId: string;
  eventType: string;
  payload: {
    analistaId?: string;
    observacoes?: string;
    approvedAt: string;
  };
  occurredAt: Date;
}

export class FormalizationWorker {
  private worker: Worker;
  private redisConnection: any;

  constructor() {
    // Use centralized Redis configuration
    this.redisConnection = getRedisConnectionConfig();

    this.worker = new Worker(
      'formalization-queue',
      async (job: Job<ProposalApprovedPayload>) => {
        return this.processFormalization(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 5, // Processar até 5 propostas simultaneamente
      }
    );

    this.setupEventHandlers();
  }

  private async processFormalization(job: Job<ProposalApprovedPayload>): Promise<void> {
    const { aggregateId: proposalId } = job.data;
    const startTime = Date.now();

    try {
      logger.info('Starting formalization process', {
        proposalId,
        jobId: job.id,
      });

      // Passo 1: Gerar CCB
      const unitOfWork = new UnitOfWork();
      const generateCcbUseCase = new GenerateCcbUseCase(unitOfWork);

      await generateCcbUseCase.execute({
        proposalId,
        userId: 'system-worker', // Worker system user
      });

      logger.info('CCB generated successfully', {
        proposalId,
        jobId: job.id,
      });

      // Passo 2: Enviar para ClickSign (se configurado)
      if (process.env.CLICKSIGN_API_KEY) {
        try {
          // Buscar a proposta para obter a URL da CCB
          const proposal = await unitOfWork.proposals.findById(proposalId);
          if (!proposal) {
            throw new Error(`Proposal ${proposalId} not found`);
          }

          const ccbUrl = proposal.toPersistence().ccb_url;
          if (ccbUrl) {
            // Aqui você integraria com o ClickSign
            // Por ora, apenas simulamos o envio
            logger.info('Sending CCB to ClickSign', {
              proposalId,
              ccbUrl,
            });

            // await clicksignService.createDocument(...)
            // await clicksignService.addSigner(...)
            // await clicksignService.sendForSignature(...)
          }
        } catch (clickSignError) {
          // Log do erro mas não falha o job - ClickSign não é crítico
          logger.error('Failed to send to ClickSign', {
            proposalId,
            error: clickSignError instanceof Error ? clickSignError.message : 'Unknown error',
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Formalization completed successfully', {
        proposalId,
        jobId: job.id,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Formalization failed', {
        proposalId,
        jobId: job.id,
        attempt: job.attemptsMade,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Relançar erro para que BullMQ possa fazer retry
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info('Formalization job completed', {
        jobId: job.id,
        proposalId: job.data.aggregateId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Formalization job failed', {
        jobId: job?.id,
        proposalId: job?.data.aggregateId,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Formalization job stalled', { jobId });
    });
  }

  public async start(): Promise<void> {
    // Worker já está rodando quando criado no constructor
    logger.info('Formalization worker started');
  }

  public async stop(): Promise<void> {
    await this.worker.close();
    logger.info('Formalization worker stopped');
  }
}