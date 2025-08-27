/**
 * Rotas de Monitoramento do Banco de Dados
 */

import { Router } from 'express';
import {
  _getDatabaseStats,
  _getTableStats,
  _getIndexUsage,
  _getActiveConnections,
  _checkDatabaseHealth,
  _generateMonitoringReport,
} from '../utils/dbMonitoring';

const _router = Router();

/**
 * GET /api/monitoring/stats
 * Retorna estatísticas gerais do banco
 */
router.get('/stats', async (req, res) => {
  try {
    const _stats = await getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas do banco',
    });
  }
});

/**
 * GET /api/monitoring/tables
 * Retorna estatísticas das tabelas
 */
router.get('/tables', async (req, res) => {
  try {
    const _stats = await getTableStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Erro ao buscar estatísticas das tabelas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas das tabelas',
    });
  }
});

/**
 * GET /api/monitoring/indexes
 * Retorna uso de índices
 */
router.get('/indexes', async (req, res) => {
  try {
    const _usage = await getIndexUsage();
    res.json({ success: true, data: usage });
  } catch (error) {
    console.error('Erro ao buscar uso de índices:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar uso de índices',
    });
  }
});

/**
 * GET /api/monitoring/connections
 * Retorna conexões ativas
 */
router.get('/connections', async (req, res) => {
  try {
    const _connections = await getActiveConnections();
    res.json({ success: true, data: connections });
  } catch (error) {
    console.error('Erro ao buscar conexões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar conexões ativas',
    });
  }
});

/**
 * GET /api/monitoring/health
 * Verifica saúde do banco
 */
router.get('/health', async (req, res) => {
  try {
    const _health = await checkDatabaseHealth();
    const _statusCode =
      health.status == 'healthy'
        ? 200
        : health.status == 'warning'
          ? 200
          : health.status == 'critical'
            ? 503
            : 500;

    res.status(statusCode).json({ success: true, data: health });
  } catch (error) {
    console.error('Erro ao verificar saúde:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar saúde do banco',
    });
  }
});

/**
 * GET /api/monitoring/report
 * Gera relatório completo de monitoramento
 */
router.get('/report', async (req, res) => {
  try {
    const _report = await generateMonitoringReport();
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar relatório de monitoramento',
    });
  }
});

export default router;
