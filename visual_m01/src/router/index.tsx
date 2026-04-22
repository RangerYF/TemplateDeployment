import { createBrowserRouter, Navigate } from 'react-router-dom';
import { EditorPage } from '@/pages/EditorPage';

function resolveBasename(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/' || normalized === '/editor') {
    return '/';
  }
  if (normalized.endsWith('/editor')) {
    return normalized.slice(0, -'/editor'.length) || '/';
  }
  return normalized;
}

const basename =
  typeof window === 'undefined' ? '/' : resolveBasename(window.location.pathname);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <EditorPage />,
  },
  {
    path: '/editor',
    element: <EditorPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
], {
  basename: basename === '/' ? undefined : basename,
});
