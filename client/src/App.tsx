
import { Switch, Route } from "wouter";

export default function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Simpix - Sistema de Crédito</h1>
      <p>Aplicação carregada com sucesso!</p>
      
      <Switch>
        <Route path="/login">
          <div>
            <h2>Página de Login</h2>
            <p>Funcionalidade de login será implementada aqui.</p>
          </div>
        </Route>
        
        <Route path="/dashboard">
          <div>
            <h2>Dashboard</h2>
            <p>Painel principal será implementado aqui.</p>
          </div>
        </Route>
        
        <Route path="/">
          <div>
            <h2>Bem-vindo ao Simpix</h2>
            <nav style={{ marginTop: "20px" }}>
              <ul style={{ listStyle: "none", padding: 0 }}>
                <li style={{ marginBottom: "10px" }}>
                  <a href="/dashboard" style={{ color: "#007bff", textDecoration: "none" }}>
                    📊 Dashboard
                  </a>
                </li>
                <li style={{ marginBottom: "10px" }}>
                  <a href="/login" style={{ color: "#007bff", textDecoration: "none" }}>
                    🔐 Login
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </Route>
      </Switch>
    </div>
  );
}
