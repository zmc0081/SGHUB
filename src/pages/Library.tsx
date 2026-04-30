import { useEffect, useMemo, useState } from "react";
import { api, type Folder, type Paper } from "../lib/tauri";

type FolderNode = Folder & { children: FolderNode[] };

function buildTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));

  const roots: FolderNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRecursive = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

function FolderTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isSelected = node.id === selectedId;
  return (
    <>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-black/5 text-app-fg/80"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="shrink-0">{node.is_smart ? "⚡" : "📁"}</span>
        <span className="truncate">{node.name}</span>
      </button>
      {node.children.map((c) => (
        <FolderTreeItem
          key={c.id}
          node={c}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function Library() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFolders()
      .then((fs) => {
        setFolders(fs);
        if (fs.length > 0) setSelectedId(fs[0].id);
      })
      .catch((e) => setFolderError(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api
      .getPapersByFolder(selectedId)
      .then(setPapers)
      .catch((e) => console.error("getPapersByFolder", e));
  }, [selectedId]);

  const tree = useMemo(() => buildTree(folders), [folders]);
  const selected = folders.find((f) => f.id === selectedId);

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-black/10 bg-white/50 p-3 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider text-app-fg/50 px-2 mb-2">
          文件夹
        </div>
        {folderError && (
          <div className="text-sm text-red-600 px-2">错误: {folderError}</div>
        )}
        <div className="flex flex-col">
          {tree.map((node) => (
            <FolderTreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-2xl font-semibold text-primary mb-1">
          {selected?.name ?? "收藏夹"}
        </h1>
        <p className="text-sm text-app-fg/60 mb-6">
          {selected?.is_smart
            ? "智能文件夹 — 按规则动态匹配"
            : "手动添加的文献"}
          {" · "}
          {papers.length} 篇
        </p>

        {papers.length === 0 ? (
          <div className="text-sm text-app-fg/60">
            该文件夹暂无文献
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {papers.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded border border-black/10 px-4 py-3 hover:border-primary/30 transition-colors"
              >
                <div className="text-sm font-medium text-primary leading-snug">
                  {p.title}
                </div>
                <div className="mt-1 text-xs text-app-fg/70">
                  {p.authors.slice(0, 3).join(", ")}
                  {p.authors.length > 3 && ` 等`}
                  {p.published_at && ` · ${p.published_at.slice(0, 10)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
