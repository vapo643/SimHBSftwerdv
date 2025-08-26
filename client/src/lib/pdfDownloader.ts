// ==========================================
// SOLUÇÃO COMPLETA DE DOWNLOAD DE PDF COM JWT
// ==========================================

import { apiClient } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

export class PDFDownloader {
  /**
   * ESTRATÉGIA 1: Download via API Client (Recomendada)
   * Usa o sistema de autenticação já estabelecido
   */
  static async downloadPdfViaApiClient(
    propostaId: string,
    codigoSolicitacao: string,
    numeroParcela?: number
  ): Promise<void> {
    try {
      console.log('[PDF_DOWNLOAD] Starting download via API client:', {
        propostaId,
        codigoSolicitacao,
        numeroParcela,
      });

      // Usar o apiClient que já tem autenticação configurada
      const response = await apiClient(
        `/inter/collections/${propostaId}/${codigoSolicitacao}/pdf`,
        {
          method: 'GET',
          // Configurações específicas para download de arquivo
          responseType: 'blob',
          timeout: 60000, // 60 segundos para downloads
          headers: {
            Accept: 'application/pdf',
          },
        }
      );

      // Verificar se recebemos um blob válido
      if (!response || !(response instanceof Blob)) {
        throw new Error('Response is not a valid blob');
      }

      // Criar download
      const url = window.URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleto-${numeroParcela ? `parcela-${numeroParcela}` : codigoSolicitacao}.pdf`;

      // Garantir que o elemento está no DOM antes de clicar
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('[PDF_DOWNLOAD] ✅ Download completed successfully');
    } catch (error) {
      console.error('[PDF_DOWNLOAD] ❌ Error in API client download:', error);
      throw error;
    }
  }

  /**
   * ESTRATÉGIA 2: Download via Fetch Melhorado
   * Com retry automático e melhor tratamento de token
   */
  static async downloadPdfViaFetch(
    propostaId: string,
    codigoSolicitacao: string,
    numeroParcela?: number,
    maxRetries: number = 2
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[PDF_DOWNLOAD] Fetch attempt ${attempt}/${maxRetries}:`, {
          propostaId,
          codigoSolicitacao,
        });

        // Importar e obter token fresco a cada tentativa
        const { TokenManager } = await import('@/lib/apiClient');
        const tokenManager = TokenManager.getInstance();

        // Forçar refresh do token se não for a primeira tentativa
        const token = await tokenManager.getValidToken(attempt > 1);

        if (!token) {
          throw new Error('No authentication token available');
        }

        console.log(
          `[PDF_DOWNLOAD] Token obtained (${token.length} chars):`,
          token.substring(0, 20) + '...'
        );

        const url = `/api/inter/collections/${propostaId}/${codigoSolicitacao}/pdf`;
        console.log(`[PDF_DOWNLOAD] Making request to: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/pdf, */*',
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Importante para CORS
          cache: 'no-cache',
        });

        console.log(`[PDF_DOWNLOAD] Response status: ${response.status}`);
        console.log(
          `[PDF_DOWNLOAD] Response headers:`,
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          // Tentar parsear resposta de erro como JSON
          let errorMessage: string;
          let errorDetails: unknown = null;

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              const errorJson = await response.json();
              errorMessage = errorJson.error || response.statusText;
              errorDetails = errorJson;
              console.error(`[PDF_DOWNLOAD] HTTP Error ${response.status} (JSON):`, errorJson);
            } catch {
              errorMessage = await response.text();
              console.error(`[PDF_DOWNLOAD] HTTP Error ${response.status} (Text):`, errorMessage);
            }
          } else {
            errorMessage = await response.text();
            console.error(`[PDF_DOWNLOAD] HTTP Error ${response.status} (Text):`, errorMessage);
          }

          // Se for 401, tentar refresh do token na próxima iteração
          if (response.status === 401 && attempt < maxRetries) {
            lastError = new Error(`Authentication failed (attempt ${attempt}): ${errorMessage}`);
            continue;
          }

          // Mostrar mensagem de erro específica do servidor
          const error = new Error(
            errorMessage || `HTTP ${response.status}: ${response.statusText}`
          );
          (error as unknown).details = errorDetails;
          throw error;
        }

        // CRITICAL: Verificar se é realmente um PDF antes de criar blob
        const contentType = response.headers.get('content-type');
        console.log(`[PDF_DOWNLOAD] Response Content-Type: ${contentType}`);

        // Se não for PDF, verificar se é erro JSON
        if (contentType && !contentType.includes('application/pdf')) {
          console.warn(`[PDF_DOWNLOAD] Response is not PDF, checking for error...`);

          // Se for JSON, é uma mensagem de erro
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            console.error(`[PDF_DOWNLOAD] Server returned JSON error:`, errorData);
            throw new Error(errorData.error || errorData.message || 'Erro ao baixar PDF');
          }

          // Se não for nem PDF nem JSON, erro desconhecido
          throw new Error(`Tipo de resposta inválido: ${contentType}`);
        }

        const blob = await response.blob();
        console.log(`[PDF_DOWNLOAD] Blob size: ${blob.size} bytes, type: ${blob.type}`);

        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        // Validação adicional: verificar magic bytes do PDF
        const arrayBuffer = await blob.slice(0, 5).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const pdfMagic = String.fromCharCode(...bytes);

        if (!pdfMagic.startsWith('%PDF')) {
          console.error(`[PDF_DOWNLOAD] File is not a valid PDF. Magic bytes: ${pdfMagic}`);
          throw new Error('Arquivo baixado não é um PDF válido');
        }

        // Criar download
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `boleto-${numeroParcela ? `parcela-${numeroParcela}` : codigoSolicitacao}.pdf`;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();

        // Cleanup com delay para garantir que o download iniciou
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
          document.body.removeChild(a);
        }, 100);

        console.log('[PDF_DOWNLOAD] ✅ Fetch download completed successfully');
        return; // Sucesso, sair do loop
      } catch (error) {
        lastError = error as Error;
        console.error(`[PDF_DOWNLOAD] ❌ Fetch attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          break; // Última tentativa falhou, sair do loop
        }

        // Delay antes da próxima tentativa
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError || new Error('All download attempts failed');
  }

