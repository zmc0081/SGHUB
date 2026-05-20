import { useContext } from "react";
import { ToastApi, ToastContext } from "../components/ToastProvider";

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error(
      "useToast must be used within <ToastProvider>. Did you forget to mount it in App?",
    );
  }
  return api;
}
