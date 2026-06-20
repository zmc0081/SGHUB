// V2.2.6 — privacy-policy consent gate (R7).
//
// Mounted once in App, OUTSIDE the onboarding gate, so the mandatory policy
// screen blocks the entire app (including onboarding) until the user accepts
// the current policy version. On accept it reveals its children; the backend
// remembers the accepted version, so a later policy bump re-prompts.
import { ReactNode, useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { PrivacyConsentScreen } from "./PrivacyConsentScreen";

export function PrivacyGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "need" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .getPrivacyStatus()
      .then((s) => {
        if (!cancelled) setState(s.agreed ? "ok" : "need");
      })
      .catch((e) => {
        // Never hard-block boot on a status read failure.
        console.warn("getPrivacyStatus failed", e);
        if (!cancelled) setState("ok");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Brief blank while we ask the backend — avoids flashing the app before the
  // mandatory gate can render.
  if (state === "loading") return null;
  if (state === "need") {
    return <PrivacyConsentScreen onAgree={() => setState("ok")} />;
  }
  return <>{children}</>;
}
