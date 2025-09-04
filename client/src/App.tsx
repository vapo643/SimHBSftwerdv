import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import NovaProposta from '@/pages/propostas/nova';
import FilaAnalise from '@/pages/credito/fila';
import AnaliseManualPage from '@/pages/credito/analise';
import Pagamentos from '@/pages/financeiro/pagamentos';
import CobrancasPage from '@/pages/financeiro/CobrancasPage';
import Formalizacao from '@/pages/formalizacao';
import TabelasComerciais from '@/pages/configuracoes/tabelas';
import UsuariosPage from '@/pages/admin/usuarios';
import PartnersPage from '@/pages/parceiros/index';
import PartnerDetailPage from '@/pages/parceiros/detalhe';
import ProdutosPage from '@/pages/configuracoes/produtos';
import LojasPage from '@/pages/admin/lojas';
import EditarPropostaPendenciada from '@/pages/propostas/editar';
import OWASPAssessment from '@/pages/admin/security/owasp-assessment';
import { WstgPage } from '@/pages/admin/security/wstg';
import MonitoramentoAvancadoPage from '@/pages/admin/security/dashboard';
import MonitoringDashboard from '@/pages/admin/monitoring/dashboard';
import SessoesAtivas from '@/pages/configuracoes/sessoes';
import AlterarEmail from '@/pages/configuracoes/alterar-email';
import Configuracoes from '@/pages/configuracoes';
import AceiteAtendente from '@/pages/aceite-atendente';
import GestaoContratos from '@/pages/GestaoContratos';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/propostas/nova">
        <ProtectedRoute>
          <NovaProposta />
        </ProtectedRoute>
      </Route>
      <Route path="/propostas/editar/:id">
        <ProtectedRoute>
          <EditarPropostaPendenciada />
        </ProtectedRoute>
      </Route>
      <Route path="/nova-proposta">
        <ProtectedRoute>
          <NovaProposta />
        </ProtectedRoute>
      </Route>
      <Route path="/credito/fila">
        <ProtectedRoute>
          <FilaAnalise />
        </ProtectedRoute>
      </Route>
      <Route path="/credito/analise/:id">
        <ProtectedRoute>
          <AnaliseManualPage />
        </ProtectedRoute>
      </Route>
      <Route path="/financeiro/pagamentos">
        <ProtectedRoute>
          <Pagamentos />
        </ProtectedRoute>
      </Route>
      <Route path="/financeiro/cobrancas">
        <ProtectedRoute>
          <CobrancasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/formalizacao">
        <ProtectedRoute>
          <Formalizacao />
        </ProtectedRoute>
      </Route>
      <Route path="/formalizacao/acompanhamento/:id">
        <ProtectedRoute>
          <Formalizacao />
        </ProtectedRoute>
      </Route>
      <Route path="/aceite-atendente">
        <ProtectedRoute>
          <AceiteAtendente />
        </ProtectedRoute>
      </Route>
      <Route path="/gestao/contratos">
        <ProtectedRoute>
          <GestaoContratos />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes/tabelas">
        <ProtectedRoute>
          <TabelasComerciais />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/usuarios">
        <ProtectedRoute>
          <UsuariosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/parceiros">
        <ProtectedRoute>
          <PartnersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/parceiros/detalhe/:id">
        <ProtectedRoute>
          <PartnerDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes">
        <ProtectedRoute>
          <Configuracoes />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes/produtos">
        <ProtectedRoute>
          <ProdutosPage />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes/sessoes">
        <ProtectedRoute>
          <SessoesAtivas />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes/alterar-email">
        <ProtectedRoute>
          <AlterarEmail />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/lojas">
        <ProtectedRoute>
          <LojasPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security/owasp">
        <ProtectedRoute>
          <OWASPAssessment />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security/wstg">
        <ProtectedRoute>
          <WstgPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/security/dashboard">
        <ProtectedRoute>
          <MonitoramentoAvancadoPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/monitoring/dashboard">
        <ProtectedRoute>
          <MonitoringDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <FeatureFlagProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </FeatureFlagProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
