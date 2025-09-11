/**
 * CONFIGURAÇÕES DE SEGURANÇA DA API
 *
 * Este arquivo centraliza todas as configurações de segurança
 * para facilitar manutenção e auditoria das políticas de segurança.
 */

import rateLimit from 'express-rate-limit';
import { log } from '../vite';

// ====================================
// CONFIGURAÇÕES DO HELMET
// ====================================
export const helmetConfig = {
  // Content Security Policy - Previne XSS e injection attacks
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-eval'", 'https://replit.com'], // unsafe-eval necessário para Vite, replit.com para banner de desenvolvimento
      workerSrc: ["'self'", 'blob:'], // Permite workers Sentry
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://*.sentry.io'], // WebSocket para Vite HMR + Sentry
      fontSrc: ["'self'", 'https:', 'data:'], // data: necessário para fontes embutidas do ambiente Replit
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // X-Frame-Options - Previne clickjacking
  frameguard: { action: 'deny' },
  // X-Content-Type-Options - Previne MIME sniffing
  noSniff: true,
  // Referrer-Policy - Controla informações de referência
  referrerPolicy: { policy: 'same-origin' },
  // X-XSS-Protection - Ativa proteção XSS do navegador
  xssFilter: true,
} as const;

// ====================================
// RATE LIMITING CONFIGURATIONS
// ====================================

// Rate Limit Geral para toda a API: Configuração dinâmica por ambiente
const isDevelopment = process.env.NODE_ENV === 'development';

export const generalApiLimiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1min dev, 15min prod
  max: isDevelopment ? 10000 : 2000, // 10k dev, 2000 prod
  message: {
    error: isDevelopment
      ? 'Rate limit atingido (modo desenvolvimento - limites altos)'
      : 'Muitas requisições da API. Tente novamente em 15 minutos.',
    retryAfter: isDevelopment ? '1 minuto' : '15 minutos',
  },
  standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  // Identifica usuário por IP
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'anonymous';
  },
  // Handler customizado para quando o limite é excedido
  handler: (req, res) => {
    log(`⚠️ Rate limit exceeded for IP: ${req.ip} on ${req.path} (ENV: ${process.env.NODE_ENV})`);
    res.status(429).json({
      error: isDevelopment
        ? 'Rate limit atingido (modo desenvolvimento - limites altos)'
        : 'Muitas requisições da API. Tente novamente em 15 minutos.',
      retryAfter: isDevelopment ? '1 minuto' : '15 minutos',
    });
  },
});

// Rate Limit Otimizado para Rotas de Autenticação: Configuração dinâmica por ambiente
// PAM V1.0 - Operação Portão de Aço: Otimizado para múltiplos usuários concorrentes
export const authApiLimiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1min dev, 15min prod
  max: isDevelopment ? 1000 : 100, // 1000 dev, 100 prod
  message: {
    error: isDevelopment
      ? 'Rate limit auth atingido (modo desenvolvimento)'
      : 'Limite de tentativas de login atingido. Tente novamente em 15 minutos.',
    retryAfter: isDevelopment ? '1 minuto' : '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Para rotas de auth, considere tanto IP quanto email (se disponível)
    const email = req.body?.email;
    const ip = req.ip || req.connection.remoteAddress || 'anonymous';
    return email ? `${ip}-${email}` : ip;
  },
  handler: (req, res) => {
    const email = req.body?.email;
    const limit = isDevelopment ? 1000 : 100;
    log(
      `🚨 Auth rate limit exceeded for IP: ${req.ip}${email ? `, email: ${email}` : ''} (${limit} req limit) ENV: ${process.env.NODE_ENV}`
    );
    res.status(429).json({
      error: isDevelopment
        ? 'Rate limit auth atingido (modo desenvolvimento)'
        : 'Limite de tentativas de login atingido. Tente novamente em 15 minutos.',
      retryAfter: isDevelopment ? '1 minuto' : '15 minutos',
    });
  },
  // Skip para rotas que não são de autenticação crítica
  skip: (req) => {
    const path = req.path;
    return !(
      path.includes('/login') ||
      path.includes('/register') ||
      path.includes('/reset-password')
    );
  },
});

// Rate Limit Extra-Restritivo para APIs críticas (opcional)
export const criticalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 requisições por janela de tempo
  message: {
    error: 'Muitas requisições para operação crítica. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'anonymous';
  },
  handler: (req, res) => {
    log(`🚨 Critical API rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Muitas requisições para operação crítica. Tente novamente em 15 minutos.',
      retryAfter: '15 minutos',
    });
  },
});

// ====================================
// CONFIGURAÇÕES DE PAYLOAD
// ====================================
export const payloadLimits = {
  json: '10mb', // Limite para JSON payload
  urlencoded: '10mb', // Limite para URL encoded payload
} as const;

// ====================================
// LOGS DE SEGURANÇA
// ====================================
export function logSecurityEvent(event: string, details: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `🛡️ [SECURITY] ${timestamp} - ${event}: ${JSON.stringify(details)}`;
  log(logMessage);

  // Em produção, você pode enviar estes logs para um serviço de monitoramento
  // como DataDog, New Relic, ou Sentry
}
