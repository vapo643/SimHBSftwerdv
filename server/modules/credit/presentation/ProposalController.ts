/**
 * Proposal Controller - Presentation Layer
 * Handles HTTP requests and responses for proposal operations
 */

import { Request, Response } from 'express';
import { proposalApplicationService } from '../../dependencies';
import { z } from 'zod';

// Input validation schemas
const createProposalSchema = z.object({
  customerData: z.object({
    name: z.string().min(1),
    cpf: z.string().regex(/^\d{11}$/),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    monthlyIncome: z.number().optional(),
    rg: z.string().optional(),
    issuingBody: z.string().optional(),
    maritalStatus: z.string().optional(),
    nationality: z.string().optional(),
    zipCode: z.string().optional(),
    address: z.string().optional(),
    occupation: z.string().optional(),
  }),
  loanConditions: z.object({
    requestedAmount: z.number().positive(),
    term: z.number().int().min(1).max(84),
    purpose: z.string().optional(),
    collateral: z.string().optional(),
    tacValue: z.number().optional(),
    iofValue: z.number().optional(),
    totalFinancedAmount: z.number().optional(),
    monthlyPayment: z.number().optional(),
    interestRate: z.number().optional(),
  }),
  partnerId: z.string().uuid().optional(),
  storeId: z.string().optional(),
  productId: z.string().optional(),
});

export class ProposalController {
  private applicationService = proposalApplicationService; // DIP compliant injection

  constructor() {
    // Dependencies now injected via IoC container
  }

  /**
   * Create a new proposal
   * POST /api/proposals
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const validatedData = createProposalSchema.parse(req.body);

      // Transform dates if needed
      if (validatedData.customerData.birthDate) {
        (validatedData.customerData as any).birthDate = new Date(
          validatedData.customerData.birthDate
        );
      }

      // Create proposal through application service
      const proposal = await this.applicationService.createProposal(validatedData as any);

      // Return created proposal
      res.status(201).json({
        success: true,
        data: proposal,
        message: 'Proposal created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else if (error instanceof Error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * Get proposal by ID
   * GET /api/proposals/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.getProposal(id);

      if (!proposal) {
        res.status(404).json({
          success: false,
          error: 'Proposal not found',
        });
        return;
      }

      res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get all proposals
   * GET /api/proposals
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const proposals = await this.applicationService.getAllProposals();

      res.json({
        success: true,
        data: proposals,
        total: proposals.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Submit proposal for analysis
   * POST /api/proposals/:id/submit
   */
  async submitForAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.submitForAnalysis(id);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal submitted for analysis',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Analyze proposal
   * POST /api/proposals/:id/analyze
   */
  async analyze(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.analyzeProposal(id);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal analyzed successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Approve proposal
   * POST /api/proposals/:id/approve
   */
  async approve(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.approveProposal(id);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal approved',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Reject proposal
   * POST /api/proposals/:id/reject
   */
  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
        return;
      }

      const proposal = await this.applicationService.rejectProposal(id, reason);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal rejected',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Set proposal as pending
   * POST /api/proposals/:id/pending
   */
  async setPending(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Pending reason is required',
        });
        return;
      }

      const proposal = await this.applicationService.setPendingProposal(id, reason);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal set as pending',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Formalize proposal
   * POST /api/proposals/:id/formalize
   */
  async formalize(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.formalizeProposal(id);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal formalized',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Mark proposal as paid
   * POST /api/proposals/:id/paid
   */
  async markAsPaid(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const proposal = await this.applicationService.markProposalAsPaid(id);

      res.json({
        success: true,
        data: proposal,
        message: 'Proposal marked as paid',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get proposals by store
   * GET /api/proposals/store/:storeId
   */
  async getByStore(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;

      const proposals = await this.applicationService.getProposalsByStore(storeId);

      res.json({
        success: true,
        data: proposals,
        total: proposals.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get proposals by CPF
   * GET /api/proposals/cpf/:cpf
   */
  async getByCpf(req: Request, res: Response): Promise<void> {
    try {
      const { cpf } = req.params;

      const proposals = await this.applicationService.getProposalsByCpf(cpf);

      res.json({
        success: true,
        data: proposals,
        total: proposals.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get pending analysis proposals
   * GET /api/proposals/pending
   */
  async getPendingAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const proposals = await this.applicationService.getPendingAnalysisProposals();

      res.json({
        success: true,
        data: proposals,
        total: proposals.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}
