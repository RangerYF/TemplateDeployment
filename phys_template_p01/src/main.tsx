import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/shell';
import { isFullAppMode } from '@/app-config';
import { registerMechanicsDomain } from '@/domains/mechanics';
import { registerEmDomain } from '@/domains/em';
import { registerThermalDomain } from '@/domains/thermal';
import { ensureRandomUUID } from '@/lib/ensure-random-uuid';
import './styles/globals.css';

ensureRandomUUID();

// 注册物理域
registerEmDomain();
if (isFullAppMode) {
  registerMechanicsDomain();
  registerThermalDomain();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
