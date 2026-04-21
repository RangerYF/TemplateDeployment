import { create } from 'zustand'

interface PlaybackHandlers {
  play: () => void
  pause: () => void
  stop: () => void
  reset: () => void
  seek: (t: number) => void
}

interface PlaybackTimelineState {
  currentTime: number
  maxTime: number
  snapshotCount: number
}

interface PlaybackControlState extends PlaybackTimelineState {
  handlers: PlaybackHandlers | null
  playbackSpeed: number
  setTimeline: (state: PlaybackTimelineState) => void
  setHandlers: (handlers: PlaybackHandlers | null) => void
  setPlaybackSpeed: (speed: number) => void
  resetTimeline: () => void
}

export const usePlaybackControlStore = create<PlaybackControlState>()((set) => ({
  currentTime: 0,
  maxTime: 0,
  snapshotCount: 0,
  handlers: null,
  playbackSpeed: 1,

  setTimeline: (state) => set(state),
  setHandlers: (handlers) => set({ handlers }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  resetTimeline: () =>
    set({
      currentTime: 0,
      maxTime: 0,
      snapshotCount: 0,
      playbackSpeed: 1,
    }),
}))
