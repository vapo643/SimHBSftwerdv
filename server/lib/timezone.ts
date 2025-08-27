/**
 * Utilitários de timezone para sincronização com horário de Brasília
 * Timezone: America/Sao_Paulo (UTC-3 ou UTC-2 durante horário de verão)
 */

// Timezone de Brasília
export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual no horário de Brasília
 */
export function getBrasiliaDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: BRASILIA_TIMEZONE }));
}

/**
 * Converte uma data para o horário de Brasília
 */
export function toBrasiliaDate(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: BRASILIA_TIMEZONE }));
}

/**
 * Formata uma data no padrão brasileiro (dd/mm/aaaa)
 */
export function formatBrazilianDate(date?: Date): string {
  const brasiliaDate = date ? toBrasiliaDate(date) : getBrasiliaDate();
  return brasiliaDate.toLocaleDateString('pt-BR', { timeZone: BRASILIA_TIMEZONE });
}

/**
 * Formata uma data com hora no padrão brasileiro (dd/mm/aaaa hh:mm:ss)
 */
export function formatBrazilianDateTime(date?: Date): string {
  const brasiliaDate = date ? toBrasiliaDate(date) : getBrasiliaDate();
  return brasiliaDate.toLocaleString('pt-BR', {
    timeZone: BRASILIA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Retorna timestamp no horário de Brasília para logs
 */
export function getBrasiliaTimestamp(): string {
  const now = getBrasiliaDate();
  return now.toISOString().replace('Z', '-03:00'); // Ajusta para mostrar fuso correto
}

/**
 * Converte string ISO para horário de Brasília
 */
export function parseISOToBrasilia(isoString: string): Date {
  return toBrasiliaDate(new Date(isoString));
}

/**
 * Gera data de aprovação no horário de Brasília
 */
export function generateApprovalDate(): string {
  return getBrasiliaDate().toISOString();
}
