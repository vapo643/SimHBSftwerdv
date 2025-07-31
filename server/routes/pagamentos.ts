import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { addDays, format } from 'date-fns';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { roleGuard } from '../lib/role-guard';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Schema para processar pagamentos
const processarPagamentosSchema = z.object({
  propostas: z.array(z.string()),
});

// Função para gerar dados bancários simulados
function gerarDadosBancarios(proposta: any) {
  const chavesPix = [
    proposta.dadosPessoais?.email || proposta.clienteData?.email,
    proposta.dadosPessoais?.cpf || proposta.clienteData?.cpf,
    proposta.dadosPessoais?.telefone || proposta.clienteData?.telefone,
    `${Math.floor(Math.random() * 90000) + 10000}-${Math.floor(Math.random() * 9) + 1}`,
  ];

  const bancos = [
    'Banco do Brasil', 'Caixa Econômica Federal', 'Bradesco', 'Itaú Unibanco', 
    'Santander', 'BTG Pactual', 'Inter', 'Nubank', 'PicPay', 'C6 Bank'
  ];

  return {
    chavePix: chavesPix[Math.floor(Math.random() * chavesPix.length)],
    bancoCliente: bancos[Math.floor(Math.random() * bancos.length)],
    agenciaCliente: `${Math.floor(Math.random() * 9000) + 1000}`,
    contaCliente: `${Math.floor(Math.random() * 900000) + 100000}-${Math.floor(Math.random() * 9) + 1}`,
    tipoContaCliente: Math.random() > 0.5 ? 'corrente' : 'poupanca',
  };
}

// GET /api/financeiro/pagamentos - Buscar propostas prontas para pagamento
router.get('/', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar propostas aprovadas
    const propostas = await storage.getPropostas();
    
    // Filtrar propostas aprovadas ou simular que algumas têm CCB assinada
    let propostasParaPagamento = propostas.filter(p => 
      p.status === 'aprovado' || p.status === 'pago'
    );

    // Se não houver propostas aprovadas, usar algumas existentes para demonstração
    if (propostasParaPagamento.length === 0) {
      propostasParaPagamento = propostas.slice(0, 6); // Pegar até 6 propostas para demonstração
    }

    // Mapear propostas para formato de pagamento
    const propostasComDados = propostasParaPagamento.map((proposta, index) => {
      const dadosBancarios = gerarDadosBancarios(proposta);
      
      // Simular diferentes status de pagamento
      let status = 'pronto_pagamento';
      if (index === 0) status = 'processando';
      if (index === 1) status = 'pago';
      if (index === 2) status = 'aguardando_dados_bancarios';
      if (index === 5) status = 'erro';

      // Usar dados da estrutura atual (tanto JSONB quanto campos antigos)
      const nomeCliente = proposta.dadosPessoais?.nomeCompleto || 
                         proposta.clienteData?.nome || 
                         proposta.nomeCliente || 
                         'Cliente não informado';
      
      const cpfCliente = proposta.dadosPessoais?.cpf || 
                        proposta.clienteData?.cpf || 
                        proposta.cpfCliente || 
                        '000.000.000-00';

      const emailCliente = proposta.dadosPessoais?.email || 
                          proposta.clienteData?.email || 
                          proposta.emailCliente || 
                          'email@exemplo.com';

      const telefoneCliente = proposta.dadosPessoais?.telefone || 
                             proposta.clienteData?.telefone || 
                             proposta.telefoneCliente || 
                             '(11) 99999-9999';

      const valorEmprestimo = proposta.dadosFinanciamento?.valorSolicitado || 
                             proposta.condicoesData?.valor || 
                             proposta.valorSolicitado || 
                             10000;

      return {
        id: proposta.id,
        numeroContrato: `CTR-${proposta.id.substring(0, 8).toUpperCase()}`,
        nomeCliente,
        cpfCliente,
        emailCliente,
        telefoneCliente,
        valorEmprestimo,
        dataFormalizacao: proposta.createdAt,
        ccbAssinada: true, // Simular que todas têm CCB assinada
        dataAssinaturaCCB: addDays(new Date(proposta.createdAt), 1).toISOString(),
        ...dadosBancarios,
        status,
        dataProcessamento: status === 'pago' ? addDays(new Date(proposta.createdAt), 2).toISOString() : undefined,
        comprovantePagamento: status === 'pago' ? `https://exemplo.com/comprovante-${proposta.id}.pdf` : undefined,
        observacoes: status === 'erro' ? 'Erro na validação dos dados bancários' : 
                    status === 'aguardando_dados_bancarios' ? 'Aguardando confirmação dos dados bancários pelo cliente' : undefined,
      };
    });

    // Ordenar por status (prontos para pagamento primeiro)
    propostasComDados.sort((a, b) => {
      const statusOrder = {
        'pronto_pagamento': 1,
        'aguardando_dados_bancarios': 2,
        'processando': 3,
        'erro': 4,
        'pago': 5
      };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    res.json(propostasComDados);
  } catch (error) {
    console.error('Erro ao buscar propostas para pagamento:', error);
    res.status(500).json({ error: 'Erro ao buscar propostas para pagamento' });
  }
});

