import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from '@bmw/ui';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@fontsource-variable/inter';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
);
