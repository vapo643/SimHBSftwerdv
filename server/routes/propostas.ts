import { Request, Response } from "express";
import { AuthenticatedRequest } from "../lib/jwt-auth-middleware";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import { db } from "../lib/supabase.js";
import { propostas } from "@shared/schema";
import { eq } from "drizzle-orm";

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
    const statusSuspensiveis = ['rascunho', 'aguardando_analise', 'em_analise', 'pendente'];
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
        status: novoStatus
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

/**
 * Buscar CCB assinada da proposta (integração com ClickSign)
 * GET /api/propostas/:id/ccb
 */
export const getCcbAssinada = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    
    if (!propostaId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
    }

    // Buscar proposta com dados do ClickSign
    const [proposta] = await db
      .select()
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);
    
    if (!proposta) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // Verificar se CCB foi gerada e assinada
    if (!proposta.ccbGerado || !proposta.assinaturaEletronicaConcluida) {
      return res.status(404).json({ 
        message: "CCB não foi gerada ou ainda não foi assinada" 
      });
    }

    // Se temos o documento_id do ClickSign, buscar o PDF assinado
    if (proposta.clicksignDocumentId) {
      try {
        // Para agora, vamos retornar uma URL simulada do ClickSign
        // TODO: Implementar integração real com ClickSign API para buscar PDF assinado
        const clicksignUrl = `https://app.clicksign.com/sign/documents/${proposta.clicksignDocumentId}/download`;
        
        return res.json({ 
          url: clicksignUrl,
          nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
          status: 'assinado',
          dataAssinatura: proposta.dataAprovacao,
          fonte: 'clicksign'
        });
      } catch (clicksignError) {
        console.error('Erro ao buscar PDF do ClickSign:', clicksignError);
        // Continuar com fallback abaixo
      }
    }

    // Fallback: buscar no Supabase Storage (se foi salvo localmente)
    const supabase = createServerSupabaseAdminClient();
    
    try {
      // Tentar buscar no storage
      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(`proposta-${propostaId}/ccb-assinada.pdf`, 3600); // 1 hora

      if (urlData?.signedUrl) {
        return res.json({ 
          url: urlData.signedUrl,
          nome: `CCB_${proposta.clienteNome}_${propostaId}.pdf`,
          status: 'assinado',
          dataAssinatura: proposta.dataAprovacao,
          fonte: 'storage'
        });
      }
    } catch (storageError) {
      console.error('Erro ao buscar no Storage:', storageError);
    }

    // Se chegou até aqui, CCB não foi encontrada
    return res.status(404).json({ 
      message: "CCB assinada não encontrada. Verifique se o documento foi assinado corretamente no ClickSign." 
    });

  } catch (error) {
    console.error('Erro ao buscar CCB:', error);
    res.status(500).json({ 
      message: "Erro interno do servidor ao buscar CCB" 
    });
  }
};