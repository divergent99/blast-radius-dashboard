import { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Controls, Background, useNodesState, useEdgesState, MarkerType, Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "@dagrejs/dagre";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const riskMeta = (n) => {
  if (n >= 3) return { label: "Critical", color: "#E53E3E", light: "#FFF5F5", border: "#FC8181" };
  if (n >= 1) return { label: "High",     color: "#DD6B20", light: "#FFFAF0", border: "#F6AD55" };
  return            { label: "Low",       color: "#38A169", light: "#F0FFF4", border: "#68D391" };
};

const dirTheme = (path = "") => {
  if (/auth/.test(path))   return { accent: "#7C3AED", light: "#F5F3FF", border: "#C4B5FD", label: "#5B21B6", dot: "#8B5CF6" };
  if (/\/api/.test(path))  return { accent: "#2563EB", light: "#EFF6FF", border: "#93C5FD", label: "#1D4ED8", dot: "#3B82F6" };
  if (/utils/.test(path))  return { accent: "#059669", light: "#ECFDF5", border: "#6EE7B7", label: "#065F46", dot: "#10B981" };
  if (/test/.test(path))   return { accent: "#6B7280", light: "#F9FAFB", border: "#D1D5DB", label: "#374151", dot: "#9CA3AF" };
  if (/agent/.test(path))  return { accent: "#EA580C", light: "#FFF7ED", border: "#FDBA74", label: "#9A3412", dot: "#F97316" };
  return                          { accent: "#64748B", light: "#F8FAFC", border: "#CBD5E0", label: "#475569", dot: "#94A3B8" };
};

const renderTableHTML = (block) => {
  const rows = block.trim().split("\n").filter(r => r.trim());
  if (rows.length < 2) return block;
  const headerCells = rows[0].split("|").map(c => c.trim()).filter(Boolean);
  const bodyRows = rows.slice(2); // skip separator row
  const thStyle = "border:1px solid #E2E8F0;padding:4px 6px;background:#F8FAFC;font-weight:700;color:#1A202C;text-align:left;word-break:break-word;font-size:10px";
  const tdStyle = "border:1px solid #E2E8F0;padding:4px 6px;color:#4A5568;word-break:break-word;font-size:10px";
  const ths = headerCells.map(c => `<th style="${thStyle}">${c}</th>`).join("");
  const trs = bodyRows.map(row => {
    const cells = row.split("|").map(c => c.trim()).filter(Boolean);
    return `<tr>${cells.map(c => `<td style="${tdStyle}">${c}</td>`).join("")}</tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:10px;table-layout:fixed;word-wrap:break-word"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
};

const MD = ({ text }) => {
  if (!text) return null;

  let html = text;

  // Replace markdown tables first (before other transforms)
  html = html.replace(/((?:\|.*\|\n?)+)/g, (match) => {
    const lines = match.trim().split("\n");
    if (lines.length >= 2 && /^[|\-\s]+$/.test(lines[1])) {
      return renderTableHTML(match);
    }
    return match;
  });

  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1A202C;font-weight:700">$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:#EDF2F7;color:#2D3748;padding:1px 5px;border-radius:4px;font-family:JetBrains Mono,monospace;font-size:10px">$1</code>')
    .replace(/^### (.+)$/gm, '<p style="font-weight:700;color:#1A202C;margin:10px 0 3px;font-size:12px">$1</p>')
    .replace(/^## (.+)$/gm,  '<p style="font-weight:800;color:#1A202C;margin:12px 0 4px;font-size:13px">$1</p>')
    .replace(/^> (.+)$/gm,   '<div style="border-left:3px solid #CBD5E0;padding:4px 10px;margin:4px 0;color:#718096;font-style:italic">$1</div>')
    .replace(/^- (.+)$/gm,   '<div style="padding-left:14px;margin:2px 0;color:#4A5568">· $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:14px;margin:2px 0;color:#4A5568">$1</div>')
    .replace(/\n\n/g, '<div style="height:6px"></div>')
    .replace(/\n/g, "<br/>");

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: 12, color: "#4A5568", lineHeight: 1.65, textAlign: "left" }} />;
};

const NODE_W = 160, NODE_H = 70;
const FileNode = ({ data }) => {
  const ch = data.isChanged, af = data.isAffected;
  const th = dirTheme(data.fullPath || "");
  const border = ch ? "#3B82F6" : af ? "#F59E0B" : th.border;
  const bg     = ch ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : af ? "linear-gradient(135deg,#FFFBEB,#FEF3C7)" : `linear-gradient(135deg,#FFFFFF,${th.light})`;
  const txt    = ch ? "#1D4ED8" : af ? "#92400E" : th.label;
  const shadow = ch ? "0 0 0 2px #BFDBFE,0 6px 20px #3B82F625" : af ? "0 0 0 2px #FDE68A,0 6px 20px #F59E0B25" : `0 2px 8px #00000012,0 0 0 1px ${th.border}`;
  const bar    = ch ? "#3B82F6" : af ? "#F59E0B" : th.accent;
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: "10px 13px", width: NODE_W, minHeight: NODE_H, color: txt, fontFamily: "'JetBrains Mono',monospace", boxShadow: shadow, position: "relative", overflow: "visible", transition: "all .2s", cursor: "pointer" }}>
      <Handle type="target" position={Position.Left}  style={{ background: border, border: "none", width: 7, height: 7, left: -4 }} />
      <Handle type="source" position={Position.Right} style={{ background: border, border: "none", width: 7, height: 7, right: -4 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "10px 10px 0 0", background: bar }} />
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, marginBottom: 3, opacity: 0.55, textTransform: "uppercase", marginTop: 2 }}>
        {ch ? "◆ CHANGED" : af ? "● AT RISK" : th.label.toUpperCase().split(" ")[0] + " · " + (data.label.split(".")[1] || "").toUpperCase()}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, wordBreak: "break-all" }}>{data.label}</div>
      {data.symbols?.length > 0 && (
        <div style={{ fontSize: 8, marginTop: 4, padding: "2px 5px", background: af ? "#FEF3C7" : th.light, borderRadius: 3, color: af ? "#92400E" : th.accent }}>
          {data.symbols.slice(0, 2).join(" · ")}{data.symbols.length > 2 ? ` +${data.symbols.length - 2}` : ""}
        </div>
      )}
    </div>
  );
};
const nodeTypes = { fileNode: FileNode };

