import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// Buscar dados do cliente por CPF
router.get('/clientes/cpf/:cpf', async (req: Request, res: Response) => {
  try {
    const { cpf } = req.params;
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (!cleanCPF || cleanCPF.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido' });
    }
    
    // Por enquanto, vamos apenas retornar que não existe
    // Quando implementarmos o storage, buscaremos no banco
    return res.json({ exists: false });
  } catch (error) {
    console.error('Erro ao buscar cliente por CPF:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do cliente' });
  }
});

// Buscar endereço por CEP (fallback próprio caso API externa falhe)
router.get('/cep/:cep', async (req: Request, res: Response) => {
  try {
    const { cep } = req.params;
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return res.status(400).json({ error: 'CEP inválido' });
    }
    
    // Tentar múltiplas APIs de CEP
    const apis = [
      `https://viacep.com.br/ws/${cleanCep}/json/`,
      `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
      `https://cep.awesomeapi.com.br/json/${cleanCep}`
    ];
    
    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          
          // Normalizar resposta das diferentes APIs
          if (apiUrl.includes('viacep')) {
            if (!data.erro) {
              return res.json({
                logradouro: data.logradouro || '',
                bairro: data.bairro || '',
                cidade: data.localidade || '',
                estado: data.uf || '',
                cep: data.cep || cleanCep
              });
            }
          } else if (apiUrl.includes('brasilapi')) {
            return res.json({
              logradouro: data.street || '',
              bairro: data.neighborhood || '',
              cidade: data.city || '',
              estado: data.state || '',
              cep: data.cep || cleanCep
            });
          } else if (apiUrl.includes('awesomeapi')) {
            return res.json({
              logradouro: data.address || '',
              bairro: data.district || '',
              cidade: data.city || '',
              estado: data.state || '',
              cep: data.cep || cleanCep
            });
          }
        }
      } catch (apiError) {
        console.log(`API ${apiUrl} falhou, tentando próxima...`);
        continue;
      }
    }
    
    return res.status(404).json({ error: 'CEP não encontrado' });
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    res.status(500).json({ error: 'Erro ao buscar CEP' });
  }
});

export default router;