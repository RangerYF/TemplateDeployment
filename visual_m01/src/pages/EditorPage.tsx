import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Scene3D } from '@/components/scene/Scene3D';
import { initEditor, resetEditor, initEditorWithSnapshot } from '@/editor/init';
import { setupShortcuts, teardownShortcuts } from '@/editor/shortcuts';
import { useEntityStore } from '@/editor/store/entityStore';
import { COLORS } from '@/styles/tokens';
import type { GeometryType } from '@/types/geometry';
import { loadSceneData } from '@/data/projects';
import {
  getDefaultSnapshotEnvelope,
  TEMPLATE_BRIDGE_NAMESPACE,
  TEMPLATE_BRIDGE_GLOBAL_KEY,
  buildSnapshotEnvelope,
  extractSceneSnapshot,
  validateSnapshotPayload,
} from '@/runtime/embed';

export function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetId = searchParams.get('preset');
  const locationState = location.state as {
    geometryType?: GeometryType;
    sceneData?: { entities: Record<string, import('@/editor/entities/types').Entity>; nextId: number; activeGeometryId: string | null };
    presetName?: string;
  } | null;
  const geometryType = locationState?.geometryType;
  const presetSceneData = locationState?.sceneData;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 初始化：加载作品或创建新场景 ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      resetEditor();

      if (presetSceneData) {
        initEditorWithSnapshot(presetSceneData);
      } else if (presetId) {
        const sceneData = await loadSceneData(presetId);
        if (cancelled) return;
        if (sceneData) {
          initEditorWithSnapshot(sceneData as Parameters<typeof initEditorWithSnapshot>[0]);
        } else {
          setError('预置作品加载失败');
        }
      } else {
        initEditor();
      }

      if (!cancelled) setLoading(false);
    }

    load();
    setupShortcuts();

    return () => {
      cancelled = true;
      teardownShortcuts();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryType, presetSceneData, presetId]);

  useEffect(() => {
    const bridge = {
      getDefaultSnapshot() {
        return getDefaultSnapshotEnvelope();
      },
      getSnapshot() {
        const snapshot = useEntityStore.getState().getSnapshot();
        return buildSnapshotEnvelope(snapshot);
      },
      loadSnapshot(snapshot: unknown) {
        const validation = validateSnapshotPayload(snapshot);
        if (!validation.ok) {
          throw new Error(validation.errors.join('；'));
        }
        const scene = extractSceneSnapshot(snapshot);
        if (!scene) {
          throw new Error('snapshot 结构无效');
        }
        resetEditor();
        initEditorWithSnapshot(scene as Parameters<typeof initEditorWithSnapshot>[0]);
      },
      validateSnapshot(snapshot: unknown) {
        return validateSnapshotPayload(snapshot);
      },
    };

    window[TEMPLATE_BRIDGE_GLOBAL_KEY] = bridge;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            namespace?: string;
            requestId?: string;
            type?: string;
            payload?: unknown;
          }
        | undefined;
      if (!data || data.namespace !== TEMPLATE_BRIDGE_NAMESPACE || !data.type) {
        return;
      }

      const respond = (success: boolean, payload?: unknown, error?: string) => {
        event.source?.postMessage(
          {
            namespace: TEMPLATE_BRIDGE_NAMESPACE,
            type: 'response',
            requestId: data.requestId,
            success,
            payload,
            error,
          },
          { targetOrigin: '*' },
        );
      };

      try {
        if (data.type === 'getDefaultSnapshot') {
          respond(true, bridge.getDefaultSnapshot());
          return;
        }

        if (data.type === 'getSnapshot') {
          respond(true, bridge.getSnapshot());
          return;
        }

        if (data.type === 'loadSnapshot') {
          bridge.loadSnapshot(data.payload);
          respond(true, { loaded: true });
          return;
        }

        if (data.type === 'validateSnapshot') {
          const result = bridge.validateSnapshot(data.payload);
          if (!result.ok) {
            respond(false, result, result.errors.join('；'));
            return;
          }
          respond(true, result);
        }
      } catch (error) {
        respond(false, undefined, error instanceof Error ? error.message : 'bridge 调用失败');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      delete window[TEMPLATE_BRIDGE_GLOBAL_KEY];
    };
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full" style={{ color: COLORS.textSecondary }}>
          加载中...
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p style={{ color: COLORS.error }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-md text-sm"
            style={{ backgroundColor: COLORS.primary, color: COLORS.white }}
          >
            返回编辑器
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Scene3D />
    </AppLayout>
  );
}
