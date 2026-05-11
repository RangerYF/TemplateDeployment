export interface LayoutElements {
  root: HTMLElement;
  sidebar: HTMLElement;
  canvas: HTMLElement;
  bottomPanel: HTMLElement;
  controlBar: HTMLElement;
  title: HTMLElement;
}

/**
 * Creates a 1920x1080-optimized layout:
 * - Left sidebar: 280px (parameter panel)
 * - Center: canvas area (auto-fill)
 * - Bottom: 280px (graphs + playback controls)
 */
export function createLayout(container: HTMLElement, titleText: string): LayoutElements {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'layout-root';

  // Title bar
  const title = document.createElement('div');
  title.className = 'layout-title';

  // Home button
  const homeBtn = document.createElement('a');
  homeBtn.className = 'home-btn';
  homeBtn.href = 'index.html';
  homeBtn.title = '返回首页';
  homeBtn.innerHTML = '⌂';
  title.appendChild(homeBtn);

  // Title text
  const titleSpan = document.createElement('span');
  titleSpan.textContent = titleText;
  title.appendChild(titleSpan);

  // Main area (sidebar + canvas)
  const main = document.createElement('div');
  main.className = 'layout-main';

  const sidebar = document.createElement('div');
  sidebar.className = 'layout-sidebar';

  const canvasArea = document.createElement('div');
  canvasArea.className = 'layout-canvas';

  main.appendChild(sidebar);
  main.appendChild(canvasArea);

  // Bottom panel (graphs + controls)
  const bottomPanel = document.createElement('div');
  bottomPanel.className = 'layout-bottom';

  const controlBar = document.createElement('div');
  controlBar.className = 'layout-controls';

  root.appendChild(title);
  root.appendChild(main);
  root.appendChild(bottomPanel);
  root.appendChild(controlBar);

  container.appendChild(root);

  return { root, sidebar, canvas: canvasArea, bottomPanel, controlBar, title };
}
