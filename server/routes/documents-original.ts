import { Request, Response } from "express";
import { createServerSupabaseAdminClient } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

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

    const supabase = createServerSupabaseAdminClient();

    // Buscar a proposta para verificar se existe
    const { data: proposta, error: propostaError } = await supabase
      .from("propostas")
      .select("id, ccb_documento_url")
      .eq("id", propostaId)
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
        isRequired: true,
      });
    }

    // Buscar documentos da tabela proposta_documentos
    const { data: propostaDocumentos, error: docsError } = await supabase
      .from("proposta_documentos")
      .select("*")
      .eq("proposta_id", propostaId)
      .order("created_at", { ascending: false });

    if (!docsError && propostaDocumentos) {
      for (const doc of propostaDocumentos) {
        try {
          // Construir o caminho do arquivo no storage: proposta-{id}/{timestamp}-{fileName}
          // A URL salva contém o caminho completo: https://xxx.supabase.co/storage/v1/object/public/documents/proposta-{id}/{fileName}
          // Extrair o caminho após '/documents/'
          const documentsIndex = doc.url.indexOf("/documents/");
          let filePath;

          if (documentsIndex !== -1) {
            // Extrair caminho após '/documents/'
            filePath = doc.url.substring(documentsIndex + "/documents/".length);
          } else {
            // Fallback: tentar extrair filename e reconstruir
            const urlParts = doc.url.split("/");
            const fileName = urlParts[urlParts.length - 1];
            filePath = `proposta-${propostaId}/${fileName}`;
          }

          console.log(`[DEBUG] Gerando URL assinada para: ${filePath}`);

          // Gerar URL assinada temporária (válida por 1 hora)
          const { data: signedUrl, error: signError } = await supabase.storage
            .from("documents")
            .createSignedUrl(filePath, 3600); // 1 hora

          if (signError) {
            console.error(`[ERROR] Erro ao gerar URL assinada para ${filePath}:`, signError);
          }

          documents.push({
            name: doc.nome_arquivo,
            url: signError ? doc.url : signedUrl.signedUrl, // Fallback para URL original se houver erro
            type: doc.tipo || "application/octet-stream",
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.created_at,
            category: "supporting",
          });
        } catch (error) {
          console.error(`Erro ao gerar URL assinada para documento ${doc.nome_arquivo}:`, error);
          // Fallback para URL original
          documents.push({
            name: doc.nome_arquivo,
            url: doc.url,
            type: doc.tipo || "application/octet-stream",
            size: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : undefined,
            uploadDate: doc.created_at,
            category: "supporting",
          });
        }
      }
    }

    res.json({
      propostaId,
      totalDocuments: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Erro ao buscar documentos da proposta:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao buscar documentos",
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
      .from("propostas")
      .select("id")
      .eq("id", propostaId)
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
      .from("documents")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      return res.status(400).json({
        message: `Erro no upload: ${uploadError.message}`,
      });
    }

    // Obter URL pública
    const { data: publicUrl } = supabase.storage.from("documents").getPublicUrl(filePath);

    // Inserir registro na tabela proposta_documentos
    const { error: insertError } = await supabase.from("proposta_documentos").insert({
      proposta_id: propostaId,
      nome_arquivo: file.originalname,
      url: publicUrl.publicUrl,
      tipo: file.mimetype,
      tamanho: file.size,
    });

    if (insertError) {
      console.error("Erro ao salvar documento no banco:", insertError);
      // Não falhar a operação, mas avisar no console
    }

    res.json({
      success: true,
      document: {
        name: file.originalname,
        fileName: fileName,
        url: publicUrl.publicUrl,
        type: file.mimetype,
        size: `${Math.round(file.size / 1024)} KB`,
        uploadDate: new Date().toISOString(),
        category: "supporting",
      },
    });
  } catch (error) {
    console.error("Erro no upload de documento:", error);
    res.status(500).json({
      message: "Erro interno do servidor no upload",
    });
  }
};
