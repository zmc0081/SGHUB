// i18n: 本组件文案已国际化 (V2.1.0)
import { useChatStore } from "../../stores/chatStore";
import { useT } from "../../hooks/useT";

export function SessionList() {
  const t = useT();
  const {
    sessions,
    currentSessionId,
    selectSession,
    deleteSession,
    renameSession,
    pinSession,
  } = useChatStore();

  const newChat = () => {
    void selectSession(null);
  };

  const pinned = sessions.filter((s) => s.pinned);
  const recent = sessions.filter((s) => !s.pinned);

  return (
    <aside className="w-60 shrink-0 border-r border-black/10 bg-white/40 flex flex-col">
      <div className="p-3 border-b border-black/5">
        <button
          onClick={newChat}
          className="w-full px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90"
        >
          {t("chat.new_session")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 && (
          <div className="text-[11px] text-app-fg/40 text-center py-6">
            {t("chat.no_sessions")}
          </div>
        )}
        {pinned.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-app-fg/50 px-2 py-1">
              {t("chat.pinned_section")}
            </div>
            {pinned.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                selected={s.id === currentSessionId}
                onSelect={() => void selectSession(s.id)}
                onPin={() => void pinSession(s.id, false)}
                onRename={() => {
                  const next = prompt(t("chat.rename_session_prompt"), s.title);
                  if (next && next !== s.title) void renameSession(s.id, next);
                }}
                onDelete={() => {
                  if (
                    confirm(
                      t("chat.delete_session_confirm", { title: s.title }),
                    )
                  )
                    void deleteSession(s.id);
                }}
              />
            ))}
            <div className="border-b border-black/5 my-1" />
          </>
        )}
        {recent.length > 0 && (
          <>
            {pinned.length > 0 && (
              <div className="text-[10px] uppercase tracking-wider text-app-fg/50 px-2 py-1">
                {t("chat.recent_section")}
              </div>
            )}
            {recent.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                selected={s.id === currentSessionId}
                onSelect={() => void selectSession(s.id)}
                onPin={() => void pinSession(s.id, true)}
                onRename={() => {
                  const next = prompt(t("chat.rename_session_prompt"), s.title);
                  if (next && next !== s.title) void renameSession(s.id, next);
                }}
                onDelete={() => {
                  if (
                    confirm(
                      t("chat.delete_session_confirm", { title: s.title }),
                    )
                  )
                    void deleteSession(s.id);
                }}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function SessionItem({
  session,
  selected,
  onSelect,
  onPin,
  onRename,
  onDelete,
}: {
  session: {
    id: string;
    title: string;
    message_count: number;
    pinned: boolean;
    updated_at: string;
    last_message_preview: string | null;
  };
  selected: boolean;
  onSelect: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div
      onClick={onSelect}
      className={`group p-2 rounded cursor-pointer transition-colors ${
        selected
          ? "bg-primary/10 ring-1 ring-primary/20"
          : "hover:bg-black/5"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {session.pinned && <span className="text-[10px]">📌</span>}
        <span className="flex-1 text-sm truncate text-app-fg">
          {session.title}
        </span>
        <span className="text-[10px] text-app-fg/40">{session.message_count}</span>
      </div>
      {session.last_message_preview && (
        <div className="text-[10px] text-app-fg/40 truncate mt-0.5">
          {session.last_message_preview}
        </div>
      )}
      <div className="opacity-0 group-hover:opacity-100 mt-1 flex gap-2 text-[10px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          {session.pinned ? t("chat.unpin") : t("chat.pin")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          {t("chat.rename_session")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-app-fg/60 hover:text-red-600"
        >
          {t("chat.delete_session")}
        </button>
      </div>
    </div>
  );
}