const applyLayout = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "RL", ranksep: 80, nodesep: 40 });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }; });
};

const buildGraph = (files, edges, changed = [], affected = []) => {
  const cSet = new Set(changed), aSet = new Set(affected);
  const nodes = files.map(f => {
    const parts = [...f.path.split("/")]; const name = parts.pop();
    return { id: f.path, type: "fileNode", position: { x: 0, y: 0 }, data: { label: name, dir: parts.join("/"), fullPath: f.path, isChanged: cSet.has(f.path), isAffected: aSet.has(f.path) && !cSet.has(f.path), symbols: [] } };
  });
  const rfEdges = edges.map((e, i) => {
    const hot = cSet.has(e.source) || aSet.has(e.target);
    const th = dirTheme(e.source);
    return { id: `e${i}`, source: e.source, target: e.target, animated: hot, type: "smoothstep", style: { stroke: hot ? "#F59E0B" : th.border, strokeWidth: hot ? 2 : 1, opacity: hot ? 1 : 0.6 }, markerEnd: { type: MarkerType.ArrowClosed, color: hot ? "#F59E0B" : th.dot, width: 10, height: 10 }, label: hot && e.symbols?.[0] ? e.symbols[0] : "", labelStyle: { fill: "#92400E", fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }, labelBgStyle: { fill: "#FFFBEB", fillOpacity: 0.95 }, labelBgPadding: [3, 4], labelBgBorderRadius: 3 };
  });
  return { nodes: applyLayout(nodes, rfEdges), edges: rfEdges };
};

