import { Request, Response } from "express";
import { createServerSupabaseAdminClient } from "../lib/supabase";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Buscar documentos de uma proposta
 * GET /api/propostas/:id/documents
 */
export const getPropostaDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    
    if (!propostaId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
    }

    const supabase = createServerSupabaseClient();
    
    // Buscar a proposta para verificar se existe e pegar documentos
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, ccb_documento_url')
      .eq('id', propostaId)
      .single();
    
    if (propostaError || !proposta) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // Lista de documentos da proposta
    const documents = [];
    
    // Adicionar CCB se existir
    if (proposta.ccb_documento_url) {
      documents.push({
        name: "CCB - Cédula de Crédito Bancário",
        url: proposta.ccb_documento_url,
        type: "application/pdf",
        category: "ccb",
        uploadDate: "Sistema",
        isRequired: true
      });
    }

    // Buscar outros documentos relacionados à proposta no storage
    // Para expandir no futuro quando tivermos mais tipos de documento
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('documents')
      .list(`proposta-${propostaId}/`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (!storageError && storageFiles) {
      for (const file of storageFiles) {
        if (file.name && !file.name.includes('.emptyFolderPlaceholder')) {
          const { data: publicUrl } = supabase.storage
            .from('documents')
            .getPublicUrl(`proposta-${propostaId}/${file.name}`);

          documents.push({
            name: file.name,
            url: publicUrl.publicUrl,
            type: file.metadata?.mimetype || 'application/octet-stream',
            size: file.metadata?.size ? `${Math.round(file.metadata.size / 1024)} KB` : undefined,
            uploadDate: file.created_at,
            category: 'supporting'
          });
        }
      }
    }

    res.json({
      propostaId,
      totalDocuments: documents.length,
      documents
    });

  } catch (error) {
    console.error('Erro ao buscar documentos da proposta:', error);
    res.status(500).json({ 
      message: "Erro interno do servidor ao buscar documentos" 
    });
  }
};

/**
 * Upload de documento para uma proposta
 * POST /api/propostas/:id/documents
 */
export const uploadPropostaDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: propostaId } = req.params;
    const file = req.file;
    
    if (!propostaId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
    }

    if (!file) {
      return res.status(400).json({ message: "Arquivo é obrigatório" });
    }

    const supabase = createServerSupabaseAdminClient();
    
    // Verificar se a proposta existe
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id')
      .eq('id', propostaId)
      .single();
    
    if (propostaError || !proposta) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname}`;
    const filePath = `proposta-${propostaId}/${fileName}`;

    // Upload para o Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return res.status(400).json({ 
        message: `Erro no upload: ${uploadError.message}` 
      });
    }

    // Obter URL pública
    const { data: publicUrl } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      document: {
        name: file.originalname,
        fileName: fileName,
        url: publicUrl.publicUrl,
        type: file.mimetype,
        size: `${Math.round(file.size / 1024)} KB`,
        uploadDate: new Date().toISOString(),
        category: 'supporting'
      }
    });

  } catch (error) {
    console.error('Erro no upload de documento:', error);
    res.status(500).json({ 
      message: "Erro interno do servidor no upload" 
    });
  }
};