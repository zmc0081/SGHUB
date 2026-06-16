// V2.2.4 — decides whether the onboarding wizard shows on launch.
//
// Mounted once inside App (within the Toast/Dialog providers so the
// wizard can use them). On first paint it asks the backend
// `get_onboarding_status` — which also auto-completes for upgrading users
// who already have models/papers — and shows the overlay only for a true
// fresh install. The Settings "rerun onboarding" entry can also flip
// `visible` directly via the store.
import { ReactNode, useEffect } from "react";
import { api } from "../../lib/tauri";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { OnboardingFlow } from "./OnboardingFlow";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const visible = useOnboardingStore((s) => s.visible);
  const show = useOnboardingStore((s) => s.show);

  useEffect(() => {
    let cancelled = false;
    api
      .getOnboardingStatus()
      .then((status) => {
        if (!cancelled && !status.completed) show();
      })
      .catch((e) => console.warn("getOnboardingStatus failed", e));
    return () => {
      cancelled = true;
    };
  }, [show]);

  return (
    <>
      {children}
      {visible && <OnboardingFlow />}
    </>
  );
}
