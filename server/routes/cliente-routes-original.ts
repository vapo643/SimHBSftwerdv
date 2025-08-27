/**
 * Cliente Routes - REFACTORED
 * Controller layer using service pattern
 * PAM V1.0 - Clean architecture implementation
 */

import { Router, Request, Response } from 'express';
import { clienteService } from '../services/clienteService.js';

const _router = Router();

/**
 * GET /api/clientes/cpf/:cpf
 * Get client data by CPF
 */
router.get('/clientes/cpf/:cpf', async (req: Request, res: Response) => {
  try {
    const { cpf } = req.params;

    const _result = await clienteService.getClientByCPF(cpf);

    if (result.exists) {
      res.json(_result);
    } else {
      res.status(404).json({
        message: result.message || 'Cliente não encontrado',
      });
    }
  } catch (error) {
    console.error('[CLIENTE_CONTROLLER] Error fetching client by CPF:', error);
    res.status(500).json({
      error: 'Erro ao buscar dados do cliente',
    });
  }
});

/**
 * GET /api/cep/:cep
 * Get address by Brazilian postal code (CEP)
 */
router.get('/cep/:cep', async (req: Request, res: Response) => {
  try {
    const { cep } = req.params;

    const _address = await clienteService.getAddressByCEP(cep);
    res.json(address);
  } catch (error) {
    console.error('[CLIENTE_CONTROLLER] Error fetching CEP:', error);

    if (error.message == 'CEP inválido') {
      res.status(400).json({ error: error.message });
    } else if (error.message == 'CEP não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao buscar CEP' });
    }
  }
});

export default router;
