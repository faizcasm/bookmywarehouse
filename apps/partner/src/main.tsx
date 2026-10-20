import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import '@fontsource-variable/inter';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Match the router to the Vite base (/partner/ on Vercel, / locally).
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename || undefined}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
