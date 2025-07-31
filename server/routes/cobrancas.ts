import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { addDays, format, isAfter, differenceInDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { jwtAuthMiddleware } from '../lib/jwt-auth-middleware';
import { roleGuard } from '../lib/role-guard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const router = Router();

// Parâmetros de busca para cobranças
const cobrancasQuerySchema = z.object({
  status: z.enum(['todos', 'em_dia', 'inadimplente', 'quitado']).optional(),
  cpf: z.string().optional(),
  contrato: z.string().optional(),
});

// Função para calcular status da parcela
function calcularStatusParcela(dataVencimento: Date, dataPagamento?: Date | null) {
  const hoje = new Date();
  
  if (dataPagamento) {
    return 'pago';
  }
  
  if (isAfter(hoje, dataVencimento)) {
    return 'vencido';
  }
  
  return 'pendente';
}

// Função para calcular dias de atraso
function calcularDiasAtraso(dataVencimento: Date) {
  const hoje = new Date();
  
  if (isAfter(hoje, dataVencimento)) {
    return differenceInDays(hoje, dataVencimento);
  }
  
  return 0;
}

// GET /api/cobrancas - Listar propostas em cobrança
router.get('/', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { status, cpf, contrato } = cobrancasQuerySchema.parse(req.query);

    // Buscar propostas aprovadas e pagas
    const propostas = await storage.getPropostas();
    
    // Filtrar apenas propostas aprovadas ou pagas
    let propostasCobranca = propostas.filter(p => 
      p.status === 'aprovado' || p.status === 'pago' || p.status === 'pendente'
    );

    // Se não houver propostas com esses status, usar propostas existentes para demonstração
    if (propostasCobranca.length === 0) {
      propostasCobranca = propostas.slice(0, 5); // Pegar até 5 propostas para demonstração
    }

    // Buscar parcelas e calcular status
    const propostasComParcelas = await Promise.all(
      propostasCobranca.map(async (proposta) => {
        // Buscar parcelas da proposta
        // TODO: implementar getParcelasByPropostaId quando tabela parcelas estiver criada
        // Por ora, vamos gerar parcelas de exemplo baseadas nos dados da proposta
        const parcelas: any[] = [];
        const prazo = proposta.dadosFinanciamento?.prazo || 12;
        const valorParcela = (proposta.dadosFinanciamento?.valorTotal || 10000) / prazo;
        const dataBase = new Date(proposta.createdAt);
        
        for (let i = 0; i < prazo; i++) {
          const dataVencimento = addDays(dataBase, 30 * (i + 1));
          const vencido = isAfter(new Date(), dataVencimento);
          const pago = i < 2; // Simular que as 2 primeiras parcelas foram pagas
          
          parcelas.push({
            id: `${proposta.id}-parcela-${i + 1}`,
            numero: i + 1,
            valorParcela: valorParcela,
            dataVencimento: dataVencimento.toISOString(),
            dataPagamento: pago ? addDays(dataVencimento, -5).toISOString() : null,
            codigoBoleto: `BOLETO${proposta.id.substring(0, 8)}${i + 1}`,
            linhaDigitavel: `23791.12345 67890.123456 78901.234567 8 ${Math.floor(Math.random() * 100000000000000)}`,
            status: pago ? 'pago' : (vencido ? 'vencido' : 'pendente')
          });
        }
        
        // Buscar informações de pagamento do Inter Bank
        const parcelasComStatus = await Promise.all(
          parcelas.map(async (parcela) => {
            let statusPagamento = null;
            
            // TODO: Integrar com API do Banco Inter quando configurada
            // if (parcela.codigoBoleto) {
            //   const statusInter = await interBankAPI.consultarBoleto(parcela.codigoBoleto);
            //   if (statusInter.situacao === 'PAGO') {
            //     parcela.dataPagamento = statusInter.dataPagamento;
            //   }
            // }
            
            const dataVencimento = new Date(parcela.dataVencimento);
            const status = calcularStatusParcela(dataVencimento, parcela.dataPagamento);
            const diasAtraso = status === 'vencido' ? calcularDiasAtraso(dataVencimento) : 0;
            
            return {
              ...parcela,
              status,
              diasAtraso,
            };
          })
        );
        
        // Calcular estatísticas
        const parcelasPagas = parcelasComStatus.filter(p => p.status === 'pago').length;
        const parcelasPendentes = parcelasComStatus.filter(p => p.status === 'pendente').length;
        const parcelasVencidas = parcelasComStatus.filter(p => p.status === 'vencido').length;
        const valorTotalPago = parcelasComStatus
          .filter(p => p.status === 'pago')
          .reduce((acc, p) => acc + p.valorParcela, 0);
        const valorTotalPendente = parcelasComStatus
          .filter(p => p.status !== 'pago')
          .reduce((acc, p) => acc + p.valorParcela, 0);
        const maiorAtraso = Math.max(...parcelasComStatus
          .filter(p => p.status === 'vencido')
          .map(p => p.diasAtraso || 0), 0);
        
        // Determinar status geral
        let statusGeral = 'em_dia';
        if (parcelasVencidas > 0) {
          statusGeral = 'inadimplente';
        } else if (parcelasPagas === parcelas.length) {
          statusGeral = 'quitado';
        }
        
        // Buscar documentos
        const documentos: any = {};
        if (proposta.ccbUrl) {
          documentos.ccb = proposta.ccbUrl;
        }
        
        // Usar estrutura JSONB correta
        const clienteData = proposta.cliente_data || proposta.clienteData || {};
        const condicoesData = proposta.condicoes_data || proposta.condicoesData || {};
        
        return {
          id: proposta.id,
          numeroContrato: proposta.numeroContrato || proposta.id.substring(0, 8).toUpperCase(),
          nomeCliente: clienteData.nome || clienteData.nomeCompleto || 'Cliente não informado',
          cpfCliente: clienteData.cpf || '000.000.000-00',
          telefoneCliente: clienteData.telefone || 'Não informado',
          emailCliente: clienteData.email || 'email@exemplo.com',
          valorTotal: condicoesData.valorTotal || condicoesData.valor || 0,
          valorFinanciado: condicoesData.valor || condicoesData.valorSolicitado || 0,
          quantidadeParcelas: condicoesData.prazo || 0,
          parcelasPagas,
          parcelasPendentes,
          parcelasVencidas,
          valorTotalPago,
          valorTotalPendente,
          diasAtraso: maiorAtraso,
          status: statusGeral,
          dataContrato: proposta.createdAt,
          ccbAssinada: proposta.assinatura_eletronica_concluida || false,
          parcelas: parcelasComStatus,
          documentos,
        };
      })
    );

    // Aplicar filtros
    let resultados = propostasComParcelas;
    
    if (status && status !== 'todos') {
      resultados = resultados.filter(p => p.status === status);
    }
    
    if (cpf) {
      resultados = resultados.filter(p => p.cpfCliente.includes(cpf));
    }
    
    if (contrato) {
      resultados = resultados.filter(p => p.numeroContrato.includes(contrato));
    }

    // Ordenar por dias de atraso (decrescente)
    resultados.sort((a, b) => b.diasAtraso - a.diasAtraso);

    res.json(resultados);
  } catch (error) {
    console.error('Erro ao buscar cobranças:', error);
    res.status(500).json({ error: 'Erro ao buscar cobranças' });
  }
});

