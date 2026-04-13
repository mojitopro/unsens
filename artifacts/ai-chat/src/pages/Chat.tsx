import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send, Bot, User, Loader2, ChevronDown, Plus, Clock,
  FolderOpen, FileText, GitBranch, Globe, Search, CheckCircle2,
  XCircle, ChevronRight, Terminal, Trash2, MessageSquare,
  Code, Eye, Cpu, AlertCircle,
} from "lucide-react";
import { computeDiff, type DiffLine } from "@/lib/diff";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────
interface ToolCall { name: string; args: Record<string, any>; result?: string; running?: boolean; }
interface FileChange { path: string; before: string; after: string; }
interface MessagePart { type: "text" | "tool"; content?: string; tool?: ToolCall; }
interface Message { role: "user" | "assistant"; parts: MessagePart[]; streaming?: boolean; }
interface FileNode { name: string; type: "file" | "dir"; path?: string; children?: FileNode[]; }
interface Session { id: string; title: string; updatedAt: number; messageCount: number; }
interface ModelInfo { name: string; size?: number; }
interface ProviderInfo { provider: string; label: string; free: boolean; models: string[]; }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(b: number) { return b < 1e9 ? (b / 1e6).toFixed(0) + " MB" : (b / 1e9).toFixed(1) + " GB"; }
function ago(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

// ─── Diff Viewer ─────────────────────────────────────────────────────────────
function DiffView({ before, after, filePath }: { before: string; after: string; filePath: string }) {
  const lines = useMemo(() => computeDiff(before, after), [before, after]);
  const adds = lines.filter(l => l.type === "add").length;
  const removes = lines.filter(l => l.type === "remove").length;

  return (
    <div className="font-mono text-[11px]">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[hsl(220_20%_7%)] border-b border-[hsl(220_14%_16%)]">
        <FileText size={11} className="text-[hsl(215_14%_50%)]" />
        <span className="text-[hsl(210_20%_80%)] flex-1 truncate">{filePath}</span>
        <span className="text-green-400">+{adds}</span>
        <span className="text-red-400">-{removes}</span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        {lines.map((line, i) => (
          <div key={i} className={`flex gap-2 px-2 py-0.5 leading-4 ${
            line.type === "add" ? "bg-green-500/10 text-green-300" :
            line.type === "remove" ? "bg-red-500/10 text-red-300 line-through opacity-60" :
            "text-[hsl(210_20%_68%)]"
          }`}>
            <span className="w-6 text-right select-none opacity-40 flex-shrink-0">
              {line.type !== "remove" && line.lineNum}
            </span>
            <span className="select-none opacity-50 w-3 flex-shrink-0">
              {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
            </span>
            <pre className="whitespace-pre">{line.content}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tool Call Card ───────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={11} />,
  write_file: <Code size={11} />,
  list_dir: <FolderOpen size={11} />,
  bash: <Terminal size={11} />,
  search_files: <Search size={11} />,
  web_search: <Globe size={11} />,
  fetch_url: <Globe size={11} />,
};
const TOOL_LABELS: Record<string, string> = {
  read_file: "Leyendo",
  write_file: "Escribiendo",
  list_dir: "Listando",
  bash: "Ejecutando",
  search_files: "Buscando",
  web_search: "Buscando en web",
  fetch_url: "Fetching URL",
};

function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[tool.name] || tool.name;
  const argStr = tool.args.path || tool.args.command || tool.args.query || tool.args.url || "";

  return (
    <div className="my-1 rounded-lg border border-[hsl(220_14%_20%)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[hsl(220_14%_12%)] hover:bg-[hsl(220_14%_15%)] transition-colors text-left"
      >
        <span className="text-purple-400">{TOOL_ICONS[tool.name] || <Terminal size={11} />}</span>
        <span className="text-xs font-medium text-[hsl(215_14%_68%)]">{label}</span>
        {argStr && <span className="text-xs text-[hsl(210_20%_55%)] font-mono truncate max-w-[200px]">{argStr}</span>}
        <span className="ml-auto">
          {tool.running
            ? <Loader2 size={11} className="text-purple-400 animate-spin" />
            : tool.result !== undefined
              ? <CheckCircle2 size={11} className="text-green-400" />
              : <AlertCircle size={11} className="text-[hsl(215_14%_45%)]" />}
        </span>
        {tool.result && <ChevronRight size={11} className={`text-[hsl(215_14%_45%)] transition-transform ${expanded ? "rotate-90" : ""}`} />}
      </button>
      {expanded && tool.result && (
        <div className="border-t border-[hsl(220_14%_18%)] bg-[hsl(220_20%_7%)] px-3 py-2">
          <pre className="text-[10px] font-mono text-[hsl(210_20%_72%)] whitespace-pre-wrap max-h-40 overflow-y-auto">{tool.result}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Message content parser ───────────────────────────────────────────────────
function parseTextContent(text: string) {
  const parts: { type: "text" | "code"; content: string; lang?: string }[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1] || "bash", content: m[2].trim() });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const isUser = msg.role === "user";
  const textContent = msg.parts.filter(p => p.type === "text").map(p => p.content).join("");
  const tools = msg.parts.filter(p => p.type === "tool");

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mt-0.5">
          <Bot size={12} className="text-purple-400" />
        </div>
      )}
      <div className={`${isUser ? "max-w-[82%]" : "w-full max-w-[92%]"}`}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-sm px-4 py-2.5 bg-purple-600 text-white text-sm">
            <pre className="whitespace-pre-wrap font-sans">{textContent}</pre>
          </div>
        ) : (
          <div>
            {tools.map((p, i) => p.tool && <ToolCard key={i} tool={p.tool} />)}
            {textContent && (
              <div className={`text-sm text-[hsl(210_20%_88%)] leading-relaxed ${msg.streaming && isLast && tools.length === 0 ? "typing-cursor" : ""}`}>
                {parseTextContent(textContent).map((part, i) =>
                  part.type === "code" ? (
                    <div key={i} className="my-2 rounded-xl overflow-hidden border border-[hsl(220_14%_20%)]">
                      <div className="flex items-center justify-between px-3 py-1 bg-[hsl(220_20%_7%)] border-b border-[hsl(220_14%_16%)]">
                        <span className="text-xs font-mono text-purple-400">{part.lang}</span>
                      </div>
                      <pre className="px-4 py-3 text-[11px] font-mono text-[hsl(210_20%_88%)] overflow-x-auto whitespace-pre bg-[hsl(222_22%_7%)]"><code>{part.content}</code></pre>
                    </div>
                  ) : (
                    <pre key={i} className="whitespace-pre-wrap font-sans inline-block w-full">{part.content}</pre>
                  )
                )}
              </div>
            )}
            {msg.streaming && isLast && !textContent && (
              <div className="flex items-center gap-1.5 text-xs text-[hsl(215_14%_48%)] mt-1">
                <Loader2 size={11} className="animate-spin" /><span>Pensando...</span>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(220_14%_20%)] border border-[hsl(220_14%_26%)] flex items-center justify-center mt-0.5">
          <User size={12} className="text-[hsl(215_14%_52%)]" />
        </div>
      )}
    </div>
  );
}

// ─── File Tree Node ───────────────────────────────────────────────────────────
function TreeNode({ node, onSelect, depth = 0 }: { node: FileNode; onSelect: (p: string) => void; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === "dir") {
    return (
      <div>
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-1 w-full px-2 py-0.5 hover:bg-[hsl(220_14%_14%)] rounded text-xs text-[hsl(210_20%_72%)] transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}>
          <ChevronRight size={10} className={`transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`} />
          <FolderOpen size={11} className="text-yellow-500/70 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((c, i) => <TreeNode key={i} node={c} onSelect={onSelect} depth={depth + 1} />)}
      </div>
    );
  }
  return (
    <button onClick={() => node.path && onSelect(node.path)}
      className="flex items-center gap-1 w-full px-2 py-0.5 hover:bg-[hsl(220_14%_14%)] rounded text-xs text-[hsl(210_20%_68%)] transition-colors"
      style={{ paddingLeft: `${8 + depth * 12}px` }}>
      <FileText size={10} className="text-blue-400/60 flex-shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ─── Main Chat Component ──────────────────────────────────────────────────────
export default function Chat() {
  const [sessionId, setSessionId] = useState(genId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("ollama");
  const [selectedModel, setSelectedModel] = useState("dolphin3:8b");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [ollamaReady, setOllamaReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [selectedChange, setSelectedChange] = useState<FileChange | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState("");
  const [panel, setPanel] = useState<"history" | "files" | "changes" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load models/providers
  const fetchModels = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/models`);
      if (r.ok) {
        const d = await r.json() as { providers?: ProviderInfo[] };
        const list = d.providers || [];
        setProviders(list);
        const ollamaProv = list.find(p => p.provider === "ollama");
        if (ollamaProv && ollamaProv.models.length > 0) {
          if (!ollamaReady) setSelectedModel(ollamaProv.models[0]);
          setOllamaReady(true);
          setSelectedProvider("ollama");
        } else if (list.length > 0 && list[0].models.length > 0) {
          if (!ollamaReady) setSelectedModel(list[0].models[0]);
          setSelectedProvider(list[0].provider);
          setOllamaReady(true);
        }
      }
    } catch {}
  }, [ollamaReady]);

  useEffect(() => {
    fetchModels();
    const iv = setInterval(fetchModels, 6000);
    return () => clearInterval(iv);
  }, [fetchModels]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/history`);
      if (r.ok) { const d = await r.json(); setSessions(d.sessions || []); }
    } catch {}
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load file tree
  const loadTree = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/project/tree`);
      if (r.ok) { const d = await r.json(); setFileTree(d.tree || []); }
    } catch {}
  }, []);

  // Load git status
  const loadGit = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/project/git`);
      if (r.ok) { const d = await r.json(); setGitStatus(d.status); }
    } catch {}
  }, []);

  useEffect(() => {
    if (panel === "files") { loadTree(); loadGit(); }
    if (panel === "history") loadSessions();
  }, [panel, loadTree, loadGit, loadSessions]);

  // Open a file in the right panel
  const openFile = async (p: string) => {
    try {
      const r = await fetch(`${BASE}/api/project/file?p=${encodeURIComponent(p)}`);
      if (r.ok) { const d = await r.json(); setSelectedFileContent(d.content); setSelectedFilePath(p); }
    } catch {}
  };

  // Session management
  const saveSession = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) return;
    const flat = msgs.map(m => ({
      role: m.role,
      content: m.parts.filter(p => p.type === "text").map(p => p.content).join(""),
    }));
    await fetch(`${BASE}/api/history/${sessionId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: flat }),
    }).catch(() => {});
    loadSessions();
  }, [sessionId, loadSessions]);

  const loadSession = async (id: string) => {
    try {
      const r = await fetch(`${BASE}/api/history/${id}`);
      if (r.ok) {
        const d = await r.json();
        setSessionId(id);
        setMessages((d.messages || []).map((m: any) => ({
          role: m.role,
          parts: [{ type: "text", content: m.content }],
          streaming: false,
        })));
        setPanel(null);
      }
    } catch {}
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE}/api/history/${id}`, { method: "DELETE" }).catch(() => {});
    loadSessions();
    if (id === sessionId) { setSessionId(genId()); setMessages([]); }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setSessionId(genId()); setMessages([]);
    setFileChanges([]); setSelectedChange(null);
    setPanel(null);
  };

  // Web search inject
  const runSearch = async () => {
    if (!searchQuery.trim() || searching) return;
    const q = searchQuery.trim(); setSearchQuery(""); setSearching(true);
    try {
      const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`);
      const d = await r.json() as { results?: string };
      if (d.results) setInput(`Resultados de búsqueda para "${q}":\n\n${d.results.slice(0, 3000)}\n\nResume lo más relevante.`);
    } catch { setInput(`Busca en internet: ${q}`); }
    setSearching(false);
    textareaRef.current?.focus();
  };

  // ─── Send message with agentic SSE loop ─────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", parts: [{ type: "text", content: text }] };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Flatten history for API
    const flatHistory = history.map(m => ({
      role: m.role,
      content: m.parts.filter(p => p.type === "text").map(p => p.content).join(""),
    }));

    // Start assistant message with empty parts
    const asstMsg: Message = { role: "assistant", parts: [], streaming: true };
    setMessages(prev => [...prev, asstMsg]);

    abortRef.current = new AbortController();
    const newFileChanges: FileChange[] = [];

    try {
      const resp = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: flatHistory, model: selectedModel, provider: selectedProvider }),
        signal: abortRef.current.signal,
      });

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("no stream");
      const dec = new TextDecoder();
      let buf = "";
      // Current tool being built
      let currentToolIdx: number | null = null;

      const updateLastMsg = (updater: (msg: Message) => Message) => {
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = updater(u[u.length - 1]);
          return u;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "tool_start") {
              const newTool: ToolCall = { name: ev.name, args: ev.args, running: true };
              updateLastMsg(msg => ({
                ...msg,
                parts: [...msg.parts, { type: "tool", tool: newTool }],
              }));
              // Track index
              setMessages(prev => {
                currentToolIdx = prev[prev.length - 1].parts.length - 1;
                return prev;
              });
            }

            else if (ev.type === "tool_end") {
              updateLastMsg(msg => {
                const parts = [...msg.parts];
                // Find last tool with this name
                for (let i = parts.length - 1; i >= 0; i--) {
                  if (parts[i].type === "tool" && parts[i].tool?.name === ev.name && parts[i].tool?.running) {
                    parts[i] = { type: "tool", tool: { ...parts[i].tool!, result: ev.result, running: false } };
                    break;
                  }
                }
                return { ...msg, parts };
              });
            }

            else if (ev.type === "file_change") {
              const change: FileChange = { path: ev.path, before: ev.before, after: ev.after };
              newFileChanges.push(change);
              setFileChanges(prev => [...prev.filter(c => c.path !== ev.path), change]);
              setSelectedChange(change);
              if (panel !== "changes") setPanel("changes");
              loadTree();
            }

            else if (ev.type === "text") {
              updateLastMsg(msg => {
                const parts = [...msg.parts];
                const lastText = parts.findLast(p => p.type === "text");
                if (lastText) {
                  const idx = parts.lastIndexOf(lastText);
                  parts[idx] = { type: "text", content: (lastText.content || "") + ev.content };
                } else {
                  parts.push({ type: "text", content: ev.content });
                }
                return { ...msg, parts };
              });
            }

            else if (ev.type === "done") {
              updateLastMsg(msg => ({ ...msg, streaming: false }));
            }

            else if (ev.type === "error") {
              updateLastMsg(msg => ({
                ...msg,
                streaming: false,
                parts: [...msg.parts, { type: "text", content: `\n\nError: ${ev.message}` }],
              }));
            }
          } catch {}
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { ...u[u.length - 1], streaming: false, parts: [...u[u.length - 1].parts, { type: "text", content: "Error de conexión." }] };
          return u;
        });
      }
    } finally {
      setMessages(prev => {
        const u = [...prev];
        if (u.length) u[u.length - 1] = { ...u[u.length - 1], streaming: false };
        saveSession(u);
        return u;
      });
      setLoading(false);
    }
  }, [input, messages, loading, selectedModel, panel, saveSession, loadTree]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const QUICK = [
    "Lista los archivos del workspace y crea un proyecto Node.js con Express",
    "Crea una app web completa con HTML, CSS y JavaScript",
    "Escribe un web scraper en Python para extraer datos",
    "Crea una API REST con FastAPI, SQLite y autenticación JWT",
    "Busca en GitHub el mejor framework de CLI en Rust e impleméntalo",
  ];

  const changesCount = fileChanges.length;

  return (
    <div className="flex h-screen bg-[hsl(222_20%_10%)] overflow-hidden text-sm select-none">

      {/* ── Sidebar panels ── */}
      {panel && (
        <div className="w-56 border-r border-[hsl(220_14%_17%)] bg-[hsl(222_22%_7%)] flex flex-col flex-shrink-0">

          {/* HISTORY */}
          {panel === "history" && <>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220_14%_16%)]">
              <span className="text-xs font-semibold text-white">Historial</span>
              <button onClick={newChat} className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 text-xs transition-colors">
                <Plus size={10} />Nuevo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {sessions.length === 0 && <p className="px-3 py-3 text-xs text-[hsl(215_14%_40%)] italic">Sin historial</p>}
              {sessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-[hsl(220_14%_14%)] border-b border-[hsl(220_14%_13%)] group transition-colors ${s.id === sessionId ? "bg-[hsl(220_14%_15%)]" : ""}`}>
                  <div className="flex items-start gap-1">
                    <span className="text-xs text-[hsl(210_20%_78%)] line-clamp-2 leading-snug flex-1">{s.title}</span>
                    <button onClick={e => deleteSession(s.id, e)} className="opacity-0 group-hover:opacity-100 text-[hsl(215_14%_42%)] hover:text-red-400 mt-0.5 flex-shrink-0 transition-all">
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-[hsl(215_14%_36%)]"><Clock size={8} className="inline" /> {ago(s.updatedAt)}</span>
                    <span className="text-[10px] text-[hsl(215_14%_36%)]"><MessageSquare size={8} className="inline" /> {s.messageCount}</span>
                  </div>
                </button>
              ))}
            </div>
          </>}

          {/* FILES */}
          {panel === "files" && <>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220_14%_16%)]">
              <span className="text-xs font-semibold text-white">Archivos</span>
              <button onClick={loadTree} className="text-[hsl(215_14%_42%)] hover:text-white text-xs">↻</button>
            </div>
            {gitStatus && gitStatus !== "not a git repo" && (
              <div className="px-3 py-1.5 border-b border-[hsl(220_14%_16%)] bg-[hsl(220_14%_10%)]">
                <p className="text-[10px] text-[hsl(215_14%_40%)] font-mono">{gitStatus}</p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto py-1">
              <p className="text-[10px] text-[hsl(215_14%_36%)] px-2 py-1 font-mono">/tmp/agent-workspace</p>
              {fileTree.length === 0 && <p className="px-3 py-2 text-[11px] text-[hsl(215_14%_40%)] italic">vacío</p>}
              {fileTree.map((n, i) => <TreeNode key={i} node={n} onSelect={openFile} />)}
            </div>
          </>}

          {/* CHANGES */}
          {panel === "changes" && <>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220_14%_16%)]">
              <span className="text-xs font-semibold text-white">Cambios</span>
              <span className="text-[10px] text-[hsl(215_14%_42%)]">{changesCount} archivo{changesCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {fileChanges.length === 0 && <p className="px-3 py-2 text-xs text-[hsl(215_14%_40%)] italic">Sin cambios</p>}
              {fileChanges.map((c, i) => (
                <button key={i} onClick={() => setSelectedChange(c)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(220_14%_14%)] border-b border-[hsl(220_14%_13%)] transition-colors ${selectedChange?.path === c.path ? "bg-[hsl(220_14%_15%)]" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <Code size={10} className="text-green-400 flex-shrink-0" />
                    <span className="text-[hsl(210_20%_78%)] truncate font-mono">{c.path}</span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-green-400">+{c.after.split("\n").length}</span>
                    <span className="text-[10px] text-red-400">-{c.before.split("\n").length}</span>
                  </div>
                </button>
              ))}
            </div>
          </>}
        </div>
      )}

      {/* ── Chat panel ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[hsl(220_14%_17%)] bg-[hsl(222_22%_8%)] flex-shrink-0">
          <div className="w-6 h-6 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
            <Cpu size={13} className="text-purple-400" />
          </div>
          <div className="leading-none mr-2">
            <p className="text-xs font-bold text-white">OpenCode Local</p>
            <p className="text-[10px] text-[hsl(215_14%_44%)]">Agente autónomo · sin restricciones</p>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* Nav buttons */}
            {[
              { key: "history", icon: <Clock size={11} />, label: "Historial" },
              { key: "files", icon: <FolderOpen size={11} />, label: "Archivos" },
              { key: "changes", icon: <GitBranch size={11} />, label: `Cambios${changesCount > 0 ? ` (${changesCount})` : ""}` },
            ].map(({ key, icon, label }) => (
              <button key={key}
                onClick={() => setPanel(panel === key ? null : key as any)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors ${panel === key ? "bg-purple-600/20 border-purple-500/30 text-purple-300" : "bg-[hsl(220_14%_14%)] border-[hsl(220_14%_20%)] text-[hsl(215_14%_50%)] hover:text-white"}`}>
                {icon}<span className="hidden sm:inline">{label}</span>
              </button>
            ))}

            {/* Model picker */}
            <div className="relative">
              <button onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(220_14%_14%)] border border-[hsl(220_14%_20%)] text-xs text-[hsl(210_20%_80%)] hover:bg-[hsl(220_14%_18%)] transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full ${ollamaReady ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
                <span className="max-w-[90px] truncate">{selectedModel}</span>
                <ChevronDown size={10} />
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-[hsl(222_20%_12%)] border border-[hsl(220_14%_22%)] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {providers.length === 0
                    ? <div className="px-3 py-3 text-xs text-[hsl(215_14%_50%)]">Sin modelos disponibles</div>
                    : providers.map(prov => (
                      <div key={prov.provider}>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[hsl(220_14%_9%)] border-b border-[hsl(220_14%_18%)]">
                          <span className="text-[10px] font-semibold text-[hsl(215_14%_55%)] uppercase tracking-wide">{prov.label}</span>
                          {prov.free
                            ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400">LIBRE</span>
                            : <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/25 text-orange-400">API KEY</span>
                          }
                        </div>
                        {prov.models.length === 0
                          ? <div className="px-3 py-2 text-[11px] text-[hsl(215_14%_40%)] italic">Sin modelos cargados</div>
                          : prov.models.map(m => (
                            <button key={m} onClick={() => { setSelectedModel(m); setSelectedProvider(prov.provider); setShowModelPicker(false); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-[hsl(220_14%_18%)] transition-colors ${selectedModel === m && selectedProvider === prov.provider ? "text-purple-400 bg-[hsl(220_14%_16%)]" : "text-[hsl(210_20%_85%)]"}`}>
                              {m}
                            </button>
                          ))
                        }
                      </div>
                    ))}
                  <div className="px-3 py-2 border-t border-[hsl(220_14%_18%)] bg-[hsl(220_14%_9%)]">
                    <p className="text-[10px] text-[hsl(215_14%_38%)]">Ollama: modelos locales sin límites ni costos</p>
                  </div>
                </div>
              )}
            </div>

            <button onClick={newChat} className="p-1.5 rounded-lg text-[hsl(215_14%_42%)] hover:text-white hover:bg-[hsl(220_14%_16%)] transition-colors" title="Nuevo chat">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {!ollamaReady && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 flex-shrink-0">
            <Loader2 size={11} className="text-yellow-400 animate-spin" />
            <span className="text-xs text-yellow-300">Cargando modelo Ollama...</span>
            <button onClick={fetchModels} className="ml-auto text-xs text-yellow-400 underline">Verificar</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center mx-auto mb-3">
                  <Terminal size={22} className="text-purple-400" />
                </div>
                <h2 className="text-base font-bold text-white mb-1">OpenCode Local</h2>
                <p className="text-xs text-[hsl(215_14%_46%)] max-w-sm">
                  Agente de código autónomo con tool calling nativo.<br />
                  Lee archivos, escribe código, ejecuta comandos, busca en internet.<br />
                  Sin censura. Sin restricciones.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-1 w-full max-w-lg">
                {QUICK.map(s => (
                  <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                    className="text-left px-3 py-2 text-xs rounded-lg bg-[hsl(220_14%_13%)] border border-[hsl(220_14%_19%)] text-[hsl(210_20%_68%)] hover:bg-[hsl(220_14%_17%)] hover:text-white transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <Bubble key={i} msg={msg} isLast={i === messages.length - 1} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Search + Input */}
        <div className="border-t border-[hsl(220_14%_17%)] bg-[hsl(222_22%_8%)] px-4 py-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-[hsl(220_14%_11%)] border border-[hsl(220_14%_18%)] rounded-xl px-3 py-1.5 focus-within:border-blue-500/40 transition-colors">
            <Globe size={11} className="text-[hsl(215_14%_40%)] flex-shrink-0" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runSearch()}
              placeholder="Buscar en internet y añadir al contexto..."
              className="flex-1 bg-transparent text-xs text-white placeholder-[hsl(215_14%_34%)] outline-none" />
            <button onClick={runSearch} disabled={!searchQuery.trim() || searching}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/25 border border-blue-500/30 text-blue-300 hover:bg-blue-600/45 disabled:opacity-40 text-[11px] transition-colors">
              {searching ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
              {searching ? "..." : "Buscar"}
            </button>
          </div>

          <div className="flex items-end gap-2 bg-[hsl(220_14%_12%)] border border-[hsl(220_14%_19%)] rounded-2xl px-3 py-2.5 focus-within:border-purple-500/50 transition-colors">
            <textarea ref={textareaRef} value={input} onChange={onInput} onKeyDown={onKey}
              placeholder={ollamaReady ? "Describe una tarea... el agente la ejecutará autónomamente (Enter envía)" : "Cargando modelo..."}
              disabled={loading || !ollamaReady} rows={1}
              style={{ height: "22px" }}
              className="flex-1 bg-transparent text-sm text-white placeholder-[hsl(215_14%_34%)] resize-none outline-none disabled:opacity-40 max-h-[160px] leading-[22px]" />
            <button onClick={sendMessage} disabled={!input.trim() || loading || !ollamaReady}
              className="w-7 h-7 flex-shrink-0 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95">
              {loading ? <Loader2 size={13} className="text-white animate-spin" /> : <Send size={13} className="text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel: diff / file viewer ── */}
      {(selectedChange || selectedFileContent) && (
        <div className="w-[420px] border-l border-[hsl(220_14%_17%)] bg-[hsl(222_22%_8%)] flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(220_14%_16%)]">
            <div className="flex items-center gap-1.5">
              {selectedChange ? (
                <>
                  <Code size={12} className="text-green-400" />
                  <span className="text-xs font-semibold text-white">Diff</span>
                  <span className="text-[10px] text-[hsl(215_14%_42%)] font-mono">{selectedChange.path}</span>
                </>
              ) : (
                <>
                  <Eye size={12} className="text-blue-400" />
                  <span className="text-xs font-semibold text-white">Archivo</span>
                  <span className="text-[10px] text-[hsl(215_14%_42%)] font-mono truncate max-w-[220px]">{selectedFilePath}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedChange && fileChanges.length > 1 && (
                <div className="flex gap-0.5">
                  {fileChanges.map((c, i) => (
                    <button key={i} onClick={() => setSelectedChange(c)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${selectedChange.path === c.path ? "bg-purple-400" : "bg-[hsl(220_14%_30%)]"}`} />
                  ))}
                </div>
              )}
              <button onClick={() => { setSelectedChange(null); setSelectedFileContent(null); }}
                className="text-[hsl(215_14%_42%)] hover:text-white text-xs ml-1">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {selectedChange ? (
              <DiffView before={selectedChange.before} after={selectedChange.after} filePath={selectedChange.path} />
            ) : selectedFileContent !== null ? (
              <pre className="px-4 py-3 text-[11px] font-mono text-[hsl(210_20%_80%)] whitespace-pre overflow-x-auto leading-4">
                {selectedFileContent}
              </pre>
            ) : null}
          </div>

          {selectedChange && (
            <div className="px-3 py-2 border-t border-[hsl(220_14%_16%)] flex items-center justify-between">
              <span className="text-[10px] text-[hsl(215_14%_40%)]">Archivo escrito por el agente</span>
              <div className="flex gap-1.5">
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/15 border border-green-500/25 text-green-400 text-[11px]">
                  <CheckCircle2 size={10} />Aplicado
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