  /**
   * MÉTODO PRINCIPAL: Tenta múltiplas estratégias automaticamente
   */
  static async downloadPdf(
    propostaId: string,
    codigoSolicitacao: string,
    numeroParcela?: number
  ): Promise<void> {
    const strategies = [
      {
        name: 'Fetch Enhanced',
        method: () => this.downloadPdfViaFetch(propostaId, codigoSolicitacao, numeroParcela),
      },
      {
        name: 'API Client',
        method: () => this.downloadPdfViaApiClient(propostaId, codigoSolicitacao, numeroParcela),
      },
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        console.log(`[PDF_DOWNLOAD] Trying strategy: ${strategy.name}`);
        await strategy.method();

        // Sucesso - mostrar toast de sucesso
        toast({
          title: 'Download concluído',
          description: 'O boleto foi baixado com sucesso',
          variant: 'default',
        });

        return; // Sucesso, sair da função
      } catch (error) {
        lastError = error as Error;
        console.error(`[PDF_DOWNLOAD] Strategy "${strategy.name}" failed:`, error);
        continue; // Tentar próxima estratégia
      }
    }

    // Se chegou aqui, todas as estratégias falharam
    console.error('[PDF_DOWNLOAD] ❌ All download strategies failed:', lastError);

    // Mensagem de erro mais amigável baseada no erro específico
    let errorTitle = 'Erro no download';
    let errorDescription = lastError?.message || 'Erro desconhecido';

    // Customizar mensagem baseada no tipo de erro
    if (
      lastError?.message.includes('não disponibiliza PDF') ||
      lastError?.message.includes('406') ||
      lastError?.message.includes('não está disponível') ||
      lastError?.message.includes('Use o código de barras')
    ) {
      errorTitle = 'PDF não disponível';
      errorDescription =
        'O banco Inter não disponibiliza o PDF para download. Use o código de barras ou QR Code exibidos na tela para realizar o pagamento.';
    } else if (lastError?.message.includes('não está disponível para download')) {
      errorTitle = 'Boleto não disponível';
      errorDescription =
        'O boleto ainda não foi gerado ou não está pronto para download. Tente novamente em alguns instantes.';
    } else if (lastError?.message.includes('400')) {
      errorTitle = 'Boleto indisponível';
      errorDescription =
        'O banco não conseguiu gerar o PDF do boleto. Verifique se o boleto foi criado corretamente.';
    } else if (
      lastError?.message.includes('401') ||
      lastError?.message.includes('Authentication')
    ) {
      errorTitle = 'Erro de autenticação';
      errorDescription = 'Sua sessão expirou. Por favor, faça login novamente.';
    }

    toast({
      title: errorTitle,
      description: errorDescription,
      variant: 'destructive',
    });

    throw lastError || new Error('All download strategies failed');
  }
}

// ==========================================
// UTILITY FUNCTIONS PARA DEBUGGING
// ==========================================

export class DownloadDebugger {
  /**
   * Test JWT token validity
   */
  static async testTokenValidity(): Promise<void> {
    try {
      console.log('[DEBUG] Testing token validity...');

      const { TokenManager } = await import('@/lib/apiClient');
      const tokenManager = TokenManager.getInstance();
      const token = await tokenManager.getValidToken();

      if (!token) {
        console.error('[DEBUG] ❌ No token available');
        return;
      }

      console.log('[DEBUG] ✅ Token obtained:', {
        length: token.length,
        preview: token.substring(0, 20) + '...',
      });

      // Test token with a simple API call
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('[DEBUG] Auth test response:', {
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) {
        const user = await response.json();
        console.log('[DEBUG] ✅ Token is valid for user:', user.id);
      } else {
        const error = await response.text();
        console.error('[DEBUG] ❌ Token validation failed:', error);
      }
    } catch (error) {
      console.error('[DEBUG] ❌ Token test failed:', error);
    }
  }

  /**
   * Test PDF download endpoint directly
   */
  static async testPdfEndpoint(propostaId: string, codigoSolicitacao: string): Promise<void> {
    try {
      console.log('[DEBUG] Testing PDF endpoint directly...');

      const { TokenManager } = await import('@/lib/apiClient');
      const tokenManager = TokenManager.getInstance();
      const token = await tokenManager.getValidToken();

      if (!token) {
        console.error('[DEBUG] ❌ No token for PDF test');
        return;
      }

      const url = `/api/inter/collections/${propostaId}/${codigoSolicitacao}/pdf`;
      console.log('[DEBUG] Testing URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      console.log('[DEBUG] PDF endpoint response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const blob = await response.blob();
        console.log('[DEBUG] ✅ PDF blob received:', {
          size: blob.size,
          type: blob.type,
        });
      } else {
        const errorText = await response.text();
        console.error('[DEBUG] ❌ PDF endpoint failed:', errorText);
      }
    } catch (error) {
      console.error('[DEBUG] ❌ PDF endpoint test failed:', error);
    }
  }
}
