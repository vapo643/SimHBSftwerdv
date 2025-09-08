# Guia de Implementação de Biometria no ClickSign

## Funcionalidades Disponíveis (2025)

### 1. Biometria Facial

- **Nova funcionalidade**: Validação completa da identidade do signatário
- **Parceria**: Empresa Combate à Fraude (CAF)
- **Como funciona**: Face match - compara imagem do rosto com foto do documento
- **Documentação**: As imagens são anexadas ao documento final
- **Obrigatoriedade**: Não é possível finalizar sem esta etapa quando configurada

### 2. Autenticação via WhatsApp

- **Token de 6 dígitos**: Enviado via WhatsApp
- **Validade**: 4 horas quando enviado via WhatsApp
- **Perfil verificado**: Enviado através do perfil oficial da ClickSign
- **Aceite direto**: Possibilidade de aceitar termos sem sair do WhatsApp

### 3. Métodos de Autenticação Disponíveis

- Até 15 métodos diferentes:
  - Biometria facial
  - Selfie com documento
  - PIX
  - Certificado Digital
  - Token via Email/SMS/WhatsApp
  - Documento oficial
  - Assinatura manuscrita
  - Entre outros

## Implementação via API

### 1. Configurar Signatário com Biometria

```json
POST https://app.clicksign.com/api/v1/signers?access_token=TOKEN
{
  "signer": {
    "name": "Nome do Signatário",
    "email": "email@exemplo.com",
    "phone_number": "+5511999999999",
    "documentation": "CPF_SEM_PONTOS",
    "birthday": "YYYY-MM-DD",
    "auths": ["biometria_facial"], // Para biometria facial
    "delivery": "whatsapp" // Para enviar via WhatsApp
  }
}
```

### 2. Autenticação via WhatsApp

```json
{
  "signer": {
    "auths": ["token"], // Token de 6 dígitos
    "delivery": "whatsapp" // Envio via WhatsApp
  }
}
```

### 3. Múltiplas Autenticações

```json
{
  "signer": {
    "auths": ["biometria_facial", "token", "pix"], // Combinar métodos
    "delivery": "email" // ou "whatsapp" ou "sms"
  }
}
```

## Fluxo de Implementação

1. **Criar documento** no ClickSign
2. **Criar signatário** com autenticações desejadas
3. **Adicionar signatário ao documento**
4. **Enviar notificação** (via email/WhatsApp/SMS)
5. **Webhook recebe confirmação** quando assinado

## Configuração no Sistema Simpix

### 1. Adicionar campos na interface de formalização

- Checkbox para habilitar biometria facial
- Seleção do método de envio (Email/WhatsApp/SMS)
- Seleção de métodos de autenticação

### 2. Atualizar ClickSignServiceV3

- Adicionar parâmetros de autenticação ao criar signatário
- Suportar diferentes métodos de delivery

### 3. Webhook já está preparado

- O webhook já atualiza automaticamente quando o documento é assinado
- Campo `assinaturaEletronicaConcluida` é marcado como true

## Próximos Passos

1. Adicionar interface para seleção de biometria
2. Implementar envio via WhatsApp
3. Testar fluxo completo com biometria facial
4. Documentar para os atendentes

## Observações Importantes

- **Custo**: Pagamento apenas por documentos finalizados (assinados por todos)
- **Segurança**: Conformidade com LGPD e políticas de Segurança da Informação
- **Garantia**: Detecção de modificações no documento
- **Sandbox**: Disponível para testes antes da produção
