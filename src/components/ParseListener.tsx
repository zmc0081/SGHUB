// V2.2.9 (Session 45, R4) — app-level `parse:token` subscriber.
//
// Mounted once in App (never unmounts), so parse streaming keeps flowing into
// the global parseStore no matter which page is visible. The Parse page used
// to own this listener and lost the stream on unmount; the backend task —
// which always kept running and saving its result — looked "interrupted".
import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { TokenPayload } from "../lib/tauri";
import { useParseStore } from "../stores/parseStore";

export function ParseListener() {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<TokenPayload>("parse:token", (event) => {
      const { text, done } = event.payload;
      if (text) useParseStore.getState().appendToken(text);
      if (done) useParseStore.getState().finishStream();
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);
  return null;
}
