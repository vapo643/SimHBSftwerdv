import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/supabase';
import { historicoObservacoesCobranca } from '@shared/schema';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Schema para validação do corpo da requisição
const createObservacaoSchema = z.object({
  mensagem: z.string().min(1, "Mensagem é obrigatória"),
  tipo_acao: z.enum(['Contato Realizado', 'Negociação em Andamento', 'Acordo Fechado', 'Monitoramento', 'Outros'])
});

// GET /api/propostas/:propostaId/observacoes - Buscar histórico de observações
router.get('/propostas/:propostaId/observacoes', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { propostaId } = req.params;
    const { role } = req.user!;

    // Verificar permissões
    if (role !== 'ADMINISTRADOR' && role !== 'COBRANCA') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas ADMINISTRADOR e COBRANÇA podem visualizar observações.' 
      });
    }

    console.log(`📋 [OBSERVAÇÕES] Buscando histórico para proposta: ${propostaId}`);

    // Buscar observações da proposta
    const observacoes = await db
      .select()
      .from(historicoObservacoesCobranca)
      .where(eq(historicoObservacoesCobranca.propostaId, propostaId))
      .orderBy(desc(historicoObservacoesCobranca.createdAt));

    console.log(`📋 [OBSERVAÇÕES] ${observacoes.length} observações encontradas`);

    // Formatar resposta
    const observacoesFormatadas = observacoes.map(obs => ({
      id: obs.id,
      mensagem: obs.mensagem,
      tipo_acao: obs.tipoAcao || 'Outros',
      criado_por: obs.criadoPor,
      created_at: obs.createdAt,
      dados_acao: obs.dadosAcao
    }));

    res.json({
      success: true,
      observacoes: observacoesFormatadas
    });

  } catch (error) {
    console.error('❌ [OBSERVAÇÕES] Erro ao buscar histórico:', error);
    res.status(500).json({ 
      message: 'Erro ao buscar histórico de observações',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/propostas/:propostaId/observacoes - Criar nova observação
router.post('/propostas/:propostaId/observacoes', jwtAuthMiddleware, async (req: any, res) => {
  try {
    const { propostaId } = req.params;
    const { email, role } = req.user!;

    // Verificar permissões
    if (role !== 'ADMINISTRADOR' && role !== 'COBRANCA') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas ADMINISTRADOR e COBRANÇA podem adicionar observações.' 
      });
    }

    // Validar dados de entrada
    const validatedData = createObservacaoSchema.parse(req.body);

    console.log(`📝 [OBSERVAÇÕES] Nova observação para proposta ${propostaId}:`, {
      usuario: email,
      tipo: validatedData.tipo_acao,
      mensagem: validatedData.mensagem.substring(0, 50) + '...'
    });

    // Criar nova observação
    const novaObservacao = {
      id: randomUUID(),
      propostaId: propostaId,
      mensagem: validatedData.mensagem,
      tipoAcao: validatedData.tipo_acao,
      criadoPor: email,
      createdAt: new Date(),
      dadosAcao: {
        role: role,
        timestamp: new Date().toISOString()
      }
    };

    // Inserir no banco
    await db.insert(historicoObservacoesCobranca).values(novaObservacao);

    console.log(`✅ [OBSERVAÇÕES] Observação salva com sucesso: ${novaObservacao.id}`);

    // Registrar auditoria
    console.log(`🔍 [AUDIT-OBSERVAÇÃO] Nova observação registrada:`, {
      proposta_id: propostaId,
      usuario: email,
      tipo: validatedData.tipo_acao,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      observacao: {
        id: novaObservacao.id,
        mensagem: novaObservacao.mensagem,
        tipo_acao: novaObservacao.tipoAcao,
        criado_por: novaObservacao.criadoPor,
        created_at: novaObservacao.createdAt
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ [OBSERVAÇÕES] Erro de validação:', error.errors);
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: error.errors 
      });
    }

    console.error('❌ [OBSERVAÇÕES] Erro ao criar observação:', error);
    res.status(500).json({ 
      message: 'Erro ao salvar observação',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;