// V2.2.7 — fenced code block with its own copy button (top-right).
// Used as react-markdown's `pre` renderer so each code block copies only its
// own code (vs. the whole message). Keeps the existing hljs/chat-md styling on
// the inner <pre>/<code>.
import { useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { Icon } from "../Icon";

export function CodeBlock({ children }: { children?: ReactNode }) {
  const t = useT();
  const toast = useToast();
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = ref.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("chat.code_copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.danger(t("chat.copy_failed"));
    }
  };

  return (
    <div className="relative group/code">
      <button
        type="button"
        onClick={copy}
        aria-label={t("chat.copy_code")}
        title={t("chat.copy_code")}
        className="absolute right-2 top-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-pill bg-card border border-border-default text-fg-3 hover:text-indigo opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100 transition-opacity duration-fast ease-khx"
      >
        <Icon icon={copied ? Check : Copy} size="xs" />
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}
