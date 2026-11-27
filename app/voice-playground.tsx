"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Code2,
  Copy,
  Download,
  LoaderCircle,
  Play,
  Save,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import {
  emotions,
  inputSchema,
  srt,
  synthesisKey,
  voices,
  type SynthesisInput,
} from "@/lib/script";
import {
  compileDirections,
  demoScripts,
  developerSnippet,
  directionFields,
  directionsForEmotion,
  recipeSchema,
  requestForRecipe,
  vibes,
  type Directions,
  type Recipe,
} from "@/lib/director";
import { previewManifestSchema, type PreviewSamples } from "@/lib/previews";
import AudioPlayer from "./audio-player";
import { voiceUpdateLabel } from "@/lib/voice-updates";
type Take = {
  id: string;
  input: SynthesisInput;
  vibe: string;
  url: string;
  duration: number;
  subtitles: string;
};
const initialInput = inputSchema.parse({
  text: demoScripts.find((demo) => demo.id === "welcome")!.text,
  voice: "parler:Lea",
  emotion: "Neutral",
});
function file(data: string | Blob, name: string, type = "application/json") {
  const url = URL.createObjectURL(
    typeof data === "string" ? new Blob([data], { type }) : data,
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function VoicePlayground({
  engines,
  onOpenStudio,
  active,
}: {
  engines: Record<string, boolean>;
  onOpenStudio: (input: SynthesisInput) => void;
  active: boolean;
}) {
  const [input, setInput] = useState<SynthesisInput>(initialInput);
  const [directions, setDirections] = useState<Directions>({
    ...vibes[0].directions,
  });
  const [vibeId, setVibeId] = useState("natural"),
    [shown, setShown] = useState(vibes.slice(0, 6).map((v) => v.id));
  const [samples, setSamples] = useState<PreviewSamples>({}),
    [playing, setPlaying] = useState("");
  const [takes, setTakes] = useState<Take[]>([]),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Recipe[]>([]),
    [recipeName, setRecipeName] = useState("My voice recipe");
  const [code, setCode] = useState(false),
    [codeLanguage, setCodeLanguage] = useState<
      "JavaScript" | "Python" | "cURL"
    >("JavaScript");
  const [voicePage, setVoicePage] = useState(0);
  const [autoDelivery, setAutoDelivery] = useState(true);
  const samplePlayer = useRef<HTMLAudioElement>(null),
    players = useRef<(HTMLAudioElement | null)[]>([]),
    takeRef = useRef<Take[]>([]);
  const abort = useRef<AbortController | null>(null),
    requestBusy = useRef(false);
  const selected = voices.find((v) => v.id === input.voice)!;
  const group =
    selected.engine === "indic"
      ? "indic"
      : selected.engine === "mithi"
        ? "mithi"
        : selected.engine === "kokoro"
          ? "kokoro"
          : "parler";
  const available = voices.filter((v) => v.engine === group);
  const request = {
    ...input,
    style:
      selected.styleMode === "prompted" ? compileDirections(directions) : "",
  };
  const currentVibe =
    vibes.find((v) => v.id === vibeId)?.name ?? "Custom direction";
  const valid = inputSchema.safeParse(request);
  const canGenerate = Boolean(valid.success && engines[group] && !busy);
  useEffect(() => {
    fetch("/voice-previews/v1/manifest.json")
      .then((r) => r.json())
      .then((d) => setSamples(previewManifestSchema.parse(d).samples))
      .catch(() => {});
    try {
      const recipes = JSON.parse(
        localStorage.getItem("byteminus.playground-recipes") ?? "[]",
      );
      if (Array.isArray(recipes))
        setSaved(
          recipes.slice(0, 20).flatMap((r) => {
            const p = recipeSchema.safeParse(r);
            return p.success ? [p.data] : [];
          }),
        );
    } catch {}
    return () => {
      abort.current?.abort();
      takeRef.current.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, []);
  useEffect(() => {
    takeRef.current = takes;
  }, [takes]);
  useEffect(() => {
    if (!active) stopOther();
  }, [active]);
  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  function patch(value: Partial<SynthesisInput>) {
    setInput((old) => ({ ...old, ...value }));
  }
  function stopOther(index = -1) {
    samplePlayer.current?.pause();
    setPlaying("");
    players.current.forEach((p, i) => {
      if (i !== index) p?.pause();
    });
  }
  function preview(id: string) {
    const p = samplePlayer.current,
      s = samples[id];
    if (!p || !s) return;
    if (playing === id && !p.paused) {
      p.pause();
      setPlaying("");
      return;
    }
    stopOther();
    p.src = s.url;
    setPlaying(id);
    void p.play().catch(() => {
      setPlaying("");
      setError("Click the sample button again to start playback.");
    });
  }
  function pickVoice(id: string) {
    const profile = voices.find((v) => v.id === id);
    patch({ voice: id });
    if (autoDelivery && profile) {
      const match =
        vibes.find((v) => v.emotion === profile.delivery.emotion) ?? vibes[0];
      setVibeId(match.id);
      setDirections({ ...match.directions });
      patch({ emotion: profile.delivery.emotion });
    }
    setVoicePage(
      Math.floor(
        voices
          .filter((v) => v.engine === profile?.engine)
          .findIndex((v) => v.id === id) / 6,
      ),
    );
  }
  function pickGroup(value: string) {
    const first = voices.find((v) => v.engine === value);
    if (first) pickVoice(first.id);
  }
  function pickVibe(id: string) {
    const v = vibes.find((v) => v.id === id)!;
    setVibeId(id);
    setDirections({ ...v.directions });
    patch({ emotion: v.emotion });
    if (v.emotion === "Excited" || v.emotion === "Scared")
      patch({ rate: 1, pitch: 1, intensity: 70 });
  }
  function shuffled<T>(items: T[]) {
    return items
      .map((item) => ({ item, n: Math.random() }))
      .sort((a, b) => a.n - b.n)
      .map((x) => x.item);
  }
  function recipe(): Recipe {
    return recipeSchema.parse({
      version: 1,
      name: recipeName,
      input: request,
      directions,
    });
  }
  function persist(next: Recipe[]) {
    try {
      localStorage.setItem(
        "byteminus.playground-recipes",
        JSON.stringify(next),
      );
      setSaved(next);
    } catch {
      setError("Device storage is full. Export your recipe instead.");
    }
  }
  function restore(r: Recipe) {
    setInput(requestForRecipe(r));
    setDirections({ ...r.directions });
    setRecipeName(r.name);
    setVibeId("custom");
    setVoicePage(0);
    setNotice("Recipe loaded. Your existing recordings are unchanged.");
  }
  function saveRecipe() {
    try {
      const r = recipe();
      persist([r, ...saved.filter((s) => s.name !== r.name)].slice(0, 20));
      setNotice("Recipe saved on this device.");
    } catch {
      setError("Check the script, voice and recipe name before saving.");
    }
  }
  async function importRecipe(f?: File) {
    if (!f) return;
    setError("");
    try {
      if (f.size > 30000) throw new Error();
      restore(recipeSchema.parse(JSON.parse(await f.text())));
    } catch {
      setError("Use a valid Byteminus voice recipe JSON under 30 KB.");
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Clipboard is unavailable. Download the JSON file instead.");
    }
  }
  async function generate() {
    if (!canGenerate || requestBusy.current) return;
    requestBusy.current = true;
    setBusy(true);
    setError("");
    stopOther();
    const snapshot = inputSchema.parse(request),
      name = currentVibe;
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        signal: controller.signal,
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error?.message ?? "Generation failed.");
      }
      const blob = await r.blob(),
        duration = Number(r.headers.get("X-Audio-Duration"));
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error("Invalid audio duration.");
      const take: Take = {
        id: crypto.randomUUID(),
        input: snapshot,
        vibe: name,
        url: URL.createObjectURL(blob),
        duration,
        subtitles: srt(snapshot.text, duration),
      };
      setTakes((old) => {
        old.slice(1).forEach((t) => URL.revokeObjectURL(t.url));
        return [take, ...old.slice(0, 1)];
      });
      setNotice(
        "Recording ready. Press play below; your previous take stays available for comparison.",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      requestBusy.current = false;
      setBusy(false);
      abort.current = null;
    }
  }
  return (
    <div className="playground">
      <audio
        ref={samplePlayer}
        onEnded={() => setPlaying("")}
        onError={() => {
          setPlaying("");
          setError("That saved sample could not be loaded.");
        }}
      />
      <div className="director-intro">
        <span className="director-kicker">BYTEMINUS / VOICE PLAYGROUND</span>
        <h1>
          A voice. A mood.
          <br />
          <em>Your story.</em>
        </h1>
        <p>
          Shape a performance, keep what works, and compare your next take.
          Local voices. No paid speech API.
        </p>
        <div className="director-tags">
          <span>Editable direction</span>
          <span>12 original vibes</span>
          <span>A/B recordings</span>
        </div>
      </div>
      {error && (
        <div role="alert" className="banner error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div role="status" className="banner success">
          {notice}
        </div>
      )}
      <div className="director-grid">
        <section className="director-card director-voices">
          <div className="director-title">
            <h3>
              <AudioLines size={18} /> Voice
            </h3>
            <button
              disabled={busy || !engines[group]}
              onClick={() =>
                pickVoice(
                  shuffled(available.filter((v) => v.id !== input.voice))[0]
                    ?.id ?? input.voice,
                )
              }
            >
              <Shuffle size={14} /> Surprise me
            </button>
          </div>
          <label className="director-label">
            Voice engine
            <select
              value={group}
              disabled={busy}
              onChange={(e) => pickGroup(e.target.value)}
            >
              <option value="parler">English · Expressive · Parler</option>
              <option value="kokoro">English · Natural · Kokoro</option>
              <option value="mithi">বাংলা · Natural · Mithi</option>
              <option value="indic">বাংলা · Expressive · Indic Parler</option>
            </select>
          </label>
          <div className="director-voice-grid">
            {available.slice(voicePage * 6, voicePage * 6 + 6).map((v, i) => (
              <div
                key={v.id}
                className={`director-voice ${input.voice === v.id ? "is-selected" : ""}`}
              >
                <button
                  className="director-select-voice"
                  aria-pressed={input.voice === v.id}
                  disabled={busy}
                  onClick={() => pickVoice(v.id)}
                >
                  <span className={`voice-orb orb-${i % 4}`}>
                    {v.name.slice(0, 1)}
                  </span>
                  <strong>{v.name.split(" · ")[0]}</strong>
                  {voiceUpdateLabel(v.id) && <span className="voice-update-badge">{voiceUpdateLabel(v.id)}</span>}
                  <small>Suggested: {v.delivery.label}</small>
                </button>
                <button
                  className="director-sample"
                  aria-label={`Play neutral sample ${v.name}`}
                  aria-pressed={playing === v.id}
                  disabled={!samples[v.id]}
                  onClick={() => preview(v.id)}
                >
                  <Play size={13} /> {playing === v.id ? "Playing…" : "Sample"}
                </button>
              </div>
            ))}
          </div>
          <div className="director-pagination">
            <span>{available.length} model speaker profiles</span>
            <button
              disabled={voicePage === 0}
              onClick={() => setVoicePage((v) => v - 1)}
            >
              Previous
            </button>
            <button
              disabled={(voicePage + 1) * 6 >= available.length}
              onClick={() => setVoicePage((v) => v + 1)}
            >
              Next
            </button>
          </div>
          <label className="director-label">
            Selected voice
            <select
              aria-label="Playground voice"
              value={input.voice}
              disabled={busy}
              onChange={(e) => pickVoice(e.target.value)}
            >
              {available.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{voiceUpdateLabel(v.id) ? ` · ${voiceUpdateLabel(v.id)}` : ""} · {v.delivery.label}
                </option>
              ))}
            </select>
          </label>
          <p className="director-note">
            ✓ TESTED = এই profile দিয়ে Excited ও Scared নমুনা তৈরি করে পরীক্ষা হয়েছে।
            ★ UPDATED = একই emotion আপডেট পেয়েছে; আলাদা নমুনা পরীক্ষা হয়নি।
          </p>
          <p className="director-note">
            <strong>Suggested delivery: {selected.delivery.label}</strong> ·{" "}
            {selected.delivery.description} These are editable suggestions, not
            fixed voice traits.
          </p>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={autoDelivery}
              onChange={(e) => setAutoDelivery(e.target.checked)}
            />{" "}
            Apply suggested delivery when choosing a voice
          </label>
          <p className="director-note">
            Sample buttons play a saved neutral recording. Vibes and settings
            apply when you generate a new take. These are our local model
            profiles, not OpenAI voices.
          </p>
          {!engines[group] && (
            <p className="director-warning">
              This engine is unavailable.{" "}
              {group === "indic"
                ? "Free Hugging Face model access and Bengali expressive setup are required."
                : "Start the local neural service after setup."}
            </p>
          )}
        </section>
        <section className="director-card director-vibes">
          <div className="director-title">
            <h3>
              <WandIcon /> Vibe
            </h3>
            <button
              onClick={() =>
                setShown(
                  shuffled(vibes)
                    .slice(0, 6)
                    .map((v) => v.id),
                )
              }
            >
              <Shuffle size={14} /> More vibes
            </button>
          </div>
          <div className="vibe-grid">
            {shown.map((id) => {
              const v = vibes.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  aria-pressed={vibeId === id}
                  disabled={selected.styleMode !== "prompted"}
                  className={
                    vibeId === id ? "vibe-tile is-selected" : "vibe-tile"
                  }
                  onClick={() => pickVibe(id)}
                >
                  <strong>{v.name}</strong>
                  <span>{v.summary}</span>
                </button>
              );
            })}
          </div>
          {selected.styleMode !== "prompted" ? (
            <p className="director-warning">
              এই ইঞ্জিনে emotion বন্ধ রাখা হয়েছে, যাতে কৃত্রিম pitch/speed effect-এ শব্দ বিকৃত না হয়।
              Natural voice only. Choose an expressive engine for vibes and emotion.
            </p>
          ) : (
            <p className="director-note">
              Direction guides the model; emotional acting, accents and
              whispering vary by model. Selecting a vibe keeps your script.
            </p>
          )}
          <details className="direction-editor" open>
            <summary>
              Direct the performance{" "}
              <span>{vibeId === "custom" ? "CUSTOM" : currentVibe}</span>
            </summary>
            <fieldset disabled={selected.styleMode !== "prompted"}>
              <div className="direction-fields">
                {directionFields.map((key) => (
                  <label key={key}>
                    {key}
                    <textarea
                      aria-label={`Direction ${key}`}
                      rows={2}
                      maxLength={140}
                      value={directions[key]}
                      onChange={(e) => {
                        setVibeId("custom");
                        setDirections((old) => ({
                          ...old,
                          [key]: e.target.value,
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </details>
        </section>
        <section className="director-card director-script">
          <div className="director-title">
            <h3>Script</h3>
            <select
              aria-label="Example script"
              defaultValue=""
              onChange={(e) => {
                const demo = demoScripts.find((d) => d.id === e.target.value);
                if (demo) {
                  patch({ text: demo.text });
                  if (demo.emotion) {
                    patch({ voice: demo.language === "bn" ? "indic:Arjun" : "parler:Jon", emotion: demo.emotion, rate: 1, pitch: 1, intensity: 70 });
                    setVoicePage(0);
                    const v = directionsForEmotion(demo.emotion)!;
                    setVibeId(v.id);
                    setDirections({ ...v.directions });
                  }
                }
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Try an example…
              </option>
              {demoScripts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            aria-label="Playground script"
            className="director-script-input"
            maxLength={selected.styleMode === "prompted" ? 600 : 3000}
            rows={6}
            value={input.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
          <div className="director-script-meta">
            <span>
              {input.text.length} /{" "}
              {selected.styleMode === "prompted" ? 600 : 3000} characters
            </span>
            <button
              disabled={
                input.text.length + 14 >
                (selected.styleMode === "prompted" ? 600 : 3000)
              }
              onClick={() => patch({ text: input.text + " [pause 500ms] " })}
            >
              Add 500ms pause
            </button>
          </div>
          <div className="director-controls">
            <label>
              Emotion / delivery
              <select
                value={selected.styleMode === "prompted" ? input.emotion : "Neutral"}
                disabled={selected.styleMode !== "prompted"}
                onChange={(e) => {
                  const emotion = e.target.value as SynthesisInput["emotion"];
                  patch({
                    emotion,
                  });
                  if (emotion === "Excited" || emotion === "Scared") {
                    const v = directionsForEmotion(emotion)!;
                    setDirections({ ...v.directions });
                    setVibeId(v.id);
                    patch({ rate: 1, pitch: 1, intensity: 70 });
                    return;
                  }
                  setDirections((old) => ({
                    ...old,
                    Emotion: `${e.target.value}, conveyed naturally without exaggeration.`,
                  }));
                  setVibeId("custom");
                }}
              >
                {emotions.map((e) => (
                  <option key={e} value={e}>{e === "Scared" ? "Scared / Scary" : e}</option>
                ))}
              </select>
            </label>
            <label>
              Intensity {input.intensity}%
              <input
                type="range"
                min="0"
                max="100"
                value={input.intensity}
                disabled={selected.styleMode !== "prompted"}
                onChange={(e) => patch({ intensity: +e.target.value })}
              />
            </label>
            <label>
              Speed {input.rate.toFixed(2)}×
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={input.rate}
                onChange={(e) => patch({ rate: +e.target.value })}
              />
            </label>
            <label>
              Pitch {input.pitch.toFixed(2)}×
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={input.pitch}
                onChange={(e) => patch({ pitch: +e.target.value })}
              />
            </label>
            <label>
              Export
              <select
                value={input.format}
                onChange={(e) =>
                  patch({ format: e.target.value as "wav" | "mp3" })
                }
              >
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </label>
          </div>
          {!valid.success && (
            <p role="alert" className="director-warning">
              {valid.error.issues[0]?.message}
            </p>
          )}
          <div className="director-generate">
            <label className="output-volume-control">
              Output volume {Math.round(input.outputGain * 100)}%
              <input
                aria-label="Output volume"
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={input.outputGain}
                onChange={(e) => patch({ outputGain: +e.target.value })}
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={input.normalizeAudio}
                onChange={(e) => patch({ normalizeAudio: e.target.checked })}
              />{" "}
              Auto loudness for quiet speech
            </label>
            <button
              className="primary"
              disabled={!canGenerate}
              onClick={() => void generate()}
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <AudioLines size={18} />
              )}{" "}
              {busy ? `Generating… ${seconds}s` : "Generate a take"}
            </button>
            <button onClick={() => onOpenStudio(request)}>
              Open in Voice studio
            </button>
            <button onClick={() => setCode((v) => !v)} aria-expanded={code}>
              <Code2 size={16} /> Developer view
            </button>
          </div>
          <p className="director-note">
            CPU generation can take several minutes. Each completed take
            includes audio and estimated sentence-level SRT.
          </p>
        </section>
      </div>
      <section className="director-card director-recipes">
        <div>
          <h3>Keep your best direction</h3>
          <p>Save on this device, or share an editable recipe file.</p>
        </div>
        <label>
          Recipe name
          <input
            maxLength={60}
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
          />
        </label>
        <button
          disabled={!valid.success || !recipeName.trim()}
          onClick={saveRecipe}
        >
          <Save size={15} /> Save preset
        </button>
        <button
          disabled={!valid.success || !recipeName.trim()}
          onClick={() =>
            file(
              JSON.stringify(recipe(), null, 2),
              "byteminus-voice-recipe.json",
            )
          }
        >
          <Download size={15} /> Share recipe
        </button>
        <label className="director-import">
          <Upload size={15} /> Import recipe
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void importRecipe(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {saved.length > 0 && (
          <div className="saved-recipes">
            {saved.map((r, i) => (
              <div key={i}>
                <button onClick={() => restore(r)}>{r.name}</button>
                <button
                  aria-label={`Delete preset ${r.name}`}
                  onClick={() =>
                    persist(saved.filter((_, index) => index !== i))
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {code && (
        <section className="director-card director-code">
          <div className="director-title">
            <h3>Build with your local studio</h3>
            <div>
              {(["JavaScript", "Python", "cURL"] as const).map((lang) => (
                <button
                  key={lang}
                  aria-pressed={codeLanguage === lang}
                  onClick={() => setCodeLanguage(lang)}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <pre>
            <code>{developerSnippet(request, codeLanguage)}</code>
          </pre>
          <div className="director-code-actions">
            <button
              onClick={() => void copy(developerSnippet(request, codeLanguage))}
            >
              <Copy size={14} /> Copy code
            </button>
            <button
              disabled={!valid.success}
              onClick={() =>
                file(JSON.stringify(request, null, 2), "request.json")
              }
            >
              <Download size={14} /> Request JSON
            </button>
          </div>
          <p className="director-note">
            Uses your existing local API. Protected deployments need their
            normal session authentication. No API keys are embedded.
          </p>
        </section>
      )}
      <section className="director-comparison">
        <div className="director-title">
          <h3>Listen. Compare. Refine.</h3>
          <span>The latest two recordings stay here during this session.</span>
        </div>
        <div className="take-grid">
          {takes.length ? (
            takes.map((t, i) => (
              <article className="director-card take-card" key={t.id}>
                <div className="director-title">
                  <strong>
                    {i === 0 ? "A · Latest take" : "B · Previous take"}
                  </strong>
                  <span>{t.duration.toFixed(1)}s</span>
                </div>
                <h4>{voices.find((v) => v.id === t.input.voice)?.name}</h4>
                <p>
                  {t.vibe} · {t.input.emotion} · {t.input.rate.toFixed(2)}×
                  speed · {t.input.pitch.toFixed(2)}× pitch
                </p>
                <AudioPlayer
                  audioRef={(el) => {
                    players.current[i] = el;
                  }}
                  src={t.url}
                  onPlay={() => stopOther(i)}
                />
                <div className="director-take-actions">
                  <button
                    aria-label={`Play take ${i === 0 ? "A" : "B"}`}
                    onClick={() => {
                      const player = players.current[i];
                      if (player) {
                        stopOther(i);
                        void player
                          .play()
                          .catch(() =>
                            setError(
                              "Click play on the audio player to retry.",
                            ),
                          );
                      }
                    }}
                  >
                    <Play size={14} /> Play
                  </button>
                  <a
                    className="button"
                    href={t.url}
                    download={`byteminus-take-${t.id.slice(0, 8)}.${t.input.format}`}
                  >
                    <Download size={14} /> Audio
                  </a>
                  <button
                    onClick={() =>
                      file(
                        t.subtitles,
                        `byteminus-take-${t.id.slice(0, 8)}-estimated.srt`,
                        "application/x-subrip;charset=utf-8",
                      )
                    }
                  >
                    SRT
                  </button>
                  <button
                    onClick={() => {
                      setInput(t.input);
                      setNotice(
                        "Recording settings restored. Vibe directions are available in the request snapshot below.",
                      );
                      const fields = { ...directions };
                      for (const key of directionFields) {
                        const line = t.input.style
                          .split("\n")
                          .find((l) => l.startsWith(key + ":"));
                        fields[key] = line?.slice(key.length + 1).trim() ?? "";
                      }
                      setDirections(fields);
                      setVibeId("custom");
                    }}
                  >
                    Reuse settings
                  </button>
                </div>
                <details>
                  <summary>Script and direction used</summary>
                  <pre>{t.input.text + "\n\n" + t.input.style}</pre>
                </details>
                {synthesisKey(t.input) !== synthesisKey(request) && (
                  <p className="director-note">
                    These controls have changed since this take. Generate again
                    to apply them.
                  </p>
                )}
              </article>
            ))
          ) : (
            <div className="director-empty">
              <AudioLines size={30} />
              <h4>Your first take starts here.</h4>
              <p>
                Pick a voice, shape the vibe, and generate. Make a second take
                to compare them side by side.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function WandIcon() {
  return <span aria-hidden="true">✦</span>;
}
