/**
 * Cliente Routes - EXPANDED FROM MINIFIED
 * Controller layer using service pattern
 * PAM V9.0 - Consolidated AuthenticatedRequest usage
 */

import { Router, Request, Response } from 'express';
import { clientService } from '../services/genericService';
import { clienteService as clientCpfService } from '../services/clienteService';
import { AuthenticatedRequest } from '../../shared/types/express';

const router = Router();

/**
 * GET /api/clientes
 * List all clients
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await clientService.executeOperation('list_clients', req.query);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch clients',
    });
  }
});

/**
 * GET /api/clientes/cpf/:cpf
 * Get client data by CPF
 */
router.get('/cpf/:cpf', async (req: Request, res: Response) => {
  try {
    const { cpf } = req.params;
    const result = await clientCpfService.getClientByCPF(cpf);
    
    // ✅ PAM V1.0: Correção de protocolo HTTP - retornar 404 se cliente não encontrado
    if (result && result.exists === false) {
      return res.status(404).json({ 
        message: result.message || 'Cliente não encontrado' 
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('[CLIENTE_ROUTES] Error getting client by CPF:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao buscar dados do cliente',
    });
  }
});

export default router;
