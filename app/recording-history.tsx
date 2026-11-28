"use client";
import { useEffect, useState } from "react";
import { deleteRecording, listRecordings, saveRecording, type Recording } from "@/lib/recording-history";
import AudioPlayer from "./audio-player";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RecordingHistory() {
  const [items, setItems] = useState<(Recording & { url: string })[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  async function rename(item: Recording & { url: string }) {
    const name = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").slice(0, 120);
    if (!name) { setError("Enter a recording name."); return; }
    try {
      const { url: _url, ...record } = item;
      await saveRecording({ ...record, title: name });
      setItems((old) => old.map((r) => r.id === item.id ? { ...r, title: name } : r)); setEditing(null); setError("");
    } catch { setError("Could not rename this recording. Please retry."); }
  }
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    listRecordings().then((records) => {
      if (cancelled) return;
      setItems(records.map((item) => { const url = URL.createObjectURL(item.audio); urls.push(url); return { ...item, url }; }));
    }).catch(() => { if (!cancelled) setError("Saved history could not be opened in this browser."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  async function remove(item: Recording & { url: string }) {
    try {
      await deleteRecording(item.id);
      setItems((old) => old.filter((r) => r.id !== item.id)); URL.revokeObjectURL(item.url);
    } catch { setError("Could not delete this recording. Please retry."); }
  }
  return <div className="project-list">
    <p>Previous generated voices are saved in this browser, including audio and estimated SRT. Clearing browser site data removes them; download recordings you want to keep.</p>
    <div className="history-filters"><input type="search" aria-label="Search recordings" placeholder="Search title, script or voice…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Recording source" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All recordings</option><option value="studio">Studio</option><option value="playground">Playground</option><option value="clone">Voice cloning</option></select><span>{items.length} saved</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    {loading && <p>Loading saved recordings…</p>}
    {!loading && !items.length && !error && <div className="panel blank-state"><h2>No saved recordings yet.</h2><p>Generate a voice in Studio, Playground or Voice cloning to save it here.</p></div>}
    {!loading && items.length > 0 && !items.some((item) => (source === "all" || source === item.source) && `${item.title} ${item.text} ${item.voice}`.toLowerCase().includes(query.toLowerCase())) && <p>No matching recordings.</p>}
    {items.filter((item) => (source === "all" || source === item.source) && `${item.title} ${item.text} ${item.voice}`.toLowerCase().includes(query.toLowerCase())).map((item) => <article className="panel history-card" key={item.id} style={{ padding: 20 }}>
      <h3>{item.title}</h3><p>{new Date(item.created).toLocaleString()} · {item.source} · {item.voice} · {item.duration.toFixed(1)}s · {item.format.toUpperCase()}</p>
      {editing === item.id && <form className="history-filters" onSubmit={(e) => { e.preventDefault(); void rename(item); }}><input aria-label="Recording name" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /><button type="submit">Save name</button><button type="button" onClick={() => setEditing(null)}>Cancel rename</button></form>}
      <AudioPlayer src={item.url} preload="none" />
      <div className="director-take-actions">
        <button onClick={() => { setEditing(item.id); setTitle(item.title); }}>Rename</button>
        <button onClick={() => download(item.audio, `${item.title}.${item.format}`)}>Download voice</button>
        <button onClick={() => download(new Blob([item.subtitles], { type: "application/x-subrip;charset=utf-8" }), `${item.title}.srt`)}>Download SRT</button>
        <button aria-label={`Delete ${item.title}`} onClick={() => void remove(item)}>Delete</button>
      </div><details><summary>Script</summary><p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p></details>
    </article>)}
  </div>;
}
