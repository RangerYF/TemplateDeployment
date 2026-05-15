export interface LayoutElements {
  root: HTMLElement;
  leftSidebar: HTMLElement;
  rightSidebar: HTMLElement;
  canvas: HTMLElement;
  bottomPanel: HTMLElement;
  controlBar: HTMLElement;
  title: HTMLElement;
  tabBar: HTMLElement;
  subtitleLine: HTMLElement;
  /** @deprecated Use leftSidebar or rightSidebar */
  sidebar: HTMLElement;
}

export function createLayout(container: HTMLElement, titleText: string): LayoutElements {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'layout-root';

  const title = document.createElement('div');
  title.className = 'layout-title';

  const homeBtn = document.createElement('a');
  homeBtn.className = 'home-btn';
  homeBtn.href = 'index.html';
  homeBtn.title = '返回首页';
  homeBtn.innerHTML = '⌂';
  title.appendChild(homeBtn);

  const titleSpan = document.createElement('span');
  titleSpan.textContent = titleText;
  title.appendChild(titleSpan);

  const tabBar = document.createElement('div');
  tabBar.className = 'scene-tab-bar';
  title.appendChild(tabBar);

  const subtitleLine = document.createElement('div');
  subtitleLine.className = 'layout-subtitle';

  const body = document.createElement('div');
  body.className = 'layout-body';

  const leftSidebar = document.createElement('div');
  leftSidebar.className = 'layout-left-sidebar';

  const center = document.createElement('div');
  center.className = 'layout-center';

  const canvasArea = document.createElement('div');
  canvasArea.className = 'layout-canvas';

  const bottomPanel = document.createElement('div');
  bottomPanel.className = 'layout-bottom';

  const controlBar = document.createElement('div');
  controlBar.className = 'layout-controls';

  center.appendChild(canvasArea);
  center.appendChild(bottomPanel);
  center.appendChild(controlBar);

  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'layout-right-sidebar';

  body.appendChild(leftSidebar);
  body.appendChild(center);
  body.appendChild(rightSidebar);

  root.appendChild(title);
  root.appendChild(subtitleLine);
  root.appendChild(body);

  container.appendChild(root);

  return {
    root,
    leftSidebar,
    rightSidebar,
    canvas: canvasArea,
    bottomPanel,
    controlBar,
    title,
    tabBar,
    subtitleLine,
    sidebar: rightSidebar,
  };
}