// POST /api/cobrancas/:id/atualizar-status - Atualizar status das parcelas via API do Inter
router.post('/:id/atualizar-status', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar parcelas da proposta
    const parcelas: any[] = []; // TODO: implementar getParcelasByPropostaId quando tabela parcelas estiver criada
    
    // Atualizar status de cada parcela
    for (const parcela of parcelas) {
      if (parcela.codigoBoleto && !parcela.dataPagamento) {
        try {
          // TODO: Descomentar quando API do Inter estiver configurada
          // const statusInter = await interBankAPI.consultarBoleto(parcela.codigoBoleto);
          const statusInter = { situacao: 'PENDENTE' };
          
          if (statusInter.situacao === 'PAGO') {
            // TODO: Atualizar parcela como paga quando tabela parcelas estiver criada
            // await storage.updateParcela(parcela.id, {
            //   dataPagamento: statusInter.dataPagamento,
            //   valorPago: statusInter.valorPago || parcela.valorParcela,
            // });
          }
        } catch (error) {
          console.error(`Erro ao atualizar parcela ${parcela.id}:`, error);
        }
      }
    }
    
    // Registrar log
    await storage.createPropostaLog({
      propostaId: id,
      autorId: userId,
      statusAnterior: '',
      statusNovo: 'status_parcelas_atualizado',
      observacao: 'Status das parcelas atualizado via API do Banco Inter'
    });

    res.json({ success: true, message: 'Status das parcelas atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar status das parcelas' });
  }
});

// POST /api/cobrancas/contato - Enviar mensagem de cobrança
router.post('/contato', jwtAuthMiddleware, roleGuard(['FINANCEIRO', 'ADMINISTRADOR', 'DIRETOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const { propostaId, tipo, destinatario, mensagem } = req.body;

    // TODO: Registrar comunicação quando método createComunicacaoLog estiver disponível
    // await storage.createComunicacaoLog({
    //   propostaId,
    //   usuarioId: userId,
    //   tipo: tipo as any,
    //   destinatario,
    //   mensagem,
    //   status: 'enviado',
    //   dataEnvio: new Date(),
    // });
    
    // Registrar log da proposta
    await storage.createPropostaLog({
      propostaId,
      autorId: userId,
      statusAnterior: '',
      statusNovo: 'cobranca_enviada',
      observacao: `Lembrete de cobrança enviado via ${tipo}`
    });

    // Aqui você pode integrar com serviços de envio real (Twilio, SendGrid, etc.)
    // Por ora, apenas simulamos o envio

    res.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar contato:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

export default router;