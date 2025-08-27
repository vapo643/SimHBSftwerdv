// Endpoint temporário para observações - será integrado no futuro
import { Request, Response } from 'express';

export const getPropostaObservacoes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Por enquanto retorna array vazio - preparado para futuras observações
    const observacoes = {
      observacoes: [],
    };

    res.json(observacoes);
  }
catch (error) {
    console.error('Error fetching proposal observations:', error);
    res.status(500).json({ error: 'Failed to fetch observations' });
  }
};
