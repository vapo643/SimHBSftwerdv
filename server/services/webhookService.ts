class WebhookService {
  async processWebhook(provider: string, payload: any): Promise<any> {
    console.log(`[WEBHOOK_SERVICE] Processing webhook from ${provider}:`, payload);
    // Implementação básica - pode ser expandida conforme necessário
    return { success: true, provider, payload };
  }
}

export const webhookService = new WebhookService();
export default webhookService;
