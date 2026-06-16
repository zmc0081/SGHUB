// V2.2.4 — onboarding wizard container.
//
// Full-screen scrim + centered card that sits above (and disables) the
// main UI on first launch. Owns the step index; each step renders its
// own body + footer and calls back to navigate. Finishing OR skipping
// the whole flow flips the backend `onboarding_completed` flag so it
// never shows again, then hides the overlay.
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { WelcomeStep } from "./WelcomeStep";
import { DataDirStep } from "./DataDirStep";
import { ModelStep } from "./ModelStep";
import { DoneStep } from "./DoneStep";

export function OnboardingFlow() {
  const hide = useOnboardingStore((s) => s.hide);
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll-lock the body + park focus inside the card while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => cardRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  async function finish() {
    try {
      await api.completeOnboarding();
    } catch (e) {
      console.warn("completeOnboarding failed", e);
    }
    hide();
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-overlay-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="SG Hub onboarding"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="relative bg-card rounded-card shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 focus:outline-none"
      >
        {step === 0 && (
          <WelcomeStep onStart={() => setStep(1)} onSkipAll={finish} />
        )}
        {step === 1 && (
          <DataDirStep
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onSkip={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <ModelStep onAdvance={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && <DoneStep onEnter={finish} />}
      </div>
    </div>
  );
}
