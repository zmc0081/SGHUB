// i18n: 本组件文案已国际化 (V2.1.0)
import {
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { confirmAsync, promptAsync } from "../DialogProvider";
import { Icon } from "../Icon";

export function SessionList() {
  const t = useT();
  const toast = useToast();
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

  const handleRename = async (id: string, currentTitle: string) => {
    const next = await promptAsync({
      title: t("chat.rename_session_title"),
      description: t("chat.rename_session_prompt"),
      initialValue: currentTitle,
      label: t("chat.session_title_label"),
      confirmLabel: t("common.save"),
      cancelLabel: t("common.cancel"),
    });
    if (next && next !== currentTitle) {
      try {
        await renameSession(id, next);
      } catch (e) {
        toast.danger(String(e));
      }
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirmAsync({
      title: t("chat.delete_session_title"),
      description: t("chat.delete_session_confirm", { title }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await deleteSession(id);
    } catch (e) {
      toast.danger(String(e));
    }
  };

  const pinned = sessions.filter((s) => s.pinned);
  const recent = sessions.filter((s) => !s.pinned);

  return (
    <aside
      aria-label="Chat sessions"
      className="w-session-list shrink-0 border-r border-border-default bg-soft flex flex-col"
    >
      <div className="p-3 border-b border-border-default">
        <button
          type="button"
          onClick={newChat}
          className="w-full inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover transition-colors duration-fast ease-khx"
        >
          <Icon icon={MessageSquarePlus} size="sm" />
          <span>{t("chat.new_session")}</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 && (
          <div className="text-meta text-fg-3 text-center py-8">
            {t("chat.no_sessions")}
          </div>
        )}
        {pinned.length > 0 && (
          <>
            <div className="text-meta uppercase tracking-wide-brand text-fg-3 px-3 py-2">
              {t("chat.pinned_section")}
            </div>
            {pinned.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                selected={s.id === currentSessionId}
                onSelect={() => void selectSession(s.id)}
                onPin={() => void pinSession(s.id, false)}
                onRename={() => handleRename(s.id, s.title)}
                onDelete={() => handleDelete(s.id, s.title)}
              />
            ))}
            <div className="border-b border-border-subtle my-2" />
          </>
        )}
        {recent.length > 0 && (
          <>
            {pinned.length > 0 && (
              <div className="text-meta uppercase tracking-wide-brand text-fg-3 px-3 py-2">
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
                onRename={() => handleRename(s.id, s.title)}
                onDelete={() => handleDelete(s.id, s.title)}
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
      role="button"
      tabIndex={0}
      className={`group p-3 rounded-card-sm cursor-pointer transition-colors duration-fast ease-khx ${
        selected
          ? "bg-navy-soft ring-1 ring-indigo-muted"
          : "hover:bg-navy-faint"
      }`}
    >
      <div className="flex items-center gap-2">
        {session.pinned && (
          <Icon icon={Pin} size={10} className="text-indigo shrink-0" />
        )}
        <span
          className={`flex-1 text-caption truncate ${
            selected ? "text-indigo font-medium" : "text-fg-1"
          }`}
        >
          {session.title}
        </span>
        <span className="text-micro text-fg-3 tabular-nums">
          {session.message_count}
        </span>
      </div>
      {session.last_message_preview && (
        <div className="text-meta text-fg-3 truncate mt-1">
          {session.last_message_preview}
        </div>
      )}
      <div className="opacity-0 group-hover:opacity-100 mt-2 flex gap-2 text-meta transition-opacity duration-fast ease-khx">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-indigo transition-colors duration-fast ease-khx"
        >
          <Icon icon={session.pinned ? PinOff : Pin} size="xs" />
          <span>{session.pinned ? t("chat.unpin") : t("chat.pin")}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-indigo transition-colors duration-fast ease-khx"
        >
          <Icon icon={Pencil} size="xs" />
          <span>{t("chat.rename_session")}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-danger-fg transition-colors duration-fast ease-khx"
        >
          <Icon icon={Trash2} size="xs" />
          <span>{t("chat.delete_session")}</span>
        </button>
      </div>
    </div>
  );
}