const Loader = ({ msg }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, zIndex: 10, background: "#F8FAFC", backdropFilter: "blur(6px)" }}>
    <div style={{ position: "relative", width: 72, height: 72 }}>
      {[[0, "1.2s", "#3B82F6", false], [14, "0.8s", "#F59E0B", true]].map(([sz, dur, col, rev], k) => (
        <div key={k}>
          <div style={{ position: "absolute", inset: sz, border: "1px solid #E2E8F0", borderRadius: "50%" }} />
          <div style={{ position: "absolute", inset: sz, animation: `orbitSpin ${dur} linear infinite ${rev ? "reverse" : ""}` }}>
            <div style={{ position: "absolute", top: sz === 0 ? -4 : -3, left: "50%", transform: "translateX(-50%)", width: sz === 0 ? 8 : 6, height: sz === 0 ? 8 : 6, borderRadius: "50%", background: col, boxShadow: `0 0 10px ${col}88` }} />
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 5, height: 5, borderRadius: "50%", background: "#38A169", boxShadow: "0 0 8px #38A16988" }} />
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{msg}</div>
      <div style={{ fontSize: 9, color: "#CBD5E0", marginTop: 4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>GITLAB ORBIT · KNOWLEDGE GRAPH</div>
    </div>
  </div>
);

export default function App() {
  const [projectPath, setProjectPath] = useState("gitlab-ai-hackathon/transcend/35648667");
  const [mrList, setMrList]   = useState([{ id: 1, value: "1" }]);
  const [loadingG, setLG]     = useState(false);
  const [loadingA, setLA]     = useState(false);
  const [error, setError]     = useState("");
  const [gData, setGData]     = useState(null);
  const [aData, setAData]     = useState(null);
  const [activeMr, setActMr]  = useState(null);
  const [nodes, setNodes, onNC] = useNodesState([]);
  const [edges, setEdges, onEC] = useEdgesState([]);
  const [descs, setDescs]     = useState({});
  const [selFile, setSelFile] = useState(null);
  const [clickedNode, setClickedNode] = useState(null);
  const [chat, setChat]       = useState([{ role: "ai", text: "Hey! Ask me anything about this codebase — dependencies, blast radius, architecture, anything." }]);
  const [chatIn, setChatIn]   = useState("");
  const [chatLoad, setChatL]  = useState(false);
  const [chatTab, setChatTab] = useState("chat");
  const [webhookLoading, setWHL] = useState(null);
  const [webhookStatus, setWHS] = useState({});
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const loadGraph = useCallback(async (path) => {
    if (!path) return;
    setLG(true); setError(""); setGData(null); setAData(null); setNodes([]); setEdges([]); setDescs({}); setSelFile(null); setClickedNode(null);
    try {
      const r = await fetch(`${BACKEND_URL}/graph`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_path: path, mr_iid: 0 }) });
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      const j = await r.json(); setGData(j);
      const { nodes: n, edges: e } = buildGraph(j.files, j.edges); setNodes(n); setEdges(e);
      const chunks = []; for (let i = 0; i < j.files.length; i += 3) chunks.push(j.files.slice(i, i + 3));
      for (const chunk of chunks) await Promise.all(chunk.map(async f => { try { const dr = await fetch(`${BACKEND_URL}/describe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_path: f.path }) }); const dj = await dr.json(); setDescs(p => ({ ...p, [f.path]: dj.description })); } catch {} }));
    } catch (err) { setError(err.message); } finally { setLG(false); }
  }, []);

  const analyze = useCallback(async (mrIid) => {
    if (!projectPath || !mrIid || !gData) return;
    setLA(true); setError(""); setActMr(mrIid);
    try {
      const r = await fetch(`${BACKEND_URL}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_path: projectPath, mr_iid: parseInt(mrIid) }) });
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      const j = await r.json(); setAData(j);
      const allAff = Object.values(j.blast_radius).flat();
      const { nodes: n, edges: e } = buildGraph(gData.files, gData.edges, j.changed_files, allAff); setNodes(n); setEdges(e);
    } catch (err) { setError(err.message); } finally { setLA(false); }
  }, [projectPath, gData]);

  const clearA = () => { setAData(null); setActMr(null); if (gData) { const { nodes: n, edges: e } = buildGraph(gData.files, gData.edges); setNodes(n); setEdges(e); } };

  const triggerWebhook = async (mrIid) => {
    if (!projectPath || !mrIid) return;
    setWHL(mrIid);
    setWHS(s => ({ ...s, [mrIid]: "loading" }));
    try {
      const r = await fetch(`${BACKEND_URL}/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gitlab-Event": "Merge Request Hook",
          "X-Gitlab-Token": "blastradius123",
        },
        body: JSON.stringify({
          object_attributes: { iid: parseInt(mrIid), title: `MR !${mrIid}`, action: "open" },
          project: { id: 83492513, path_with_namespace: projectPath },
          user: { username: "abhineetsharma77" },
        }),
      });
      const j = await r.json();
      if (j.status === "accepted") {
        setWHS(s => ({ ...s, [mrIid]: "done" }));
        setChat(c => [...c, { role: "ai", text: `✅ Blast radius comment posted to MR !${mrIid} on GitLab. Check the merge request in a few seconds.` }]);
        setChatTab("chat");
        setTimeout(() => setWHS(s => ({ ...s, [mrIid]: null })), 3000);
      }
    } catch (err) { setError(err.message); setWHS(s => ({ ...s, [mrIid]: null })); } finally { setWHL(null); }
  };

  const onNodeClick = useCallback((_, node) => {
    setClickedNode(node.data);
    setChatTab("file");
  }, []);

  const sendChat = async () => {
    if (!chatIn.trim() || chatLoad) return;
    const msg = chatIn.trim(); setChatIn(""); setChatL(true); setChatTab("chat");
    setChat(c => [...c, { role: "user", text: msg }]);
    try {
      const ctx = { ...(gData || { files: [], edges: [] }), ...(aData ? { changed_files: aData.changed_files, blast_radius: aData.blast_radius, imported_symbols: aData.imported_symbols } : {}) };
      const r = await fetch(`${BACKEND_URL}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, graph_context: ctx }) });
      const j = await r.json(); setChat(c => [...c, { role: "ai", text: j.answer }]);
    } catch { setChat(c => [...c, { role: "ai", text: "Something went wrong. Try again." }]); } finally { setChatL(false); }
  };

  const leaderboard = aData ? Object.entries(aData.blast_radius).map(([f, aff]) => ({ file: f.split("/").pop(), fullPath: f, dependents: aff.length, ...riskMeta(aff.length) })).sort((a, b) => b.dependents - a.dependents) : [];
  const totalRisk = aData ? Object.values(aData.blast_radius).flat().length : 0;
  const totalSym  = aData ? Object.values(aData.imported_symbols).flat().length : 0;
  const suggestions = ["What does this project do?", "Which file is most risky to change?", "Explain the auth flow", "What imports token.py?"];

  const FileDetail = ({ node }) => {
    const th = dirTheme(node.fullPath || "");
    const fileEdgesOut = gData?.edges.filter(e => e.source === node.fullPath) || [];
    const fileEdgesIn  = gData?.edges.filter(e => e.target === node.fullPath) || [];
    const isChanged  = aData?.changed_files.includes(node.fullPath);
    const isAffected = !isChanged && Object.values(aData?.blast_radius || {}).flat().includes(node.fullPath);
    return (
      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: th.light, border: `1.5px solid ${th.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: th.dot }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#0F172A" }}>{node.label}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2, wordBreak: "break-all" }}>{node.fullPath}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: th.light, color: th.accent, border: `1px solid ${th.border}` }}>{node.dir?.split("/").pop() || "root"}</span>
          {isChanged  && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>◆ Changed</span>}
          {isAffected && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>● At Risk</span>}
        </div>
        {descs[node.fullPath] && (
          <div style={{ padding: "10px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            {descs[node.fullPath]}
          </div>
        )}
        {fileEdgesOut.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>Imports ({fileEdgesOut.length})</div>
            {fileEdgesOut.map((e, i) => {
              const t = dirTheme(e.target);
              return (
                <div key={i} onClick={() => setClickedNode({ label: e.target.split("/").pop(), fullPath: e.target, dir: e.target.split("/").slice(0, -1).join("/"), isChanged: false, isAffected: false, symbols: [] })}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", marginBottom: 4, borderRadius: 7, background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", transition: "all .15s" }}
                  onMouseEnter={ev => { ev.currentTarget.style.borderColor = t.border; ev.currentTarget.style.background = t.light; }}
                  onMouseLeave={ev => { ev.currentTarget.style.borderColor = "#E2E8F0"; ev.currentTarget.style.background = "#F8FAFC"; }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.target.split("/").pop()}</div>
                    {e.symbols?.length > 0 && <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>{e.symbols.join(", ")}</div>}
                  </div>
                  <span style={{ fontSize: 9, color: "#CBD5E0" }}>→</span>
                </div>
              );
            })}
          </div>
        )}
        {fileEdgesIn.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>Imported by ({fileEdgesIn.length})</div>
            {fileEdgesIn.map((e, i) => {
              const t = dirTheme(e.source);
              return (
                <div key={i} onClick={() => setClickedNode({ label: e.source.split("/").pop(), fullPath: e.source, dir: e.source.split("/").slice(0, -1).join("/"), isChanged: false, isAffected: false, symbols: [] })}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", marginBottom: 4, borderRadius: 7, background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", transition: "all .15s" }}
                  onMouseEnter={ev => { ev.currentTarget.style.borderColor = t.border; ev.currentTarget.style.background = t.light; }}
                  onMouseLeave={ev => { ev.currentTarget.style.borderColor = "#E2E8F0"; ev.currentTarget.style.background = "#F8FAFC"; }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.source.split("/").pop()}</div>
                  <span style={{ fontSize: 9, color: "#CBD5E0", marginLeft: "auto" }}>←</span>
                </div>
              );
            })}
          </div>
        )}
        {fileEdgesOut.length === 0 && fileEdgesIn.length === 0 && (
          <div style={{ fontSize: 11, color: "#CBD5E0", fontStyle: "italic" }}>No import relationships found for this file.</div>
        )}
        <button onClick={() => { setChatIn(`Tell me more about ${node.label} and its role in this codebase`); setChatTab("chat"); }}
          style={{ padding: "8px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#1D4ED8"; e.currentTarget.style.background = "#EFF6FF"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "#F8FAFC"; }}>
          💬 Ask Claude about this file
        </button>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;width:100%;overflow:hidden;}
        body{background:#F1F5F9;font-family:'Inter',sans-serif;}
        input{outline:none;}
        button{cursor:pointer;transition:all .15s;}
        button:hover:not(:disabled){transform:translateY(-1px);}
        button:active:not(:disabled){transform:none;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:4px;}
        @keyframes orbitSpin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:none;}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
        .fade-in{animation:fadeIn .25s ease forwards;}
        .row:hover{background:#F8FAFC!important;}
        .react-flow__controls{background:#FFFFFF!important;border:1px solid #E2E8F0!important;border-radius:10px!important;box-shadow:0 4px 16px #00000010!important;}
        .react-flow__controls-button{background:transparent!important;border:none!important;border-bottom:1px solid #EDF2F7!important;color:#94A3B8!important;fill:#94A3B8!important;}
        .react-flow__controls-button:hover{background:#F8FAFC!important;fill:#64748B!important;}
        .react-flow__controls-button:last-child{border-bottom:none!important;}
        .react-flow__node:hover > div{box-shadow:0 0 0 3px #BFDBFE,0 8px 24px #3B82F620!important;}
      `}</style>

      <div style={{ display: "flex", height: "100vh", width: "100vw" }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "#FFFFFF", borderRight: "1px solid #E2E8F0", boxShadow: "4px 0 24px #00000008", overflow: "hidden", zIndex: 2 }}>

          {/* Logo */}
          <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #EDF2F7", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3B82F6,#1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 4px 14px #3B82F640", flexShrink: 0 }}>💥</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0F172A", letterSpacing: "-0.4px" }}>Blast Radius</div>
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>Powered by GitLab Orbit</div>
              </div>
            </div>
          </div>

          {/* Project input */}
          <div style={{ padding: "13px 20px", borderBottom: "1px solid #EDF2F7", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}>Project</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={projectPath} onChange={e => setProjectPath(e.target.value)} onKeyDown={e => e.key === "Enter" && loadGraph(projectPath)} placeholder="group/subgroup/project"
                style={{ flex: 1, background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "7px 10px", color: "#0F172A", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}
                onFocus={e => { e.target.style.borderColor = "#3B82F6"; e.target.style.boxShadow = "0 0 0 3px #DBEAFE"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }} />
              <button onClick={() => loadGraph(projectPath)} disabled={loadingG || !projectPath}
                style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: loadingG ? "#EDF2F7" : "#0F172A", color: loadingG ? "#94A3B8" : "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: loadingG ? "none" : "0 2px 8px #0F172A30" }}>
                {loadingG ? "···" : "Load"}
              </button>
            </div>
            {gData && (
              <div style={{ marginTop: 7, display: "flex", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#2563EB", background: "#EFF6FF", padding: "2px 9px", borderRadius: 20, fontWeight: 600, border: "1px solid #BFDBFE" }}>{gData.files.length} files</span>
                <span style={{ fontSize: 10, color: "#059669", background: "#ECFDF5", padding: "2px 9px", borderRadius: 20, fontWeight: 600, border: "1px solid #A7F3D0" }}>{gData.edges.length} imports</span>
              </div>
            )}
            {error && <div style={{ marginTop: 7, padding: "6px 9px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, fontSize: 11, color: "#DC2626" }}>⚠ {error}</div>}
          </div>

          {/* MR section */}
          <div style={{ padding: "13px 20px", borderBottom: "1px solid #EDF2F7", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Merge Requests</div>
              <button onClick={() => setMrList(l => [...l, { id: Date.now(), value: "" }])}
                style={{ fontSize: 10, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                + Add
              </button>
            </div>
            {mrList.map(mr => (
              <div key={mr.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace" }}>#</span>
                  <input value={mr.value} onChange={e => setMrList(l => l.map(m => m.id === mr.id ? { ...m, value: e.target.value } : m))}
                    placeholder="MR number" type="number"
                    style={{ flex: 1, background: activeMr === mr.value && mr.value ? "#F0FDF4" : "#F8FAFC", border: `1.5px solid ${activeMr === mr.value && mr.value ? "#86EFAC" : "#E2E8F0"}`, borderRadius: 7, padding: "6px 9px", color: "#0F172A", fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}
                    onFocus={e => { e.target.style.borderColor = "#3B82F6"; e.target.style.boxShadow = "0 0 0 3px #DBEAFE"; }}
                    onBlur={e => { e.target.style.borderColor = activeMr === mr.value && mr.value ? "#86EFAC" : "#E2E8F0"; e.target.style.boxShadow = "none"; }} />
                  {mrList.length > 1 && (
                    <button onClick={() => setMrList(l => l.filter(m => m.id !== mr.id))}
                      style={{ padding: "5px 7px", borderRadius: 7, border: "1px solid #E2E8F0", background: "none", color: "#CBD5E0", fontSize: 11 }}>✕</button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => analyze(mr.value)} disabled={loadingA || !gData || !mr.value}
                    title="Analyze blast radius on graph"
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: !gData || loadingA ? "#EDF2F7" : "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: !gData || loadingA ? "#94A3B8" : "#fff", fontWeight: 700, fontSize: 11, boxShadow: !gData || loadingA ? "none" : "0 2px 8px #3B82F640" }}>
                    {loadingA && activeMr === mr.value ? "···" : "→ Analyze"}
                  </button>
                  <button
                    onClick={() => triggerWebhook(mr.value)}
                    disabled={!mr.value || webhookLoading === mr.value}
                    title="Post blast radius comment to GitLab MR"
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: `1.5px solid ${webhookStatus[mr.value] === "done" ? "#86EFAC" : "#E2E8F0"}`, background: webhookStatus[mr.value] === "done" ? "#F0FDF4" : webhookLoading === mr.value ? "#EDF2F7" : "#F8FAFC", color: webhookStatus[mr.value] === "done" ? "#059669" : webhookLoading === mr.value ? "#94A3B8" : "#475569", fontSize: 11, fontWeight: 600 }}>
                    {webhookLoading === mr.value ? "···" : webhookStatus[mr.value] === "done" ? "✓ Posted!" : "💬 Post to GL"}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>→</span> analyze graph &nbsp;·&nbsp; <span style={{ fontWeight: 700 }}>💬</span> post comment to GitLab
            </div>
          </div>

          {/* Stats grid */}
          {aData && (
            <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#EDF2F7", borderBottom: "1px solid #EDF2F7", flexShrink: 0 }}>
              {[{ label: "Changed", value: aData.changed_files.length, color: "#2563EB" }, { label: "At Risk", value: totalRisk, color: "#D97706" }, { label: "Symbols", value: totalSym, color: "#DC2626" }, { label: "Risk Level", value: leaderboard[0]?.label || "Low", color: leaderboard[0]?.color || "#059669" }].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#FFFFFF", padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* File list / leaderboard */}
          <div style={{ flex: 1, overflow: "auto", paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "4px 20px 7px" }}>{aData ? "Risk Leaderboard" : "File Index"}</div>
            {!gData && !loadingG && <div style={{ padding: "6px 20px", color: "#CBD5E0", fontSize: 11, lineHeight: 1.8 }}>Load a project to get started.</div>}
            {gData && !aData && (
              <div style={{ padding: "0 20px 10px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                {[{ label: "auth", color: "#7C3AED", bg: "#F5F3FF" }, { label: "api", color: "#2563EB", bg: "#EFF6FF" }, { label: "utils", color: "#059669", bg: "#ECFDF5" }, { label: "agent", color: "#EA580C", bg: "#FFF7ED" }, { label: "test", color: "#6B7280", bg: "#F9FAFB" }].map(({ label, color, bg }) => (
                  <span key={label} style={{ fontSize: 9, color, background: bg, padding: "2px 7px", borderRadius: 20, fontWeight: 600, border: `1px solid ${color}33` }}>{label}</span>
                ))}
              </div>
            )}
            {aData ? leaderboard.map((item, i) => (
              <div key={item.fullPath} className="row fade-in"
                style={{ padding: "9px 20px", cursor: "pointer", background: selFile === item.fullPath ? "#F8FAFC" : "transparent", borderLeft: `3px solid ${selFile === item.fullPath ? item.color : "transparent"}`, animationDelay: `${i * 0.03}s`, transition: "all .15s" }}
                onClick={() => { setSelFile(selFile === item.fullPath ? null : item.fullPath); setClickedNode({ label: item.file, fullPath: item.fullPath, dir: item.fullPath.split("/").slice(0, -1).join("/"), isChanged: aData?.changed_files.includes(item.fullPath), isAffected: true, symbols: [] }); setChatTab("file"); }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "#CBD5E0", width: 14, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{item.fullPath}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: item.color, background: item.light, border: `1px solid ${item.border}`, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>{item.label}</span>
                </div>
              </div>
            )) : gData?.files.map((f, i) => {
              const th = dirTheme(f.path);
              const fname = f.path.split("/").pop();
              return (
                <div key={f.path} className="row fade-in"
                  style={{ padding: "8px 20px", cursor: "pointer", background: selFile === f.path ? th.light : "transparent", borderLeft: `3px solid ${selFile === f.path ? th.accent : "transparent"}`, animationDelay: `${i * 0.02}s`, transition: "all .15s" }}
                  onClick={() => { setSelFile(selFile === f.path ? null : f.path); setClickedNode({ label: fname, fullPath: f.path, dir: f.path.split("/").slice(0, -1).join("/"), isChanged: false, isAffected: false, symbols: [] }); setChatTab("file"); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: descs[f.path] ? th.dot : "#E2E8F0", flexShrink: 0, transition: "background .4s", boxShadow: descs[f.path] ? `0 0 5px ${th.dot}88` : "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fname}</div>
                      <div style={{ fontSize: 9, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{f.path}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {aData && <div style={{ padding: "8px 20px" }}><button onClick={clearA} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "none", color: "#94A3B8", fontSize: 11, fontWeight: 600 }}>Clear Analysis</button></div>}
          </div>
        </div>

        {/* CENTER GRAPH */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#F8FAFC" }}>
          {!gData && !loadingG && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, pointerEvents: "none", userSelect: "none", zIndex: 10, background: "#F8FAFC" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>
                  GitLab Transcend Hackathon 2026 · Showcase Track
                </div>
                <div style={{ fontSize: 72, fontWeight: 900, color: "#94A3B8", letterSpacing: "-3px", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
                  Blast Radius
                </div>
                <div style={{ fontSize: 15, color: "#64748B", marginTop: 14, fontWeight: 500 }}>
                  Know what breaks before you merge
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#B0BEC5", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
                  Powered by GitLab Orbit · Claude Sonnet 4.6
                </div>
                <div style={{ marginTop: 20, fontSize: 11, color: "#B0BEC5" }}>
                  ← Load a project to visualize its dependency graph
                </div>
              </div>
            </div>
          )}
          {loadingG && <Loader msg="Loading project dependency graph..." />}
          {loadingA && <Loader msg="Querying Orbit knowledge graph..." />}
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNC} onEdgesChange={onEC} nodeTypes={nodeTypes} onNodeClick={onNodeClick} fitView fitViewOptions={{ padding: 0.2 }} style={{ background: "#F8FAFC" }} proOptions={{ hideAttribution: true }}>
            <Background color="#E2E8F0" gap={24} size={1} />
            <Controls />
          </ReactFlow>
          {gData && (
            <div style={{ position: "absolute", top: 14, left: 14, zIndex: 5, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "11px 14px", boxShadow: "0 4px 16px #00000010" }}>
              <div style={{ fontSize: 9, color: "#94A3B8", letterSpacing: 1, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Legend</div>
              {[{ color: "#3B82F6", border: "#BFDBFE", label: "Changed" }, { color: "#F59E0B", border: "#FDE68A", label: "At risk" }, { color: "#7C3AED", border: "#C4B5FD", label: "Auth" }, { color: "#2563EB", border: "#93C5FD", label: "API" }, { color: "#059669", border: "#6EE7B7", label: "Utils" }, { color: "#EA580C", border: "#FDBA74", label: "Agent" }].map(({ color, border, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 10, height: 4, borderRadius: 2, background: color, opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #EDF2F7", fontSize: 9, color: "#CBD5E0" }}>Click a node to inspect</div>
            </div>
          )}
          {aData && (
            <div className="fade-in" style={{ position: "absolute", bottom: 14, left: 14, zIndex: 5, background: "#FFFFFF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "7px 12px", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px #00000010" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", animation: "pulse 2s ease infinite", boxShadow: "0 0 6px #3B82F666" }} />
              <span style={{ fontSize: 10, color: "#3B82F6", fontWeight: 600 }}>MR !{activeMr} · blast radius active</span>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", background: "#FFFFFF", borderLeft: "1px solid #E2E8F0", boxShadow: "-4px 0 24px #00000008", overflow: "hidden", zIndex: 2 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #EDF2F7", background: "#FAFAFA", flexShrink: 0 }}>
            {[{ key: "chat", label: "💬 Chat" }, { key: "file", label: "📄 File" }].map(({ key, label }) => (
              <button key={key} onClick={() => setChatTab(key)}
                style={{ flex: 1, padding: "13px 0", fontSize: 12, fontWeight: chatTab === key ? 700 : 500, color: chatTab === key ? "#1D4ED8" : "#94A3B8", background: "none", border: "none", borderBottom: `2px solid ${chatTab === key ? "#3B82F6" : "transparent"}`, transition: "all .15s" }}>
                {label}
              </button>
            ))}
          </div>

          {chatTab === "chat" ? (
            <>
              <div style={{ flex: 1, overflow: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
                {chat.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 3 }}>
                    {m.role === "ai" && <div style={{ fontSize: 10, color: "#94A3B8", paddingLeft: 2, fontWeight: 500 }}>Blast Radius AI</div>}
                    <div style={{ maxWidth: "88%", padding: "10px 13px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px", background: m.role === "user" ? "linear-gradient(135deg,#3B82F6,#1D4ED8)" : "#F8FAFC", border: m.role === "user" ? "none" : "1px solid #E2E8F0", boxShadow: m.role === "user" ? "0 3px 10px #3B82F630" : "0 1px 3px #00000008", textAlign: "left" }}>
                      {m.role === "user" ? <span style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>{m.text}</span> : <MD text={m.text} />}
                    </div>
                  </div>
                ))}
                {chatLoad && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", paddingLeft: 2, fontWeight: 500 }}>Blast Radius AI</div>
                    <div style={{ padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "3px 14px 14px 14px", display: "flex", gap: 5 }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD5E0", animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />)}
                    </div>
                  </div>
                )}
                {chat.length === 1 && !chatLoad && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>Try asking:</div>
                    {suggestions.map(s => (
                      <button key={s} onClick={() => setChatIn(s)}
                        style={{ textAlign: "left", padding: "8px 11px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 11, fontWeight: 500, lineHeight: 1.4 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#1D4ED8"; e.currentTarget.style.background = "#EFF6FF"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "#F8FAFC"; }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #EDF2F7", background: "#FAFAFA", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", background: "#FFFFFF", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "7px 8px 7px 13px", boxShadow: "0 1px 4px #00000008", transition: "border .2s,box-shadow .2s" }}
                  onFocusCapture={e => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 0 0 3px #DBEAFE"; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "0 1px 4px #00000008"; }}>
                  <input value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about your codebase..."
                    style={{ flex: 1, background: "none", border: "none", color: "#0F172A", fontSize: 12, padding: "2px 0", minWidth: 0 }} />
                  <button onClick={sendChat} disabled={chatLoad || !chatIn.trim()}
                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: chatLoad || !chatIn.trim() ? "#EDF2F7" : "linear-gradient(135deg,#3B82F6,#1D4ED8)", color: chatLoad || !chatIn.trim() ? "#CBD5E0" : "#fff", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: chatLoad || !chatIn.trim() ? "none" : "0 2px 8px #3B82F640" }}>
                    ↑
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, overflow: "auto" }}>
              {clickedNode ? <FileDetail node={clickedNode} /> : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, padding: 20 }}>
                  <div style={{ fontSize: 36, opacity: 0.15 }}>📄</div>
                  <div style={{ fontSize: 12, color: "#CBD5E0", textAlign: "center", lineHeight: 1.7 }}>Click any node in the graph or file in the sidebar to inspect it</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}