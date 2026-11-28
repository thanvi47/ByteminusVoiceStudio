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
  Pause,
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
  synthesisKey,
  type SynthesisInput,
} from "@/lib/script";
import { previewManifestSchema, type PreviewSamples } from "@/lib/previews";
import { voiceUpdateLabel } from "@/lib/voice-updates";
import VoiceCloning from "./voice-cloning";
import VoicePlayground from "./voice-playground";
import AudioPlayer from "./audio-player";
import RecordingHistory from "./recording-history";
import { recordingTitle, MATURE_DIRECTION } from "@/lib/recording-title";
import { saveRecording, deleteRecording } from "@/lib/recording-history";
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
  subtitles: string;
  input: SynthesisInput;
  settingsTest: boolean;
};
type Project = {
  id: string;
  name: string;
  text: string;
  voice: SynthesisInput["voice"];
  created: string;
};
type Hardware = {
  device: string; backend?: string; name: string; platform?: string;
  cpuThreads: number; maxScriptCharacters?: number; reason?: string;
  validation?: string; mixedOperations?: boolean; executionMode?: string;
  renderSeconds?: number; modelCacheHit?: boolean;
};
const sample =
  "স্বাগতম ByteminusVoiceStudio-তে। আপনার ভাবনাকে কণ্ঠ দিন। [pause 500ms] আজ থেকেই শুরু হোক নতুন গল্প।";
