import { toast } from "@/hooks/use-toast";

// Mapeamento de códigos de erro para mensagens amigáveis
const errorMessages: Record<string, string> = {
  // Erros de rede
  NETWORK_ERROR: "Erro de conexão. Verifique sua internet e tente novamente.",
  TIMEOUT_ERROR: "A requisição demorou muito. Tente novamente.",

  // Erros de validação
  VALIDATION_ERROR: "Dados inválidos. Verifique os campos marcados.",
  REQUIRED_FIELD: "Preencha todos os campos obrigatórios.",
  INVALID_FORMAT: "Formato inválido. Verifique os dados inseridos.",

  // Erros de autenticação e autorização
  UNAUTHORIZED: "Sessão expirada. Faça login novamente.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  PERMISSION_ERROR: "Acesso negado. Entre em contato com o administrador.",

  // Erros de negócio
  DUPLICATE_ENTRY: "Este registro já existe no sistema.",
  NOT_FOUND: "Registro não encontrado.",
  BUSINESS_RULE: "Esta operação viola uma regra de negócio.",
  DEPENDENCY_ERROR: "Este item não pode ser excluído pois está em uso.",

  // Erros de servidor
  SERVER_ERROR: "Erro interno. Tente novamente em alguns instantes.",
  DATABASE_ERROR: "Erro ao acessar o banco de dados.",
  SERVICE_UNAVAILABLE: "Serviço temporariamente indisponível.",

  // Erros específicos do sistema
  PROPOSAL_LOCKED: "Esta proposta está sendo editada por outro usuário.",
  INVALID_STATUS_TRANSITION: "Mudança de status inválida para esta proposta.",
  INSUFFICIENT_DATA: "Dados insuficientes para completar a operação.",
  FILE_TOO_LARGE: "Arquivo muito grande. Tamanho máximo: 10MB.",
  INVALID_FILE_TYPE: "Tipo de arquivo não permitido.",

  // Erros padrão
  DEFAULT: "Ocorreu um erro. Tente novamente.",
};

// Mapear códigos HTTP para códigos de erro internos
const httpCodeToErrorCode: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  408: "TIMEOUT_ERROR",
  409: "DUPLICATE_ENTRY",
  422: "BUSINESS_RULE",
  429: "RATE_LIMIT",
  500: "SERVER_ERROR",
  502: "SERVICE_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "TIMEOUT_ERROR",
};



/**
 * Handler centralizado para erros da API
 * Converte erros técnicos em mensagens amigáveis ao usuário
 */
export const handleApiError = (error: any) => {
  // Log técnico para desenvolvedores (apenas em desenvolvimento)
  if (process.env.NODE_ENV === "development") {
    console.error("Technical Error Details:", error);
  }

  // Extrair informações do erro
  let errorCode = "DEFAULT";
  let technicalMessage = "";
  let userMessage = "";

  // Tentar extrair código de erro da resposta
  if (error.response) {
    const { status, data } = error.response;

    // Usar código HTTP para determinar tipo de erro
    if (status && httpCodeToErrorCode[status]) {
      errorCode = httpCodeToErrorCode[status];
    }

    // Sobrescrever com código específico se disponível
    if (data?.code) {
      errorCode = data.code;
    }

    // Mensagem técnica
    technicalMessage = data?.message || error.message;

    // Verificar se há mensagem customizada do backend
    if (data?.userMessage) {
      userMessage = data.userMessage;
    }
  } else if (error.code) {
    // Erro de rede ou outro erro com código
    errorCode = error.code === "ERR_NETWORK" ? "NETWORK_ERROR" : error.code;
    technicalMessage = error.message;
  } else if (error.message) {
    // Erro genérico com mensagem
    technicalMessage = error.message;
  }

  // Determinar mensagem final para o usuário
  const finalUserMessage = userMessage || errorMessages[errorCode] || errorMessages.DEFAULT;

  // Mostrar toast com mensagem amigável
  toast({
    title: "Erro",
    description: finalUserMessage,
    variant: "destructive",
  });

  // Retornar objeto de erro estruturado para uso adicional
  return {
    code: errorCode,
    userMessage: finalUserMessage,
    technicalMessage,
    originalError: error,
  };
};

/**
 * Helper para validar resposta da API
 */
export const validateApiResponse = (response: any) => {
  if (!response || response.error) {
    throw new Error(response?.error?.message || "Resposta inválida da API");
  }
  return response;
};

/**
 * Helper para criar mensagem de sucesso padronizada
 */
export const showSuccessMessage = (action: string, entity?: string) => {
  const messages: Record<string, string> = {
    create: `${entity || "Registro"} criado com sucesso!`,
    update: `${entity || "Registro"} atualizado com sucesso!`,
    delete: `${entity || "Registro"} excluído com sucesso!`,
    save: `${entity || "Dados"} salvos com sucesso!`,
    send: `${entity || "Dados"} enviados com sucesso!`,
    approve: `${entity || "Proposta"} aprovada com sucesso!`,
    reject: `${entity || "Proposta"} rejeitada com sucesso!`,
    upload: "Arquivo enviado com sucesso!",
    default: "Operação realizada com sucesso!",
  };

  toast({
    title: "Sucesso",
    description: messages[action] || messages.default,
  });
};
