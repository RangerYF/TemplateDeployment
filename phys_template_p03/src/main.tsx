import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
(window as any).__TWEAKS = (window as any).__TWEAKS || { theme: 'light', rayThick: 2 };

async function bootstrap() {
  await import('./types');
  await import('./data/p03-experiments');
  await import('./theme');
  await import('./ui');
  await import('./module-refraction');
  await import('./module-lens');
  await import('./module-doubleslit');
  await import('./module-diffraction');
  await import('./module-thinfilm');
  await import('./app');
}

void bootstrap();
