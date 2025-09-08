# ClickSign Biometric Authentication - Research Findings

## Executive Summary

After extensive testing and research, I've discovered that biometric facial authentication in ClickSign API v1 requires:

1. **Enterprise Plan** - Biometric authentication is only available for "Empresarial" (Enterprise) plan accounts
2. **Account Activation** - Must be enabled in the ClickSign dashboard before API usage
3. **Boolean Flag** - Use `facial_biometrics_enabled: true` when creating signers
4. **No Auth Array Changes** - Keep `auths: ["email"]` - biometric is NOT specified in the auths array

## Key Findings

### 1. API Implementation

```javascript
// CORRECT implementation for biometric authentication
{
  signer: {
    name: "João Silva",
    email: "joao@example.com",
    documentation: "12345678900",
    auths: ["email"], // Always use "email" only
    delivery: "email",
    facial_biometrics_enabled: true // This enables biometric
  }
}
```

### 2. Invalid Authentication Types

All these values in the `auths` array return "Autenticação inválida":

- ❌ "biometria_facial"
- ❌ "selfie"
- ❌ "facial"
- ❌ "biometric"
- ❌ "face"
- ❌ "facial_biometric"

Only valid value: ✅ "email"

### 3. Boolean Flag Conflicts

**DO NOT** use these together:

```javascript
// This causes an error
{
  facial_biometrics_enabled: true,
  selfie_enabled: true, // Conflicts!
  liveness_enabled: true // Conflicts!
}
```

Error: "Assinatura por selfie dinâmica deve estar desabilitada quando a Biometria facial estiver habilitada"

### 4. Account Requirements

From ClickSign documentation:

- **Plan**: Available from "Empresarial" (Enterprise) plan
- **Activation**: Must be enabled in dashboard under Settings → Security
- **Cost**: Free for facial biometric (Serpro validation costs R$ 4.50/query)

## Why It's Not Working

The most likely reasons biometric authentication isn't appearing:

1. **Account Plan** - The ClickSign account might not be on Enterprise plan
2. **Not Activated** - Feature not enabled in ClickSign dashboard
3. **API Limitation** - Biometric might require API v3 (envelopes) for full functionality

## Next Steps

1. **Verify Plan** - Check if the ClickSign account is on Enterprise plan
2. **Dashboard Settings** - Go to ClickSign Settings → Security → Enable "Autenticação por Biometria Facial"
3. **Contact Support** - If on Enterprise plan and still not working, contact ClickSign support
4. **Consider API v3** - The newer Envelopes API might have better biometric support

## Implementation Status

✅ Code correctly sends `facial_biometrics_enabled: true`
✅ API accepts the parameter without errors
❓ Biometric not appearing - likely account configuration issue

## Official Documentation Quote

"Quando solicitada a autenticação por biometria facial não há a possibilidade de finalizar o processo de assinatura sem esta etapa."
(When facial biometry authentication is requested, there is no possibility to finalize the signature process without this step.)

This confirms that once properly configured, biometric WILL be mandatory.
