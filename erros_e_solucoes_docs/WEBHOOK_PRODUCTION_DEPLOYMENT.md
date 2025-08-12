# 🚀 DEPLOY DO WEBHOOK EM PRODUÇÃO

## 📋 Checklist para Deploy

### ✅ 1. Domínio Oficial
- [ ] Registrar domínio da empresa (ex: `sistema.eleeve.com.br`)
- [ ] Configurar SSL/TLS (certificado HTTPS)
- [ ] Apontar DNS para servidor de produção

### ✅ 2. Servidor de Produção
- [ ] Deploy do sistema no servidor (AWS, Google Cloud, Azure, etc.)
- [ ] Configurar variáveis de ambiente:
  ```bash
  CLICKSIGN_WEBHOOK_SECRET=secret_real_da_producao
  CLICKSIGN_API_TOKEN=token_real_da_producao
  INTER_CLIENT_ID=client_id_real
  INTER_CLIENT_SECRET=client_secret_real
  NODE_ENV=production
  ```

### ✅ 3. URL Final do Webhook
```
https://sistema.eleeve.com.br/api/clicksign/webhook
```

### ✅ 4. Configuração no ClickSign
1. **Ambiente de Produção do ClickSign**
   - Usar conta real (não sandbox)
   - URL: https://app.clicksign.com (não sandbox)

2. **Webhook Configuration**
   - URL: `https://sistema.eleeve.com.br/api/clicksign/webhook`
   - Gerar novo webhook secret para produção
   - Configurar todos os eventos necessários

### ✅ 5. Segurança em Produção
- [ ] Firewall configurado
- [ ] Rate limiting ativo
- [ ] Logs de auditoria ativos
- [ ] Backup automático
- [ ] Monitoramento 24/7

## 🔄 Processo de Migração

### Passo 1: Preparar Produção
```bash
# 1. Deploy do código para produção
git clone seu-repositorio
npm install
npm run build

# 2. Configurar PM2 ou similar para manter ativo
pm2 start npm --name "sistema-credito" -- run start
pm2 save
```

### Passo 2: Configurar Webhook Produção
1. No painel ClickSign (conta real)
2. Desativar webhook de desenvolvimento
3. Criar novo webhook com URL de produção
4. Testar com documento real

### Passo 3: Validar Integração
- [ ] Teste completo: CCB → Assinatura → Boleto
- [ ] Verificar logs de produção
- [ ] Confirmar webhooks funcionando
- [ ] Validar integração Inter Bank

## 🏢 Exemplo para Eleeve

### URLs Sugeridas:
- **Sistema Principal**: `https://sistema.eleeve.com.br`
- **Webhook ClickSign**: `https://sistema.eleeve.com.br/api/clicksign/webhook`  
- **API**: `https://api.eleeve.com.br`

### Infraestrutura Recomendada:
- **Servidor**: AWS EC2 ou Google Cloud Compute
- **Banco**: PostgreSQL (AWS RDS)
- **SSL**: Let's Encrypt ou Cloudflare
- **CDN**: Cloudflare
- **Monitoramento**: New Relic ou DataDog

## ⚡ Status Atual

- ✅ Código 100% pronto para produção
- ✅ Webhook funcional e testado
- ✅ Integração ClickSign + Inter completa
- ✅ Segurança OWASP implementada
- 🔄 **PRÓXIMO**: Deploy em domínio oficial

## 📞 Próximos Passos

1. **Definir domínio oficial** (ex: sistema.eleeve.com.br)
2. **Escolher provedor cloud** (AWS, Google, Azure)
3. **Fazer deploy do sistema**
4. **Reconfigurar webhook no ClickSign**
5. **Testar fluxo completo em produção**

**Prazo**: Sistema pode estar em produção em 24-48h após definição do domínio.