import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { createServerSupabaseAdminClient } from "../lib/supabase";

/**
 * Alterar status da proposta entre ativa e suspensa
 * PUT /api/propostas/:id/toggle-status
 */
export const togglePropostaStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    
    if (!propostaId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
    }

    const supabase = createServerSupabaseAdminClient();
    
    // 1. Buscar a proposta atual
    const { data: proposta, error: fetchError } = await supabase
      .from('propostas')
      .select('id, status, user_id')
      .eq('id', propostaId)
      .single();
    
    if (fetchError || !proposta) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // 2. Verificar se o usuário é o atendente da proposta ou administrador
    if (req.user?.role !== 'ADMINISTRADOR' && proposta.user_id !== req.user?.id) {
      return res.status(403).json({ 
        message: "Você não tem permissão para alterar o status desta proposta" 
      });
    }

    // 3. Verificar se a proposta está em um status que pode ser suspensa
    const statusSuspensiveis = ['aguardando_analise', 'em_analise', 'pendente'];
    if (!statusSuspensiveis.includes(proposta.status) && proposta.status !== 'suspensa') {
      return res.status(400).json({ 
        message: "Esta proposta não pode ser suspensa/reativada no status atual" 
      });
    }

    // 4. Determinar o novo status
    let novoStatus: string;
    if (proposta.status === 'suspensa') {
      // Reativar: voltar para aguardando_analise
      novoStatus = 'aguardando_analise';
    } else {
      // Suspender
      novoStatus = 'suspensa';
    }

    // 5. Atualizar o status
    const { error: updateError } = await supabase
      .from('propostas')
      .update({ 
        status: novoStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', propostaId);
    
    if (updateError) {
      console.error('Erro ao atualizar status:', updateError);
      return res.status(500).json({ 
        message: `Erro ao atualizar status: ${updateError.message}` 
      });
    }

    // 6. Criar log de comunicação
    await supabase
      .from('comunicacao_logs')
      .insert({
        proposta_id: propostaId,
        usuario_id: req.user?.id,
        tipo: 'status_change',
        mensagem: `Status alterado de ${proposta.status} para ${novoStatus}`,
        created_at: new Date().toISOString()
      });

    res.json({
      success: true,
      propostaId,
      statusAnterior: proposta.status,
      statusNovo: novoStatus,
      message: novoStatus === 'suspensa' 
        ? 'Proposta suspensa com sucesso' 
        : 'Proposta reativada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao alterar status da proposta:', error);
    res.status(500).json({ 
      message: "Erro interno do servidor ao alterar status" 
    });
  }
};