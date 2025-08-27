/**
 * CONFIGURAÇÕES DE SEGURANÇA DA API
 *
 * Este arquivo centraliza todas as configurações de segurança
 * para facilitar manutenção e auditoria das políticas de segurança.
 */

import rateLimit from 'express-rate-limit';
import { log } from '../vite';

// ========================
// CONFIGURAÇÕES DO HELMET
// ========================
export const _helmetConfig = {
  // Content Security Policy - Previne XSS e injection attacks
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-eval'", 'https://replit.com'], // unsafe-eval necessário para Vite, replit.com para banner de desenvolvimento
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'], // WebSocket para Vite HMR
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

// ========================
// RATE LIMITING CONFIGURATIONS
// ========================

// Rate Limit Geral para toda a API: 100 requisições por 15 minutos
export const _generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requisições por janela de tempo
  message: {
    error: 'Muitas requisições da API. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  // Identifica usuário por IP
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'anonymous';
  },
  // Handler customizado para quando o limite é excedido
  handler: (req, res) => {
    log(`⚠️ Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Muitas requisições da API. Tente novamente em 15 minutos.',
      retryAfter: '15 minutos',
    });
  },
});

// Rate Limit Restritivo para Rotas de Autenticação: 5 requisições por 15 minutos
export const _authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de login por janela de tempo
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Para rotas de auth, considere tanto IP quanto email (se disponível)
    const _email = req.body?.email;
    const _ip = req.ip || req.connection.remoteAddress || 'anonymous';
    return email ? `${ip}-${email}` : ip;
  },
  handler: (req, res) => {
    const _email = req.body?.email;
    log(`🚨 Auth rate limit exceeded for IP: ${req.ip}${email ? `, email: ${email}` : ''}`);
    res.status(429).json({
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: '15 minutos',
    });
  },
  // Skip para rotas que não são de autenticação crítica
  skip: (req) => {
    const _path = req.path;
    return !(
      path.includes('/login') ||
      path.includes('/register') ||
      path.includes('/reset-password')
    );
  },
});

// Rate Limit Extra-Restritivo para APIs críticas (opcional)
export const _criticalApiLimiter = rateLimit({
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

// ========================
// CONFIGURAÇÕES DE PAYLOAD
// ========================
export const _payloadLimits = {
  json: '10mb', // Limite para JSON payload
  urlencoded: '10mb', // Limite para URL encoded payload
} as const;

// ========================
// LOGS DE SEGURANÇA
// ========================
export function logSecurityEvent(event: string, details) {
  const _timestamp = new Date().toISOString();
  const _logMessage = `🛡️ [SECURITY] ${timestamp} - ${event}: ${JSON.stringify(details)}`;
  log(logMessage);

  // Em produção, você pode enviar estes logs para um serviço de monitoramento
  // como DataDog, New Relic, ou Sentry
}
