export interface PageSnapshotAdapter<TSnapshot = unknown> {
  getSnapshot(): TSnapshot;
  loadSnapshot(snapshot: TSnapshot): void;
}

const adapters = new Map<string, PageSnapshotAdapter>();
const pendingSnapshots = new Map<string, unknown>();
const latestSnapshots = new Map<string, unknown>();

export function registerPageSnapshotAdapter(
  key: string,
  adapter: PageSnapshotAdapter,
): () => void {
  adapters.set(key, adapter);

  if (pendingSnapshots.has(key)) {
    const snapshot = pendingSnapshots.get(key);
    pendingSnapshots.delete(key);
    window.setTimeout(() => {
      if (adapters.get(key) === adapter) {
        adapter.loadSnapshot(snapshot);
      }
    }, 0);
  }

  return () => {
    if (adapters.get(key) === adapter) {
      adapters.delete(key);
    }
  };
}

export function getPageSnapshots(): Record<string, unknown> {
  for (const [key, adapter] of adapters.entries()) {
    latestSnapshots.set(key, adapter.getSnapshot());
  }

  return Object.fromEntries(
    Array.from(latestSnapshots.entries()),
  );
}

export function loadPageSnapshots(snapshots: Record<string, unknown> | undefined): void {
  if (!snapshots || typeof snapshots !== 'object') return;

  for (const [key, snapshot] of Object.entries(snapshots)) {
    const adapter = adapters.get(key);
    if (adapter) {
      adapter.loadSnapshot(snapshot);
      window.setTimeout(() => {
        if (adapters.get(key) === adapter) {
          adapter.loadSnapshot(snapshot);
        }
      }, 0);
    } else {
      pendingSnapshots.set(key, snapshot);
    }
  }
}
