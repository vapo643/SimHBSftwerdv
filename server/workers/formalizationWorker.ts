import { Worker, Job } from 'bullmq';
import logger from '../lib/logger';
import { GenerateCcbUseCase } from '../modules/ccb/application/GenerateCcbUseCase';
import { UnitOfWork } from '../modules/shared/infrastructure/UnitOfWork';
import { getRedisConnectionConfig } from '../lib/redis-config';
import { dlqManager } from '../lib/dead-letter-queue';
import { metricsService } from '../lib/metricsService';
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
        // Note: Retry configuration is handled by queue options
        // Job retry delays are controlled by the 'backoff' configuration in queue defaultJobOptions
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
    // Set up DLQ handler for this worker
    dlqManager.setupFailedJobHandler(this.worker, 'formalization-queue');
    
    // METRICS INTEGRATION - Track job lifecycle events
    this.worker.on('active', (job) => {
      // Record active job metric
      metricsService.incrementJobCounter('formalization-queue', 'active', job.id);
      
      logger.info('Formalization job started', {
        jobId: job.id,
        proposalId: job.data.aggregateId,
      });
    });
    
    this.worker.on('completed', (job) => {
      // Calculate processing duration
      const processingTime = job.processedOn && job.timestamp 
        ? job.processedOn - job.timestamp 
        : undefined;
      
      // Record completion metrics
      metricsService.incrementJobCounter('formalization-queue', 'completed', job.id);
      if (processingTime) {
        metricsService.recordJobDuration('formalization-queue', processingTime, job.id);
      }
      
      logger.info('Formalization job completed', {
        jobId: job.id,
        proposalId: job.data.aggregateId,
        durationMs: processingTime,
      });
    });

    // Note: 'failed' event is handled by DLQ manager for permanent failures
    // This handler captures all failures (including retryable ones)
    this.worker.on('failed', (job, error) => {
      // Record failure metric (includes retryable failures)
      metricsService.incrementJobCounter('formalization-queue', 'failed', job?.id);
      
      // Check if this is a permanent failure that will go to DLQ
      if (dlqManager.shouldMoveToDeadLetter(job)) {
        metricsService.recordDeadLetterJob('formalization-queue', error.message, job?.id);
      }
      
      logger.error('Formalization job failed (worker-level logging)', {
        jobId: job?.id,
        proposalId: job?.data.aggregateId,
        error: error.message,
        attempts: job?.attemptsMade,
        isPermanentFailure: dlqManager.shouldMoveToDeadLetter(job),
      });
    });

    this.worker.on('stalled', (jobId) => {
      // Record stalled job metric
      metricsService.incrementJobCounter('formalization-queue', 'stalled', jobId);
      
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