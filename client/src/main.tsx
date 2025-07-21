import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  root.render(
    <div style={{ padding: "20px", color: "red" }}>
      <h1>Erro de Carregamento</h1>
      <p>Houve um erro ao carregar a aplicação. Verifique o console para mais detalhes.</p>
    </div>
  );
}