const sections = [
  "Voice studio",
  "Voice library",
  "Projects",
  "History",
  "Settings",
  "Voice cloning",
  "Voice playground",
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
  const [outputGain, setOutputGain] = useState(1);
  const [normalizeAudio, setNormalizeAudio] = useState(true);
  const [autoDelivery, setAutoDelivery] = useState(true);
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
  const [playgroundEngine, setPlaygroundEngine] = useState("parler");
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const [engineHardware, setEngineHardware] = useState<Record<string, Hardware>>({});
  const [elapsed, setElapsed] = useState(0);
  const [previewSamples, setPreviewSamples] = useState<PreviewSamples>({});
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const sampleAudio = useRef<HTMLAudioElement>(null);
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
    fetch("/voice-previews/v1/manifest.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) =>
        setPreviewSamples(previewManifestSchema.parse(data).samples),
      )
      .catch(() => {});
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
      .then((d) => { setEngines(d.neural?.engines ?? {}); setHardware(d.neural?.hardware ?? null); setEngineHardware(d.neural?.engineHardware ?? {}); })
      .catch(() => {});
    fetch("/api/tts/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.requests !== undefined) setUsage(d);
      })
      .catch(() => {});
  }, [auth, clips]);
  useEffect(() => {
    if (!auth) return;
    const refresh = () => fetch("/api/tts/voices", { cache: "no-store" })
      .then((r) => r.json()).then((d) => {
        setHardware(d.neural?.hardware ?? null);
        setEngineHardware(d.neural?.engineHardware ?? {});
      }).catch(() => {});
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [auth]);
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
      `${v.name} ${v.accent} ${v.delivery.label}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function changeLanguage(value: string) {
    setLanguage(value);
    setGender("All");
    const selected = voices.find((v) => v.language === value && v.neural);
    if (selected) chooseVoice(selected.id);
  }
  function chooseVoice(id: string) {
    setVoice(id);
    const profile = voices.find((v) => v.id === id);
    if (autoDelivery && profile) {
      setEmotion(profile.delivery.emotion);
      setStyle(
        profile.styleMode === "prompted" ? profile.delivery.description : "",
      );
    }
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
      name: recordingTitle(text),
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
  async function generate(
    overrideText?: string,
    overrideVoice?: string,
    settingsTest = false,
  ) {
    const source = overrideText ?? text;
    if (!source.trim() || busy) return;
    setBusy(true);
    setError("");
    const requestedVoice = (overrideVoice ?? voice) as SynthesisInput["voice"];
    const requestInput = {
      text: source,
      voice: requestedVoice,
      emotion,
      intensity,
      rate,
      pitch,
      format,
      style,
      outputGain,
      normalizeAudio,
    };
    setProgress(
      voices.find((v) => v.id === requestedVoice)?.styleMode === "prompted"
        ? "Generating expressive voice in automatic sections. Long scripts can take many minutes…"
        : "Generating neural speech on the detected hardware. First use loads the model…",
    );
    try {
      const r = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestInput),
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
        name: recordingTitle(source),
        text: source,
        url: URL.createObjectURL(blob),
        format,
        duration: Number(r.headers.get("X-Audio-Duration")),
        peaks: JSON.parse(r.headers.get("X-Audio-Peaks") ?? "[]"),
        created: new Date().toISOString(),
        voice: requestedVoice,
        subtitles: srt(source, Number(r.headers.get("X-Audio-Duration"))),
        input: requestInput,
        settingsTest,
      };
      setClips((old) => [clip, ...old]);
      setActive(clip);
      setNotice(
        settingsTest
          ? "Current settings test is ready in Audio preview. Press play to listen."
          : "Your audio is ready.",
      );
      try {
        await saveRecording({ id: clip.id, title: clip.name, text: source, voice: requestedVoice, format,
          duration: clip.duration, created: clip.created, subtitles: clip.subtitles, audio: blob, source: "studio" });
      } catch { setNotice("Audio is ready, but history could not be saved. Download this recording now."); }
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
  function playSample(voiceId: string) {
    const saved = previewSamples[voiceId],
      player = sampleAudio.current;
    if (!saved || !player) return;
    if (playingSample === voiceId && !player.paused) {
      player.pause();
      setPlayingSample(null);
      return;
    }
    audio.current?.pause();
    player.pause();
    player.src = saved.url;
    setPlayingSample(voiceId);
    void player.play().catch(() => {
      setPlayingSample(null);
      setError(
        "Sample playback could not start. Click the play button to retry.",
      );
    });
  }
  function downloadSubtitles() {
    if (active)
      download(
        new Blob([active.subtitles], {
          type: "application/x-subrip;charset=utf-8",
        }),
        `${active.name}.srt`,
      );
  }
  async function removeClip(id: string) {
    try {
      await deleteRecording(id);
      const clip = clips.find((c) => c.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      setClips((old) => old.filter((c) => c.id !== id));
      if (active?.id === id) setActive(undefined);
    } catch { setError("Could not delete this recording. Please retry."); }
  }
  const currentInput = {
    text,
    voice,
    emotion,
    intensity,
    rate,
    pitch,
    format,
    style,
    outputGain,
    normalizeAudio,
  };
  const choice = voices.find((v) => v.id === voice)!;
  const activeHardware = section === "Voice cloning" ? null : engineHardware[section === "Voice playground" ? playgroundEngine : choice.engine] ?? hardware;
  const scriptLimit = choice.neural ? activeHardware?.maxScriptCharacters ?? 3000 : 3000;
  const currentResult =
    active &&
    !active.settingsTest &&
    synthesisKey(active.input) === synthesisKey(currentInput)
      ? active
      : undefined;
  const generationControls = (
    <div className="editor-actions">
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
          disabled={busy || !text.trim() || text.length > scriptLimit}
          onClick={() => generate()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <WandSparkles size={18} />
          )}{" "}
          {busy ? "Generating…" : "Generate voice + SRT"}
          <span>{busy ? "" : `${text.length.toLocaleString()} chars`}</span>
        </button>
        <div className="quick-exports">
          <button
            disabled={!currentResult || busy}
            onClick={() =>
              currentResult &&
              download(
                currentResult.url,
                `${currentResult.name}.${currentResult.format}`,
              )
            }
          >
            <Download size={16} /> Download voice
          </button>
          <button disabled={!currentResult || busy} onClick={downloadSubtitles}>
            <FileText size={16} /> Download SRT
          </button>
          <span>
            {currentResult
              ? "Ready · SRT uses estimated sentence timing"
              : "Generate first, then download your voice and SRT here."}
          </span>
        </div>
      </div>
      {active && !currentResult && (
        <p className="settings-changed" role="status">
          {active.settingsTest
            ? "Short settings test below. Generate voice + SRT to render your full script."
            : "Settings or script changed. Generate again to apply them; Audio preview still contains the previous recording."}
        </p>
      )}
      {busy && (
        <div role="status" className="progress">
          <span className="spin">
            <LoaderCircle size={16} />
          </span>
          {progress} {elapsed}s
          {elapsed >= 240 && <span> · দীর্ঘ script অংশে অংশে তৈরি হচ্ছে; CPU-তে অনেক সময় লাগতে পারে। আবার Generate চাপবেন না।</span>}
        </div>
      )}
    </div>
  );
  const audioPreview = (
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
          <h3>{active.name}</h3>
          <p className="rendered-settings">
            <strong>
              {active.settingsTest
                ? "Settings test"
                : "Generated recording"}{" "}
              · {voices.find((v) => v.id === active.voice)?.name}
            </strong>
            <br />
            {active.input.emotion}{" "}
            {voices.find((v) => v.id === active.voice)?.styleMode ===
            "prompted"
              ? "(model direction)"
              : "(speed/pitch effect)"}{" "}
            · Speed {active.input.rate.toFixed(2)}× · Pitch{" "}
            {active.input.pitch.toFixed(2)}× · Intensity{" "}
            {active.input.intensity}%
          </p>
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
          <AudioPlayer
            audioRef={audio}
            key={active.id}
            src={active.url}
            preload="metadata"
            onPlay={() => {
              sampleAudio.current?.pause();
              setPlayingSample(null);
            }}
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
                  `${active.name}.${active.format}`,
                )
              }
            >
              <Download size={15} /> Download{" "}
              {active.format.toUpperCase()}
            </button>
            <button onClick={downloadSubtitles}>
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
  );
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
      <audio
        ref={sampleAudio}
        preload="auto"
        aria-hidden="true"
        onEnded={() => setPlayingSample(null)}
        onPause={() => {
          if (sampleAudio.current?.paused) setPlayingSample(null);
        }}
      />
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
            const Icon = [
              Mic2,
              Library,
              FolderOpen,
              History,
              Settings2,
              Mic2,
              AudioLines,
            ][i];
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
            {activeHardware && <span className="engine-pill" title={[activeHardware.name, activeHardware.validation, activeHardware.executionMode, activeHardware.renderSeconds !== undefined ? `${activeHardware.renderSeconds}s · ${activeHardware.modelCacheHit ? "warm model" : "first model load"}` : "", activeHardware.reason].filter(Boolean).join(" · ")}>{activeHardware.device === "unavailable" ? "Runtime unavailable" : activeHardware.device === "cpu" ? `CPU · ${activeHardware.cpuThreads} threads` : `${(activeHardware.backend ?? activeHardware.device).toUpperCase()} · ${activeHardware.name}`}{activeHardware.mixedOperations ? " · CPU + GPU" : ""} · {activeHardware.validation === "speech generated" ? "Last render" : "Detected; render unverified"}</span>}
            <span className="engine-pill">
              <span />{" "}
              {section === "Voice playground" ? (
                "Local voice playground"
              ) : (
                <>
                  {choice.neural ? "Neural" : "Legacy"} · {choice.engine}{" "}
                  {choice.neural && !engines[choice.engine]
                    ? "· unavailable"
                    : ""}
                </>
              )}
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
          {section !== "Voice playground" && (
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
                        : section === "Voice cloning"
                          ? "Your words. Your own voice."
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
                        : section === "Voice cloning"
                          ? "Save your reference recording, then create speech in Bengali or English."
                          : "Free software, local speech, and complete control."}
              </p>
            </div>
          )}
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
          {section === "Voice cloning" && <VoiceCloning />}
          <div hidden={section !== "Voice playground"}>
            <VoicePlayground
              engines={engines}
              setupPlatform={activeHardware?.platform}
              onRuntimeChange={setPlaygroundEngine}
              scriptLimit={activeHardware?.maxScriptCharacters ?? 3000}
              runtimeLimits={Object.fromEntries(Object.entries(engineHardware).map(([key, value]) => [key, value.maxScriptCharacters ?? 3000]))}
              active={section === "Voice playground"}
              onOpenStudio={(value) => {
                setText(value.text);
                setVoice(value.voice);
                setLanguage(voices.find((v) => v.id === value.voice)!.language);
                setEmotion(value.emotion);
                setIntensity(value.intensity);
                setRate(value.rate);
                setPitch(value.pitch);
                setFormat(value.format);
                setStyle(value.style);
                setOutputGain(value.outputGain);
                setNormalizeAudio(value.normalizeAudio);
                setGender("All");
                setSection("Voice studio");
              }}
            />
          </div>
          {section === "Voice studio" && (
            <>
              <div className="studio-grid">
                <div className="editor-column">
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
                              if (value.length > scriptLimit) {
                                setError(
                                  `This runtime supports up to ${scriptLimit.toLocaleString()} script characters.`,
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
                        <button
                          title="Insert 500ms pause"
                          onClick={insertPause}
                        >
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
                        One speaker per line: <b>Speaker: text</b>. Speaker
                        voices can be assigned below.
                      </div>
                    )}
                    <textarea
                      ref={input}
                      className="script-input"
                      aria-label="Script"
                      value={text}
                      maxLength={scriptLimit}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Write something worth listening to…"
                    />
                    <div className="editor-footer">
                      <span>
                        {text.length.toLocaleString()}{" "}
                        <span className="muted">/ {scriptLimit.toLocaleString()} characters · auto sections</span>
                        <span className="divider">·</span>
                        {text.trim()
                          ? text.trim().split(/\s+/u).length
                          : 0}{" "}
                        words
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
                  {generationControls}
                  {audioPreview}
                </div>
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
                        setOutputGain(1);
                        setNormalizeAudio(true);
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
                        <option value="bn-expressive">
                          বাংলা · Bengali · Expressive
                        </option>
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
                              if (v) chooseVoice(v.id);
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
                      onChange={(e) => chooseVoice(e.target.value)}
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
                            {voiceUpdateLabel(v.id) ? ` · ${voiceUpdateLabel(v.id)}` : ""}
                            {` · ${v.delivery.label}`}
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
                        {voiceUpdateLabel(choice.id) && <span className="voice-update-badge">{voiceUpdateLabel(choice.id)}</span>}
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
                        aria-pressed={playingSample === voice}
                        title={
                          previewSamples[voice]
                            ? "Play saved neutral sample"
                            : "Saved sample is not available yet"
                        }
                        disabled={!previewSamples[voice]}
                        onClick={() => playSample(voice)}
                      >
                        {playingSample === voice ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} fill="currentColor" />
                        )}
                      </button>
                    </div>
                    <p className="sample-note">
                      <strong>
                        Suggested delivery: {choice.delivery.label}
                      </strong>
                      <br />
                      {choice.delivery.description}{" "}
                      {choice.styleMode === "prompted"
                        ? "Editable model direction; not a fixed voice trait."
                        : "Applied as a speed/pitch effect; this engine cannot act emotions."}
                    </p>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={autoDelivery}
                        onChange={(e) => setAutoDelivery(e.target.checked)}
                      />{" "}
                      Apply suggested delivery when choosing a voice
                    </label>
                    <p className="sample-note">
                      {previewSamples[voice]
                        ? `Neutral voice sample · ${previewSamples[voice].duration.toFixed(1)}s · emotion/speed/pitch এখানে বদলায় না`
                        : "Saved sample is being prepared."}
                    </p>
                    <button
                      disabled={
                        busy ||
                        !text.trim() ||
                        (choice.neural && !engines[choice.engine])
                      }
                      onClick={() => {
                        const plain = text.replace(
                          /\[(?:pause|break)[^\]]*\]/gi,
                          " ",
                        );
                        void generate(
                          sentences(plain)[0]?.slice(0, 160) ||
                            plain.slice(0, 160),
                          voice,
                          true,
                        );
                      }}
                    >
                      Test current settings
                    </button>
                    <div className="line" />
                    <label className="label-row">
                      <span>
                        {choice.styleMode === "prompted"
                          ? "Emotion & delivery"
                          : choice.neural ? "Natural delivery · emotion unavailable" : "Delivery effect · speed/pitch only"}
                      </span>
                      <span className="subtle-tag">
                        {choice.styleMode === "prompted"
                          ? "PROMPTED STYLE"
                          : "NO EMOTION MODEL"}
                      </span>
                    </label>
                    <select
                      aria-label="Emotion"
                      value={choice.neural && choice.styleMode !== "prompted" ? "Neutral" : emotion}
                      disabled={choice.neural && choice.styleMode !== "prompted"}
                      onChange={(e) => {
                        const next = e.target.value as SynthesisInput["emotion"];
                        setEmotion(next);
                        if (choice.styleMode === "prompted" && (next === "Excited" || next === "Scared")) {
                          setStyle("");
                          setRate(1);
                          setPitch(1);
                        }
                      }}
                    >
                      {emotions.map((e) => (
                        <option key={e} value={e}>{e === "Scared" ? "Scared / Scary" : e}</option>
                      ))}
                    </select>
                    {choice.styleMode === "prompted" && (
                      <label className="style-label">
                        Voice direction
                        <button type="button" onClick={() => setStyle(MATURE_DIRECTION)}>Mature · Warm &amp; confident</button>
                        <textarea
                          aria-label="Voice direction"
                          value={style}
                          rows={4}
                          maxLength={1200}
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
                        disabled={choice.neural && choice.styleMode !== "prompted"}
                        onChange={(e) => setIntensity(+e.target.value)}
                      />
                    </label>
                    <div className="range-ends">
                      <span>0% Off · 1–34% Subtle</span>
                      <span>Expressive</span>
                    </div>
                    <label className="range-label">
                      Output volume <span>{Math.round(outputGain * 100)}%</span>
                      <input
                        aria-label="Output volume"
                        type="range"
                        min="0"
                        max="3"
                        step="0.05"
                        value={outputGain}
                        onChange={(e) => setOutputGain(+e.target.value)}
                      />
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={normalizeAudio}
                        onChange={(e) => setNormalizeAudio(e.target.checked)}
                      />{" "}
                      Auto loudness for quiet speech
                    </label>
                    <p className="sample-note">
                      Output volume applies to the next generated download.
                      Playback volume below the player changes immediately.
                    </p>
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
                        ? "Emotion and intensity guide the expressive model; exact acting varies. Speed and pitch sliders are applied to the generated speech. CPU generation is slower; use short sentences."
                        : choice.neural
                          ? "Emotion is unavailable on this natural engine. Automatic pitch/speed effects are disabled to preserve voice quality. For natural sound keep manual speed and pitch at 1.00. Choose an expressive engine for emotion."
                          : "Legacy robotic speech. Choose a neural voice for more natural audio."}
                      {choice.language === "bn"
                        ? " Bengali regional accent is not verified."
                        : ""}
                    </p>
                    {choice.language === "bn" && choice.engine === "mithi" && (
                      <p className="capability-note">
                        বাংলায় emotional acting-এর জন্য Indic Parler দরকার।{" "}
                        <a
                          href="https://huggingface.co/ai4bharat/indic-parler-tts"
                          target="_blank"
                          rel="noreferrer"
                        >
                          ফ্রি model access নিন
                        </a>
                        ; তারপর Bengali · Expressive নির্বাচন করুন।
                      </p>
                    )}
                    {choice.neural && !engines[choice.engine] && (
                      <p className="capability-note error">
                        {choice.engine === "indic" ? <>
                          Bengali expressive requires a separate Indic model download. Base setup does not install it. Accept access on{" "}
                          <a href="https://huggingface.co/ai4bharat/indic-parler-tts" target="_blank" rel="noreferrer">Hugging Face</a>, log in using <code>{activeHardware?.platform && activeHardware.platform !== "win32" ? ".venv/bin/hf auth login" : ".venv/Scripts/hf.exe auth login"}</code>, then run <code>{activeHardware?.platform && activeHardware.platform !== "win32" ? "bash scripts/setup.sh --bengali-expressive" : "./scripts/setup-bengali-expressive.ps1"}</code>. Restart the studio after setup. For ordinary Bengali speech, select Bengali · Mithi.
                        </> : <>{choice.engine} is unavailable. Run <code>npm run dev:studio</code> after neural setup.</>}
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
                    {voiceUpdateLabel(v.id) && <span className="voice-update-badge">{voiceUpdateLabel(v.id)}</span>}
                    <p>
                      Suggested: {v.delivery.label} · {v.delivery.description}
                    </p>
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
                          ? "Neural · natural delivery"
                          : "Legacy robotic engine"}
                    </p>
                    <p>
                      {!v.neural
                        ? "Built in"
                        : engines[v.engine]
                          ? "Model files installed"
                          : "Setup required"}
                    </p>
                    <div className="voice-card-actions">
                      <button
                        disabled={!previewSamples[v.id]}
                        aria-pressed={playingSample === v.id}
                        onClick={() => playSample(v.id)}
                      >
                        {playingSample === v.id ? (
                          <Pause size={15} />
                        ) : (
                          <Play size={15} />
                        )}{" "}
                        {playingSample === v.id
                          ? "Pause sample"
                          : "Listen to sample"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setLanguage(v.language);
                          setGender("All");
                          chooseVoice(v.id);
                          setSection("Voice studio");
                        }}
                      >
                        Use voice
                      </button>
                    </div>
                    <p>
                      {previewSamples[v.id]
                        ? `Saved neutral sample · ${previewSamples[v.id].duration.toFixed(1)} seconds`
                        : "No saved sample yet"}
                    </p>
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
          {section === "History" && <RecordingHistory />}
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
            <p>1. Write or import a script within the hardware limit shown in the editor.</p>
            <p>
              2. Select Bengali, English US/UK, or English expressive speakers.
              Choose a neural voice.
            </p>
            <p>3. Set delivery, choose WAV or MP3, and generate.</p>
            <p>
              Use <code>[pause 500ms]</code> or <code>[break 1.5s]</code> for
              silence up to 10 seconds. Mithi and Kokoro use natural delivery;
              emotion effects are disabled. Parler uses prompted style with variable results.
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
                {v.name}{voiceUpdateLabel(v.id) ? ` · ${voiceUpdateLabel(v.id)}` : ""} · {v.delivery.label} · {v.gender}
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