// POST /api/financeiro/pagamentos/processar - Processar pagamentos selecionados
router.post('/processar', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { propostas } = processarPagamentosSchema.parse(req.body);

    if (propostas.length === 0) {
      return res.status(400).json({ error: 'Nenhuma proposta selecionada' });
    }

    // Simular processamento de pagamentos
    // Em um ambiente real, aqui seria feita a integração com o sistema bancário
    
    const resultados = [];
    
    for (const propostaId of propostas) {
      try {
        // Registrar log do processamento
        await storage.createPropostaLog({
          propostaId,
          autorId: userId,
          statusAnterior: 'pronto_pagamento',
          statusNovo: 'processando',
          observacao: 'Pagamento enviado para processamento'
        });

        resultados.push({
          propostaId,
          status: 'enviado',
          message: 'Pagamento enviado para processamento'
        });

        // Simular que alguns pagamentos podem falhar
        if (Math.random() < 0.1) { // 10% de chance de erro
          await storage.createPropostaLog({
            propostaId,
            autorId: userId,
            statusAnterior: 'processando',
            statusNovo: 'erro',
            observacao: 'Erro simulado no processamento do pagamento'
          });

          resultados[resultados.length - 1] = {
            propostaId,
            status: 'erro',
            message: 'Erro no processamento do pagamento'
          };
        }
      } catch (error) {
        console.error(`Erro ao processar pagamento ${propostaId}:`, error);
        resultados.push({
          propostaId,
          status: 'erro',
          message: 'Erro interno no processamento'
        });
      }
    }

    const sucessos = resultados.filter(r => r.status === 'enviado').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    res.json({
      success: true,
      message: `${sucessos} pagamentos processados com sucesso, ${erros} com erro`,
      resultados,
      estatisticas: {
        total: propostas.length,
        sucessos,
        erros
      }
    });
  } catch (error) {
    console.error('Erro ao processar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao processar pagamentos' });
  }
});

// GET /api/financeiro/pagamentos/:id/status - Consultar status de um pagamento específico
router.get('/:id/status', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar proposta
    const proposta = await storage.getPropostaById(id);
    
    if (!proposta) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Simular consulta de status no sistema bancário
    const statusPagamento = {
      id: proposta.id,
      status: 'pago', // Simular que foi pago
      dataProcessamento: new Date().toISOString(),
      valorProcessado: proposta.dadosFinanciamento?.valorSolicitado || 10000,
      comprovante: `https://exemplo.com/comprovante-${proposta.id}.pdf`,
      codigoTransacao: `TXN${Date.now()}`,
    };

    res.json(statusPagamento);
  } catch (error) {
    console.error('Erro ao consultar status do pagamento:', error);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento' });
  }
});

// POST /api/financeiro/pagamentos/:id/reprocessar - Reprocessar pagamento com erro
router.post('/:id/reprocessar', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Registrar reprocessamento
    await storage.createPropostaLog({
      propostaId: id,
      autorId: userId,
      statusAnterior: 'erro',
      statusNovo: 'processando',
      observacao: 'Pagamento reprocessado manualmente'
    });

    res.json({
      success: true,
      message: 'Pagamento enviado para reprocessamento'
    });
  } catch (error) {
    console.error('Erro ao reprocessar pagamento:', error);
    res.status(500).json({ error: 'Erro ao reprocessar pagamento' });
  }
});

export default router;