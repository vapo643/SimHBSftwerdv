/**
 * BullMQ Queue Configuration - Basic Foundation
 * Implementação básica conforme PAM V1.0
 */

import { Queue } from 'bullmq';

// Configuração básica da fila conforme especificado no PAM
export const pdfQueue = new Queue('pdf-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

console.log('[QUEUE] 📦 Fila pdf-processing criada');
