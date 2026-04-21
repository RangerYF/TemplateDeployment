import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/shell';
import { registerMechanicsDomain } from '@/domains/mechanics';
import { registerEmDomain } from '@/domains/em';
import { registerThermalDomain } from '@/domains/thermal';
import './styles/globals.css';

// 注册物理域
registerMechanicsDomain();
registerEmDomain();
registerThermalDomain();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
