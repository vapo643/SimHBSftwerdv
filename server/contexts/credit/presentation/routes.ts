/**
 * Credit Context API Routes
 * Maps HTTP endpoints to ProposalController methods
 */

import { Router } from 'express';
import { ProposalController } from './ProposalController';

export function createCreditRoutes(): Router {
  const router = Router();
  const controller = new ProposalController();

  // Bind methods to preserve 'this' context
  const boundController = {
    create: controller.create.bind(controller),
    getById: controller.getById.bind(controller),
    getAll: controller.getAll.bind(controller),
    submitForAnalysis: controller.submitForAnalysis.bind(controller),
    analyze: controller.analyze.bind(controller),
    approve: controller.approve.bind(controller),
    reject: controller.reject.bind(controller),
    setPending: controller.setPending.bind(controller),
    formalize: controller.formalize.bind(controller),
    markAsPaid: controller.markAsPaid.bind(controller),
    getByStore: controller.getByStore.bind(controller),
    getByCpf: controller.getByCpf.bind(controller),
    getPendingAnalysis: controller.getPendingAnalysis.bind(controller)
  };

  // Proposal CRUD operations
  router.post('/proposals', boundController.create);
  router.get('/proposals', boundController.getAll);
  router.get('/proposals/pending', boundController.getPendingAnalysis);
  router.get('/proposals/:id', boundController.getById);
  
  // Proposal workflow actions
  router.post('/proposals/:id/submit', boundController.submitForAnalysis);
  router.post('/proposals/:id/analyze', boundController.analyze);
  router.post('/proposals/:id/approve', boundController.approve);
  router.post('/proposals/:id/reject', boundController.reject);
  router.post('/proposals/:id/pending', boundController.setPending);
  router.post('/proposals/:id/formalize', boundController.formalize);
  router.post('/proposals/:id/paid', boundController.markAsPaid);
  
  // Query endpoints
  router.get('/proposals/store/:storeId', boundController.getByStore);
  router.get('/proposals/cpf/:cpf', boundController.getByCpf);

  return router;
}

// Export for legacy compatibility if needed
export default createCreditRoutes;