import { ReactNode } from "react";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";

export default function App({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-app-bg text-app-fg">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
