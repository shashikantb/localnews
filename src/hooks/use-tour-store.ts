
import { create } from 'zustand';

interface TourState {
  isTourRunning: boolean;
  startTour: () => void;
  stopTour: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  isTourRunning: false,
  startTour: () => set({ isTourRunning: true }),
  stopTour: () => set({ isTourRunning: false }),
}));
