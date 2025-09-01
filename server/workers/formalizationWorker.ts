import { Worker, Job } from 'bullmq';
import logger from '../lib/logger';
import { GenerateCcbUseCase } from '../modules/ccb/application/GenerateCcbUseCase';
import { UnitOfWork } from '../modules/shared/infrastructure/UnitOfWork';
import { metricsService } from '../lib/metricsService';
import { getRedisClient } from '../lib/redis-manager';
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
  private worker: Worker | null = null;
  private isQueueAvailable: boolean = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      // Create BullMQ worker
      this.worker = new Worker(
        'formalization-queue',
        async (job: Job<ProposalApprovedPayload>) => {
          return this.processFormalization(job);
        },
        {
          connection: await getRedisClient(),
          concurrency: 5, // Processar até 5 propostas simultaneamente
        }
      );

      this.isQueueAvailable = true;
      this.setupEventHandlers();
      logger.info('📊 [FormalizationWorker] BullMQ Worker connected - async processing enabled');
    } catch (error) {
      this.isQueueAvailable = false;
      logger.warn('⚠️ [FormalizationWorker] Queue unavailable - async processing disabled', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      logger.warn('💡 [FormalizationWorker] Events will be processed synchronously (development mode)');
    }
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
    if (!this.worker) {
      logger.warn('⚠️ [FormalizationWorker] Cannot setup event handlers - worker not initialized');
      return;
    }

    // DLQ functionality is built-in to SupabaseWorker
    
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
      
      // Note: Dead Letter Queue functionality is built-in to SupabaseWorker
      
      logger.error('Formalization job failed (worker-level logging)', {
        jobId: job?.id,
        proposalId: job?.data.aggregateId,
        error: error.message,
        attempts: job?.attemptsMade || 0,
        isPermanentFailure: (job?.attemptsMade || 0) >= (job?.opts.attempts || 3),
      });
    });

    this.worker.on('stalled', (jobId) => {
      // Record stalled job metric
      metricsService.incrementJobCounter('formalization-queue', 'stalled', jobId);
      
      logger.warn('Formalization job stalled', { jobId });
    });
  }

  public async start(): Promise<void> {
    if (!this.isQueueAvailable) {
      logger.warn('⚠️ [FormalizationWorker] Start called but Queue unavailable - no async processing');
      return;
    }
    // Worker já está rodando quando criado no constructor
    logger.info('📊 [FormalizationWorker] Started successfully');
  }

  public async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn('⚠️ [FormalizationWorker] Stop called but worker not initialized');
      return;
    }
    await this.worker.close();
    logger.info('📊 [FormalizationWorker] Stopped successfully');
  }
}