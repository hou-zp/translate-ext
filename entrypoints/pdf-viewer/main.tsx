import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../assets/tailwind.css';
import { ToastProvider } from '../../src/components/ui';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
