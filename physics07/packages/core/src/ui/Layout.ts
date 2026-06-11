export interface LayoutElements {
  root: HTMLElement;
  rightSidebar: HTMLElement;
  canvas: HTMLElement;
  bottomPanel: HTMLElement;
  /** Playback controls mount (lives in the TopBar). Toggle `.hidden` to show/hide. */
  controlBar: HTMLElement;
  title: HTMLElement;
  tabBar: HTMLElement;
  subtitleLine: HTMLElement;
  /** TopBar theme-toggle button. */
  themeBtn: HTMLButtonElement;
  /** TopBar teaching (📖) button. */
  teachBtn: HTMLButtonElement;
}

export function createLayout(container: HTMLElement, titleText: string): LayoutElements {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'layout-root';

  // ── TopBar (P09-style) ──────────────────────────────────────────────────
  const title = document.createElement('div');
  title.className = 'app-topbar';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'topbar-title';
  titleSpan.textContent = titleText;
  title.appendChild(titleSpan);

  const tabBar = document.createElement('div');
  tabBar.className = 'scene-tab-bar';
  title.appendChild(tabBar);

  const spacer = document.createElement('div');
  spacer.className = 'topbar-spacer';
  title.appendChild(spacer);

  // playback controls mount (PlaybackControls renders into this)
  const controlBar = document.createElement('div');
  controlBar.className = 'topbar-playback';
  title.appendChild(controlBar);

  const themeBtn = document.createElement('button');
  themeBtn.className = 'topbar-icon-btn';
  themeBtn.title = '切换主题';
  themeBtn.textContent = '🌙';
  title.appendChild(themeBtn);

  const teachBtn = document.createElement('button');
  teachBtn.className = 'topbar-icon-btn';
  teachBtn.title = '教学要点';
  teachBtn.textContent = '📖';
  title.appendChild(teachBtn);

  // ── Subtitle (slim info strip) ──────────────────────────────────────────
  const subtitleLine = document.createElement('div');
  subtitleLine.className = 'layout-subtitle';

  // ── Body: center(canvas+graph) · right sidebar(params + readouts) ───────
  const body = document.createElement('div');
  body.className = 'layout-body';

  const center = document.createElement('div');
  center.className = 'layout-center';

  const canvasArea = document.createElement('div');
  canvasArea.className = 'layout-canvas';

  const bottomPanel = document.createElement('div');
  bottomPanel.className = 'layout-bottom';

  center.appendChild(canvasArea);
  center.appendChild(bottomPanel);

  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'layout-right-sidebar';

  // Drawer close (×) — only visible on narrow screens (CSS-gated)
  const drawerClose = document.createElement('button');
  drawerClose.className = 'sidebar-drawer-close';
  drawerClose.setAttribute('aria-label', '关闭参数面板');
  drawerClose.textContent = '×';
  rightSidebar.appendChild(drawerClose);

  body.appendChild(center);
  body.appendChild(rightSidebar);

  // ── Responsive drawer (P09-style): on <lg screens the sidebar slides in ───
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';

  const fab = document.createElement('button');
  fab.className = 'sidebar-fab';
  fab.title = '参数面板';
  fab.setAttribute('aria-label', '打开参数面板');
  fab.textContent = '⚙';

  const openDrawer = () => root.classList.add('sidebar-open');
  const closeDrawer = () => root.classList.remove('sidebar-open');
  fab.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  root.appendChild(title);
  root.appendChild(subtitleLine);
  root.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(fab);

  container.appendChild(root);

  return {
    root,
    rightSidebar,
    canvas: canvasArea,
    bottomPanel,
    controlBar,
    title,
    tabBar,
    subtitleLine,
    themeBtn,
    teachBtn,
  };
}
