import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import NovaProposta from "@/pages/propostas/nova";
import FilaAnalise from "@/pages/credito/fila";
import AnaliseManual from "@/pages/credito/analise";
import Pagamentos from "@/pages/financeiro/pagamentos";
import Cobrancas from "@/pages/financeiro/cobrancas";
import Formalizacao from "@/pages/formalizacao";
import TabelasComerciais from "@/pages/configuracoes/tabelas";
import UsuariosPage from "@/pages/admin/usuarios";
import PartnersPage from "@/pages/parceiros/index";
import PartnerDetailPage from "@/pages/parceiros/detalhe";
import ProdutosPage from "@/pages/configuracoes/produtos";
import LojasPage from "@/pages/admin/lojas";
import EditarPropostaPendenciada from "@/pages/propostas/editar";
import OWASPAssessment from "@/pages/admin/security/owasp-assessment";
import { WstgPage } from "@/pages/admin/security/wstg";
import SecurityDashboard from "@/pages/SecurityDashboard";
import SessoesAtivas from "@/pages/configuracoes/sessoes";
import AlterarEmail from "@/pages/configuracoes/alterar-email";
import Configuracoes from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

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
          <AnaliseManual />
        </ProtectedRoute>
      </Route>
      <Route path="/financeiro/pagamentos">
        <ProtectedRoute>
          <Pagamentos />
        </ProtectedRoute>
      </Route>
      <Route path="/financeiro/cobrancas">
        <ProtectedRoute>
          <Cobrancas />
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
          <SecurityDashboard />
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
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
