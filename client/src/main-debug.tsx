// Minimal test file for debugging frontend issues
import { createRoot } from 'react-dom/client';

function TestApp() {
  return (
    <div style={{ padding: '20px', fontSize: '24px', color: 'green' }}>
      ✅ REACT FUNCIONANDO!
      <br />
      Simpix está carregando corretamente
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TestApp />);