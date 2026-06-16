import { ReactNode } from "react";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";
import { ToastProvider } from "./components/ToastProvider";
import { DialogProvider } from "./components/DialogProvider";
import { OnboardingGate } from "./components/onboarding/OnboardingGate";

export default function App({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogProvider>
        <OnboardingGate>
          <div className="h-screen flex flex-col bg-page text-fg-1">
            <Titlebar />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </div>
        </OnboardingGate>
      </DialogProvider>
    </ToastProvider>
  );
}
