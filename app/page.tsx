"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  CircleHelp,
  Download,
  FileText,
  FolderOpen,
  Github,
  History,
  LayoutDashboard,
  Library,
  LoaderCircle,
  LogOut,
  Mic2,
  Moon,
  Play,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  detectLanguage,
  emotions,
  sentences,
  srt,
  voices,
  type SynthesisInput,
} from "@/lib/script";
type Clip = {
  id: string;
  name: string;
  text: string;
  url: string;
  format: "wav" | "mp3";
  duration: number;
  peaks: number[];
  created: string;
  voice: string;
};
type Project = {
  id: string;
  name: string;
  text: string;
  voice: SynthesisInput["voice"];
  created: string;
};
const sample =
  "স্বাগতম ByteminusVoiceStudio-তে। আপনার ভাবনাকে কণ্ঠ দিন। [pause 500ms] আজ থেকেই শুরু হোক নতুন গল্প।";
const sections = [
  "Voice studio",
  "Voice library",
  "Projects",
  "History",
  "Settings",
] as const;
export default function Studio() {
  const [section, setSection] = useState<string>("Voice studio");
  const [text, setText] = useState(sample);
  const [voice, setVoice] = useState<SynthesisInput["voice"]>("mithi:charvi");
  const [language, setLanguage] = useState("bn");
  const [gender, setGender] = useState("All");
  const [emotion, setEmotion] = useState<SynthesisInput["emotion"]>("Neutral");
  const [intensity, setIntensity] = useState(50);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [format, setFormat] = useState<"wav" | "mp3">("wav");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [active, setActive] = useState<Clip>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [theme, setTheme] = useState("dark");
  const [search, setSearch] = useState("");
  const [libraryLanguage, setLibraryLanguage] = useState("all");
  const [libraryGender, setLibraryGender] = useState("All");
  const [auth, setAuth] = useState<boolean | null>(null);
  const [local, setLocal] = useState(false);
  const [password, setPassword] = useState("");
  const [usage, setUsage] = useState({ characters: 0, requests: 0, failed: 0 });
  const [help, setHelp] = useState(false);
  const [progress, setProgress] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [dialogue, setDialogue] = useState(false);
  const [style, setStyle] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [engineFilter, setEngineFilter] = useState("all");
  const [engines, setEngines] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const clipsRef = useRef<Clip[]>([]);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setAuth(d.authenticated);
        setLocal(d.localMode);
      })
      .catch(() => setError("Unable to connect to the studio."));
    try {
      const saved = localStorage.getItem("byteminus.projects");
      if (saved) setProjects(JSON.parse(saved));
      const draft = localStorage.getItem("byteminus.draft");
      if (draft) setText(draft);
    } catch {}
    return () => {
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!auth) return;
    fetch("/api/tts/voices")
      .then((r) => r.json())
      .then((d) => setEngines(d.neural?.engines ?? {}))
      .catch(() => {});
    fetch("/api/tts/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.requests !== undefined) setUsage(d);
      })
      .catch(() => {});
  }, [auth, clips]);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const filtered = voices.filter(
    (v) =>
      (libraryLanguage === "all" || v.language === libraryLanguage) &&
      (libraryGender === "All" || v.gender === libraryGender) &&
      (showLegacy || v.neural) &&
      (engineFilter === "all" || v.engine === engineFilter) &&
      `${v.name} ${v.accent}`.toLowerCase().includes(search.toLowerCase()),
  );
  function changeLanguage(value: string) {
    setLanguage(value);
    setGender("All");
    const selected = voices.find((v) => v.language === value && v.neural);
    if (selected) setVoice(selected.id as SynthesisInput["voice"]);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error.message);
      setAuth(true);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    }
  }
  function download(data: Blob | string, name: string) {
    const url = typeof data === "string" ? data : URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    if (typeof data !== "string")
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function save() {
    if (!text.trim()) return;
    const project: Project = {
      id: crypto.randomUUID(),
      name: text.replace(/\[[^\]]*\]/g, "").slice(0, 45),
      text,
      voice,
      created: new Date().toISOString(),
    };
    const next = [project, ...projects].slice(0, 50);
    try {
      localStorage.setItem("byteminus.projects", JSON.stringify(next));
      localStorage.setItem("byteminus.draft", text);
      setProjects(next);
      setNotice("Project saved on this device.");
    } catch {
      setError("Device storage is full. Export your script as TXT.");
    }
  }
  async function generate(overrideText?: string, overrideVoice?: string) {
    const source = overrideText ?? text;
    if (!source.trim() || busy) return;
    setBusy(true);
    setError("");
    const requestedVoice = (overrideVoice ?? voice) as SynthesisInput["voice"];
    setProgress(
      voices.find((v) => v.id === requestedVoice)?.styleMode === "prompted"
        ? "Loading expressive voice and generating on CPU. This can take several minutes…"
        : "Generating neural speech on your CPU. First use loads the model…",
    );
    try {
      const r = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source,
          voice: requestedVoice,
          emotion,
          intensity,
          rate,
          pitch,
          format,
          style,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        if (r.status === 401) setAuth(false);
        throw new Error(d.error?.message ?? "Generation failed.");
      }
      setProgress("Preparing audio preview…");
      const blob = await r.blob();
      const clip: Clip = {
        id: crypto.randomUUID(),
        name: source.replace(/\[[^\]]*\]/g, "").slice(0, 45),
        text: source,
        url: URL.createObjectURL(blob),
        format,
        duration: Number(r.headers.get("X-Audio-Duration")),
        peaks: JSON.parse(r.headers.get("X-Audio-Peaks") ?? "[]"),
        created: new Date().toISOString(),
        voice: requestedVoice,
      };
      setClips((old) => [clip, ...old]);
      setActive(clip);
      setNotice("Your audio is ready.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Generation failed. Please retry.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  function insertPause() {
    const el = input.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    setText(text.slice(0, start) + " [pause 500ms] " + text.slice(end));
    el?.focus();
  }
  function removeClip(id: string) {
    const clip = clips.find((c) => c.id === id);
    if (clip) URL.revokeObjectURL(clip.url);
    setClips((old) => old.filter((c) => c.id !== id));
    if (active?.id === id) setActive(undefined);
  }
  const choice = voices.find((v) => v.id === voice)!;
  if (auth === null)
    return (
      <main className="login">
        <AudioLines size={42} />
        <p>Opening your studio…</p>
      </main>
    );
  if (!auth)
    return (
      <main className="login">
        <div className="login-card">
          <div className="logo-icon">
            <AudioLines />
          </div>
          <h1>Welcome to your studio.</h1>
          <p>Sign in to ByteminusVoiceStudio</p>
          <form onSubmit={login}>
            <label>
              Studio password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="primary">Open studio</button>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>
            Production requires APP_ACCESS_PASSWORD and a SESSION_SECRET of at
            least 32 characters in your environment.
          </small>
        </div>
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ByteminusVoiceStudio home">
          <span className="logo-icon">
            <AudioLines size={24} />
          </span>
          <span>
            byteminus<span className="brand-sub">VOICE STUDIO</span>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {sections.map((s, i) => {
            const Icon = [Mic2, Library, FolderOpen, History, Settings2][i];
            return (
              <button
                key={s}
                className={section === s ? "nav active" : "nav"}
                onClick={() => setSection(s)}
              >
                <Icon size={19} />
                {s}
                {s === "Voice studio" && (
                  <span className="tiny-badge">NEW</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="open-card">
            <span className="open-symbol">✳</span>
            <strong>Made for everyone.</strong>
            <p>
              Open source. No subscriptions.
              <br />
              Your creativity, without limits.
            </p>
            <button
              onClick={() => {
                setSection("Settings");
                setHelp(true);
              }}
            >
              About this project <Github size={15} />
            </button>
          </div>
          <button className="help-btn" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Help & getting started
          </button>
          <div className="profile">
            <span className="avatar">B</span>
            <div>
              Personal workspace
              <small>{local ? "Local development" : "Private studio"}</small>
            </div>
            <span className="free-label">FREE</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <b>{section}</b>
          </span>
          <div className="top-actions">
            <span className="engine-pill">
              <span /> {choice.neural ? "Neural" : "Legacy"} · {choice.engine}{" "}
              {choice.neural && !engines[choice.engine] ? "· unavailable" : ""}
            </span>
            <button
              className="icon-btn"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!local && (
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setAuth(false);
                }}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div className="eyebrow">
              <span /> YOUR WORDS. A NEW VOICE.
            </div>
            <h1>
              {section === "Voice studio"
                ? "Bring your words to life."
                : section === "Voice library"
                  ? "Find your next voice."
                  : section === "Projects"
                    ? "Every story starts here."
                    : section === "History"
                      ? "Your recent creations."
                      : "A studio on your terms."}
            </h1>
            <p>
              {section === "Voice studio"
                ? "A little text. A little expression. Something worth listening to."
                : section === "Voice library"
                  ? "Neural speaker profiles for Bangla and English. Preview to find your sound."
                  : section === "Projects"
                    ? "Saved scripts, ready for your next recording. Stored on this device."
                    : section === "History"
                      ? "Audio from this session. Download anything you want to keep."
                      : "Free software, local speech, and complete control."}
            </p>
          </div>
          {error && (
            <div role="alert" className="banner error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="banner success">
              {notice}
            </div>
          )}
          {section === "Voice studio" && (
            <>
              <div className="studio-grid">
                <section className="editor panel">
                  <div className="panel-header">
                    <div className="tab-group">
                      <button
                        className={!dialogue ? "tab selected" : "tab"}
                        onClick={() => setDialogue(false)}
                      >
                        <FileText size={16} /> Text to speech
                      </button>
                      <button
                        className={dialogue ? "tab selected" : "tab"}
                        onClick={() => setDialogue(true)}
                      >
                        Dialogue <span className="subtle-tag">BETA</span>
                      </button>
                    </div>
                    <label className="import-button">
                      <Upload size={15} /> Import TXT
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 15000) {
                              setError("Import a TXT file under 15 KB.");
                              return;
                            }
                            const value = await file.text();
                            if (value.length > 3000) {
                              setError(
                                "Scripts can contain at most 3,000 characters.",
                              );
                              return;
                            }
                            setText(value);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="script-toolbar">
                    <span>
                      <span className="script-dot" />{" "}
                      {dialogue ? "DIALOGUE SCRIPT" : "YOUR SCRIPT"}
                    </span>
                    <div>
                      <button title="Insert 500ms pause" onClick={insertPause}>
                        + Add pause
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Clear script"
                        onClick={() => setText("")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {dialogue && (
                    <div className="inline-note">
                      One speaker per line: <b>Speaker: text</b>. Speaker voices
                      can be assigned below.
                    </div>
                  )}
                  <textarea
                    ref={input}
                    className="script-input"
                    aria-label="Script"
                    value={text}
                    maxLength={3000}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write something worth listening to…"
                  />
                  <div className="editor-footer">
                    <span>
                      {text.length.toLocaleString()}{" "}
                      <span className="muted">/ 3,000 characters</span>
                      <span className="divider">·</span>
                      {text.trim() ? text.trim().split(/\s+/u).length : 0} words
                    </span>
                    <button
                      onClick={() => {
                        changeLanguage(detectLanguage(text));
                        setNotice("Language detected from script.");
                      }}
                    >
                      Detect language <Sparkles size={13} />
                    </button>
                  </div>
                  <div className="editor-bottom">
                    <span>
                      <span className="key">✦</span> Tip: add{" "}
                      <code>[pause 500ms]</code> to give your words room.
                    </span>
                    <button onClick={save}>
                      <Save size={15} /> Save project
                    </button>
                  </div>
                </section>
                <section className="voice-panel panel">
                  <div className="panel-header">
                    <h2>
                      <SlidersHorizontal size={17} /> Voice settings
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEmotion("Neutral");
                        setRate(1);
                        setPitch(1);
                        setIntensity(50);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="settings-content">
                    <label>
                      Language
                      <select
                        value={language}
                        onChange={(e) => changeLanguage(e.target.value)}
                      >
                        <option value="bn">বাংলা · Bengali</option>
                        <option value="en-US">English · United States</option>
                        <option value="en-GB">English · United Kingdom</option>
                        <option value="en">
                          English · Expressive speakers
                        </option>
                      </select>
                    </label>
                    <div className="label-row">
                      <span>Voice</span>
                      <div className="gender-filter">
                        {["All", "Male", "Female"].map((g) => (
                          <button
                            className={gender === g ? "chosen" : ""}
                            key={g}
                            disabled={
                              g !== "All" &&
                              !voices.some(
                                (v) =>
                                  v.language === language &&
                                  v.gender === g &&
                                  (showLegacy || v.neural),
                              )
                            }
                            onClick={() => {
                              setGender(g);
                              const v = voices.find(
                                (v) =>
                                  v.language === language &&
                                  (g === "All" || v.gender === g),
                              );
                              if (v) setVoice(v.id as SynthesisInput["voice"]);
                            }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <select
                      aria-label="Voice"
                      value={voice}
                      onChange={(e) =>
                        setVoice(e.target.value as SynthesisInput["voice"])
                      }
                    >
                      {voices
                        .filter(
                          (v) =>
                            v.language === language &&
                            (showLegacy || v.neural || v.id === voice) &&
                            (gender === "All" || v.gender === gender),
                        )
                        .map((v) => (
                          <option
                            key={v.id}
                            value={v.id}
                            disabled={v.neural && !engines[v.engine]}
                          >
                            {v.name}
                            {v.gender === "Unspecified" ? "" : ` · ${v.gender}`}
                            {v.neural && !engines[v.engine]
                              ? " · Setup required"
                              : ""}
                          </option>
                        ))}
                    </select>
                    <div className="voice-selected">
                      <span className="voice-avatar">
                        <AudioLines size={24} />
                      </span>
                      <div>
                        <strong>{choice.name}</strong>
                        <small>
                          {choice.neural
                            ? "Neural speaker"
                            : "Synthetic variant"}{" "}
                          · {choice.accent}
                        </small>
                      </div>
                      <button
                        className="preview-btn"
                        aria-label="Preview voice"
                        disabled={busy}
                        onClick={() =>
                          generate(
                            language === "bn"
                              ? "আপনার গল্প, আপনার কণ্ঠ।"
                              : "Your story deserves to be heard.",
                          )
                        }
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    </div>
                    <div className="line" />
                    <label className="label-row">
                      <span>Emotion & delivery</span>
                      <span className="subtle-tag">
                        {choice.styleMode === "prompted"
                          ? "PROMPTED STYLE"
                          : "APPROXIMATED"}
                      </span>
                    </label>
                    <select
                      aria-label="Emotion"
                      value={emotion}
                      onChange={(e) =>
                        setEmotion(e.target.value as SynthesisInput["emotion"])
                      }
                    >
                      {emotions.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                    {choice.styleMode === "prompted" && (
                      <label className="style-label">
                        Voice direction
                        <input
                          aria-label="Voice direction"
                          value={style}
                          maxLength={300}
                          onChange={(e) => setStyle(e.target.value)}
                          placeholder="Warm, expressive storyteller with a gentle delivery"
                        />
                      </label>
                    )}
                    <label className="range-label">
                      Intensity <span>{intensity}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={intensity}
                        onChange={(e) => setIntensity(+e.target.value)}
                      />
                    </label>
                    <div className="range-ends">
                      <span>Subtle</span>
                      <span>Expressive</span>
                    </div>
                    <button
                      className="advanced-toggle"
                      onClick={() => setAdvanced(!advanced)}
                    >
                      <Settings2 size={15} /> Advanced controls{" "}
                      <span>{advanced ? "−" : "+"}</span>
                    </button>
                    {advanced && (
                      <>
                        <label className="range-label">
                          Speed <span>{rate.toFixed(2)}×</span>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={rate}
                            onChange={(e) => setRate(+e.target.value)}
                          />
                        </label>
                        <label className="range-label">
                          Pitch <span>{pitch.toFixed(2)}×</span>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={pitch}
                            onChange={(e) => setPitch(+e.target.value)}
                          />
                        </label>
                      </>
                    )}
                    <p className="capability-note">
                      {choice.styleMode === "prompted"
                        ? "Parler interprets your direction during synthesis. Emotion, intensity, speed and pitch are descriptive prompts, not exact controls. CPU generation is slower; use short sentences."
                        : choice.neural
                          ? "Neural speech. Emotion presets approximate delivery with speed and pitch; native emotional acting is not supported by this engine."
                          : "Legacy robotic speech. Choose a neural voice for more natural audio."}
                      {choice.language === "bn"
                        ? " Bengali regional accent is not verified."
                        : ""}
                    </p>
                    {choice.neural && !engines[choice.engine] && (
                      <p className="capability-note error">
                        {choice.engine} is unavailable. Run{" "}
                        <code>npm run dev:studio</code> after neural setup.
                      </p>
                    )}
                  </div>
                </section>
              </div>
              {dialogue && (
                <Dialogue
                  text={text}
                  generate={generate}
                  busy={busy}
                  defaultVoice={voice}
                />
              )}
              <div className="generation-bar panel">
                <div className="format-control">
                  <span>Export format</span>
                  <div className="segmented">
                    {(["wav", "mp3"] as const).map((f) => (
                      <button
                        key={f}
                        className={format === f ? "selected" : ""}
                        onClick={() => setFormat(f)}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <span className="format-info">
                    {format === "wav"
                      ? "Uncompressed · PCM audio"
                      : "96 kbps · Smaller file"}
                  </span>
                </div>
                <button
                  className="primary generate"
                  disabled={busy || !text.trim()}
                  onClick={() => generate()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <WandSparkles size={18} />
                  )}{" "}
                  {busy ? "Generating…" : "Generate speech"}
                  <span>
                    {busy ? "" : `${text.length.toLocaleString()} chars`}
                  </span>
                </button>
              </div>
              {busy && (
                <div role="status" className="progress">
                  <span className="spin">
                    <LoaderCircle size={16} />
                  </span>
                  {progress} {elapsed}s
                </div>
              )}
              <section className="audio-panel panel">
                <div className="panel-header">
                  <h2>
                    <AudioLines size={18} /> Audio preview
                  </h2>
                  <span className="muted">
                    {active
                      ? `${active.duration.toFixed(1)} seconds · ${active.format.toUpperCase()}`
                      : "Your next creation lives here"}
                  </span>
                </div>
                {active ? (
                  <div className="player-content">
                    <div
                      className="waveform"
                      aria-label="Generated audio amplitude waveform"
                    >
                      {active.peaks.map((p, i) => (
                        <span
                          key={i}
                          style={{ height: `${Math.max(3, p * 100)}%` }}
                        />
                      ))}
                    </div>
                    <audio
                      ref={audio}
                      key={active.id}
                      controls
                      src={active.url}
                      preload="metadata"
                    />
                    <div className="player-actions">
                      <label>
                        Playback speed
                        <select
                          aria-label="Playback speed"
                          onChange={(e) => {
                            if (audio.current)
                              audio.current.playbackRate = +e.target.value;
                          }}
                          defaultValue="1"
                        >
                          <option value="0.75">0.75×</option>
                          <option value="1">1×</option>
                          <option value="1.25">1.25×</option>
                          <option value="1.5">1.5×</option>
                        </select>
                      </label>
                      <button
                        onClick={() =>
                          download(
                            active.url,
                            `byteminus-${active.id.slice(0, 8)}.${active.format}`,
                          )
                        }
                      >
                        <Download size={15} /> Download{" "}
                        {active.format.toUpperCase()}
                      </button>
                      <button
                        onClick={() =>
                          download(
                            new Blob([srt(active.text, active.duration)], {
                              type: "text/plain;charset=utf-8",
                            }),
                            "byteminus-estimated.srt",
                          )
                        }
                      >
                        Export SRT <span className="subtle-tag">ESTIMATED</span>
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Delete audio"
                        onClick={() => removeClip(active.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="audio-empty">
                    <span className="empty-icon">
                      <AudioLines size={30} />
                    </span>
                    <h3>Let’s hear what you’ve got.</h3>
                    <p>
                      Write your script, pick a voice, and hit generate.
                      <br />
                      Your audio will appear here, ready to play and download.
                    </p>
                  </div>
                )}
              </section>
              <footer className="workspace-footer">
                <span>
                  <span className="shield">◇</span> Runs on your device. No
                  third-party speech API.
                </span>
                <span>
                  Free & open source <span>·</span> Built for your voice.
                </span>
              </footer>
            </>
          )}
          {section === "Voice library" && (
            <>
              <div className="library-filters">
                <input
                  placeholder="Search voices or accents…"
                  aria-label="Search voices"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter language"
                  value={libraryLanguage}
                  onChange={(e) => setLibraryLanguage(e.target.value)}
                >
                  <option value="all">All languages</option>
                  <option value="bn">Bengali</option>
                  <option value="en-US">English US</option>
                  <option value="en-GB">English UK</option>
                  <option value="en">English expressive</option>
                </select>
                <select
                  aria-label="Filter gender"
                  value={libraryGender}
                  onChange={(e) => setLibraryGender(e.target.value)}
                >
                  {["All", "Male", "Female", "Unspecified"].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="library-options">
                <label>
                  Engine
                  <select
                    aria-label="Filter engine"
                    value={engineFilter}
                    onChange={(e) => setEngineFilter(e.target.value)}
                  >
                    <option value="all">All engines</option>
                    <option value="mithi">Mithi · Bangla</option>
                    <option value="kokoro">Kokoro · English</option>
                    <option value="parler">Parler · English style</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showLegacy}
                    onChange={(e) => setShowLegacy(e.target.checked)}
                  />{" "}
                  Show legacy robotic voices
                </label>
                <span>{filtered.length} profiles</span>
              </div>
              <div className="voice-cards">
                {filtered.map((v) => (
                  <article className="panel voice-card" key={v.id}>
                    <span className="voice-avatar">
                      <Mic2 />
                    </span>
                    <h2>{v.name}</h2>
                    <p>
                      {v.accent}
                      {v.gender === "Unspecified" ? "" : ` · ${v.gender}`}
                    </p>
                    <code>{v.id}</code>
                    <p>
                      {v.engine} ·{" "}
                      {v.styleMode === "prompted"
                        ? "Prompted expressive delivery"
                        : v.neural
                          ? "Neural · approximated emotion"
                          : "Legacy robotic engine"}
                    </p>
                    <p>
                      {!v.neural
                        ? "Built in"
                        : engines[v.engine]
                          ? "Model files installed"
                          : "Setup required"}
                    </p>
                    <button
                      disabled={busy || (v.neural && !engines[v.engine])}
                      onClick={() => {
                        setLanguage(v.language);
                        setGender("All");
                        setVoice(v.id as SynthesisInput["voice"]);
                        setSection("Voice studio");
                        generate(
                          v.language === "bn"
                            ? "শুনুন আপনার নতুন কণ্ঠ।"
                            : "Listen to your next voice.",
                          v.id,
                        );
                      }}
                    >
                      <Play size={15} /> Preview & use voice
                    </button>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <p>No matching voices. Try another filter.</p>
              )}
            </>
          )}
          {section === "Projects" && (
            <>
              <button
                className="primary"
                onClick={() => {
                  setText("");
                  setSection("Voice studio");
                }}
              >
                <Plus size={17} /> New project
              </button>
              <div className="project-list">
                {projects.length ? (
                  projects.map((p) => (
                    <article key={p.id} className="panel project-row">
                      <FileText size={22} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {new Date(p.created).toLocaleDateString()} ·{" "}
                          {p.text.length} characters
                        </small>
                      </div>
                      <button
                        onClick={() => {
                          setText(p.text);
                          setVoice(p.voice);
                          setLanguage(
                            voices.find((v) => v.id === p.voice)?.language ??
                              "bn",
                          );
                          setGender("All");
                          setSection("Voice studio");
                        }}
                      >
                        Open
                      </button>
                      <button
                        aria-label="Delete project"
                        onClick={() => {
                          const next = projects.filter((x) => x.id !== p.id);
                          localStorage.setItem(
                            "byteminus.projects",
                            JSON.stringify(next),
                          );
                          setProjects(next);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="panel blank-state">
                    <FolderOpen size={36} />
                    <h2>A fresh page for your ideas.</h2>
                    <p>Save a script from the studio to find it here.</p>
                  </div>
                )}
              </div>
            </>
          )}
          {section === "History" && (
            <div className="project-list">
              {clips.length ? (
                clips.map((c) => (
                  <article className="panel project-row" key={c.id}>
                    <Volume2 size={22} />
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {c.duration.toFixed(1)}s · {c.format.toUpperCase()} ·{" "}
                        {c.voice}
                      </small>
                    </div>
                    <button
                      onClick={() => {
                        setActive(c);
                        setSection("Voice studio");
                      }}
                    >
                      Listen
                    </button>
                    <button
                      aria-label="Download audio"
                      onClick={() =>
                        download(
                          c.url,
                          `byteminus-${c.id.slice(0, 8)}.${c.format}`,
                        )
                      }
                    >
                      <Download size={16} />
                    </button>
                    <button
                      aria-label="Delete history item"
                      onClick={() => removeClip(c.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="panel blank-state">
                  <History size={36} />
                  <h2>Your first recording is waiting.</h2>
                  <p>
                    Generate audio in the studio. History lasts until this page
                    is closed.
                  </p>
                </div>
              )}
            </div>
          )}
          {section === "Settings" && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <h2>
                  <AudioLines size={20} /> A free, independent studio
                </h2>
                <p>
                  Neural speech runs locally through Mithi, Kokoro and Parler.
                  No paid APIs, trial credits or subscriptions. Model files are
                  downloaded once; synthesis stays on this computer.
                </p>
                <p>
                  Mithi provides 10 Bangla speaker profiles; Kokoro provides 28
                  US/UK English profiles. Parler has 34 named English speakers
                  with prompted delivery. Emotion quality varies; these are
                  model voices, not a claim that every profile is a verified
                  voice artist. Legacy eSpeak voices remain optional.
                </p>
                <div className="line" />
                <h3>This server session</h3>
                <div className="stats">
                  <div>
                    <strong>{usage.characters.toLocaleString()}</strong>
                    <span>Characters generated</span>
                  </div>
                  <div>
                    <strong>{usage.requests}</strong>
                    <span>Successful requests</span>
                  </div>
                  <div>
                    <strong>{usage.failed}</strong>
                    <span>Failed requests</span>
                  </div>
                </div>
                <small>
                  In-memory counters reset when the server restarts. No invented
                  monthly quota.
                </small>
              </section>
              <section className="panel settings-card">
                <h2>
                  <Settings2 size={20} /> Your workspace
                </h2>
                <label>
                  Appearance
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>
                <p>
                  Projects and drafts are saved in this browser. Audio stays
                  temporary; download recordings before closing the page.
                </p>
                <button
                  onClick={() =>
                    download(
                      new Blob([text], { type: "text/plain;charset=utf-8" }),
                      "byteminus-script.txt",
                    )
                  }
                >
                  <Download size={16} /> Export current script
                </button>
                <div className="line" />
                <p>
                  {local
                    ? "Local development: password bypass is enabled only outside production."
                    : "This workspace uses a signed, HttpOnly session cookie."}
                </p>
                <p>
                  Free software does not include a guarantee of free hosting,
                  electricity, or hardware. Running on your existing computer
                  avoids cloud service fees.
                </p>
              </section>
            </div>
          )}
        </main>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close icon-btn"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <span className="logo-icon">
              <AudioLines />
            </span>
            <h2 id="help-title">Your voice, your tools.</h2>
            <p>1. Write or import up to 3,000 characters.</p>
            <p>
              2. Select Bengali, English US/UK, or English expressive speakers.
              Choose a neural voice.
            </p>
            <p>3. Set delivery, choose WAV or MP3, and generate.</p>
            <p>
              Use <code>[pause 500ms]</code> or <code>[break 1.5s]</code> for
              silence up to 10 seconds. Mithi and Kokoro approximate emotion
              with prosody. Parler uses prompted style with variable results.
            </p>
            <p>
              Save projects locally. Download audio to keep it. SRT timing is
              estimated.
            </p>
            <p>
              Source code and contribution instructions are in this project’s
              README. Licensed GPL-3.0-or-later; engine dependencies retain
              their licenses.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Start creating
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Dialogue({
  text,
  generate,
  busy,
  defaultVoice,
}: {
  text: string;
  generate: (text: string, voice?: string) => Promise<void>;
  busy: boolean;
  defaultVoice: string;
}) {
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const lines = text
    .split("\n")
    .map((l) => {
      const match = /^([^:：]{1,40})[:：]\s*(.+)$/.exec(l);
      return match
        ? { speaker: match[1].trim(), text: match[2] }
        : { speaker: "Narrator", text: l };
    })
    .filter((l) => l.text.trim());
  return (
    <section className="panel dialogue-panel">
      <h2>Sentence & speaker controls</h2>
      <p>
        Generate individual lines. Each line creates a separate clip; combined
        dialogue export is planned.
      </p>
      {lines.map((l, i) => (
        <div className="dialogue-row" key={i}>
          <strong>{l.speaker}</strong>
          <span>{l.text}</span>
          <select
            aria-label={`Voice for ${l.speaker}`}
            value={assigned[l.speaker] ?? defaultVoice}
            onChange={(e) =>
              setAssigned({ ...assigned, [l.speaker]: e.target.value })
            }
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.gender}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() =>
              generate(l.text, assigned[l.speaker] ?? defaultVoice)
            }
          >
            <Play size={14} /> Generate line
          </button>
        </div>
      ))}
    </section>
  );
}
