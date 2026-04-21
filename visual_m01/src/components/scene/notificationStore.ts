import { create } from 'zustand';

interface NotificationState {
  message: string | null;
  show(message: string, duration?: number): void;
  dismiss(): void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  message: null,

  show(message: string, duration = 2000): void {
    set({ message });
    setTimeout(() => {
      set((s) => (s.message === message ? { message: null } : s));
    }, duration);
  },

  dismiss(): void {
    set({ message: null });
  },
}));
