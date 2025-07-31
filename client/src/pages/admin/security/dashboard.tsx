/**
 * Monitoramento Avançado - Interface pública do Projeto Cérbero
 * 
 * Dashboard de segurança em tempo real com visualização de vulnerabilidades,
 * anomalias e métricas de segurança para o sistema Simpix.
 */

import DashboardLayout from "@/components/DashboardLayout";
import SecurityDashboard from "@/pages/SecurityDashboard";

export default function MonitoramentoAvancadoPage() {
  return (
    <DashboardLayout title="Monitoramento Avançado">
      <SecurityDashboard />
    </DashboardLayout>
  );
}