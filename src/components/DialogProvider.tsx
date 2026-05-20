import { useEffect, useState } from "react";
import { ConfirmDialog, ConfirmDialogProps } from "./ConfirmDialog";
import { InputDialog, InputDialogProps } from "./InputDialog";

type ConfirmRequest = Omit<
  ConfirmDialogProps,
  "open" | "onConfirm" | "onCancel"
> & {
  resolve: (value: boolean) => void;
};

type InputRequest = Omit<
  InputDialogProps,
  "open" | "onConfirm" | "onCancel"
> & {
  resolve: (value: string | null) => void;
};

type Listener = {
  pushConfirm: (req: ConfirmRequest) => void;
  pushInput: (req: InputRequest) => void;
};

let listener: Listener | null = null;
const queuedConfirms: ConfirmRequest[] = [];
const queuedInputs: InputRequest[] = [];

/**
 * Promise-based confirm. Replaces the native browser confirm dialog.
 *
 * Resolves to `true` if the user confirmed, `false` if cancelled.
 * Requires `<DialogProvider>` mounted at the app root.
 */
export function confirmAsync(
  opts: Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel">,
): Promise<boolean> {
  return new Promise((resolve) => {
    const req: ConfirmRequest = { ...opts, resolve };
    if (listener) listener.pushConfirm(req);
    else queuedConfirms.push(req);
  });
}

/**
 * Promise-based prompt. Replaces the native browser prompt dialog.
 *
 * Resolves to the entered string, or `null` if cancelled.
 * Requires `<DialogProvider>` mounted at the app root.
 */
export function promptAsync(
  opts: Omit<InputDialogProps, "open" | "onConfirm" | "onCancel">,
): Promise<string | null> {
  return new Promise((resolve) => {
    const req: InputRequest = { ...opts, resolve };
    if (listener) listener.pushInput(req);
    else queuedInputs.push(req);
  });
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirms, setConfirms] = useState<ConfirmRequest[]>([]);
  const [inputs, setInputs] = useState<InputRequest[]>([]);

  useEffect(() => {
    listener = {
      pushConfirm: (req) => setConfirms((q) => [...q, req]),
      pushInput: (req) => setInputs((q) => [...q, req]),
    };
    // Flush any pre-mount requests.
    if (queuedConfirms.length > 0) {
      setConfirms((q) => [...q, ...queuedConfirms.splice(0)]);
    }
    if (queuedInputs.length > 0) {
      setInputs((q) => [...q, ...queuedInputs.splice(0)]);
    }
    return () => {
      listener = null;
    };
  }, []);

  const currentConfirm = confirms[0];
  const currentInput = inputs[0];

  function resolveConfirm(value: boolean) {
    if (!currentConfirm) return;
    currentConfirm.resolve(value);
    setConfirms((q) => q.slice(1));
  }

  function resolveInput(value: string | null) {
    if (!currentInput) return;
    currentInput.resolve(value);
    setInputs((q) => q.slice(1));
  }

  return (
    <>
      {children}
      {currentConfirm && (
        <ConfirmDialog
          {...currentConfirm}
          open
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
      {currentInput && (
        <InputDialog
          {...currentInput}
          open
          onConfirm={(value) => resolveInput(value)}
          onCancel={() => resolveInput(null)}
        />
      )}
    </>
  );
}
