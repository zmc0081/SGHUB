import { ReactNode } from "react";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";
import { ToastProvider } from "./components/ToastProvider";
import { DialogProvider } from "./components/DialogProvider";
import { OnboardingGate } from "./components/onboarding/OnboardingGate";
import { PrivacyGate } from "./components/PrivacyGate";
import { PdfReaderOverlay } from "./components/pdf/PdfReaderOverlay";
import { ParseListener } from "./components/ParseListener";

export default function App({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>
        {/* V2.2.9 (Session 45) — app-level parse stream subscriber; keeps
            AI-parse tasks flowing into the global store across page switches. */}
        <ParseListener />
        <PrivacyGate>
        <OnboardingGate>
          <div className="h-screen flex flex-col bg-page text-fg-1">
            <Titlebar />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              {/* The content column is a positioning context so the in-app
                  PDF reader can fill ONLY this area (below the titlebar,
                  right of the sidebar) instead of covering the whole
                  window — keeping the nav menu reachable while reading. */}
              <div className="relative flex-1 min-w-0">
                <main className="absolute inset-0 overflow-auto">{children}</main>
                <PdfReaderOverlay />
              </div>
            </div>
          </div>
        </OnboardingGate>
        </PrivacyGate>
      </DialogProvider>
    </ToastProvider>
  );
}
