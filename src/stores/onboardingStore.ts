// V2.2.4 — first-run onboarding visibility.
//
// Tiny store so two unrelated mount points can drive the wizard overlay:
//   - `OnboardingGate` (in App) shows it on first launch after asking
//     the backend `get_onboarding_status`.
//   - Settings' "rerun onboarding" entry calls `show()` on demand.
//
// The overlay component lives in `components/onboarding/`. This store
// only owns the boolean — completion persistence is a backend concern
// (`complete_onboarding`).
import { create } from "zustand";

interface OnboardingState {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
