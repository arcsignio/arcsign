import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './index.css';

// Initialize i18n
import './locales';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary level="app">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
