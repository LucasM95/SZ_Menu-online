import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App.jsx';

// O painel só é baixado por quem acessa /admin; o cliente do cardápio não carrega esse código
const Admin = lazy(() => import('./admin/Admin.jsx'));
const ehAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ehAdmin ? (
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);
