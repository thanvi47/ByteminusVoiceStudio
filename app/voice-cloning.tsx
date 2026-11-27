"use client";
import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, Mic2, Trash2, Upload } from "lucide-react";
import { srt } from "@/lib/script";
import type { CloneProfile } from "@/lib/clone";
import { cloneFormIssues } from "@/lib/clone-form";
import AudioPlayer from "./audio-player";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function referenceWav(buffer: AudioBuffer, start: number, end: number) {
  const size = Math.round((end - start) * 24000);
  const ctx = new OfflineAudioContext(1, size, 24000);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0, start, end - start);
  const rendered = await ctx.startRendering();
  const samples = rendered.getChannelData(0);
  const bytes = new Uint8Array(44 + size * 2);
  const view = new DataView(bytes.buffer);
  const word = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
  };
  word(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  word(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 48000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, size * 2, true);
  samples.forEach((v, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, v)) * 32767),
      true,
    ),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    base64: btoa(binary),
    blob: new Blob([bytes], { type: "audio/wav" }),
  };
}
export default function VoiceCloning() {
  const [profiles, setProfiles] = useState<CloneProfile[]>([]),
    [installed, setInstalled] = useState(false);
  const [buffer, setBuffer] = useState<AudioBuffer>(),
    [fileName, setFileName] = useState("");
  const [start, setStart] = useState(0),
    [end, setEnd] = useState(8),
    [name, setName] = useState("My voice"),
    [transcript, setTranscript] = useState("");
  const [consent, setConsent] = useState(false),
    [selected, setSelected] = useState("");
  const [text, setText] = useState(""),
    [language, setLanguage] = useState<"bn" | "en">("bn"),
    [format, setFormat] = useState<"wav" | "mp3">("wav");
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [transcribing, setTranscribing] = useState(false),
    [referenceLanguage, setReferenceLanguage] = useState<"bn" | "en">("bn"),
    [notice, setNotice] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState("");
  const [outputGain, setOutputGain] = useState(1),
    [normalizeAudio, setNormalizeAudio] = useState(true);
  const [preview, setPreview] = useState(""),
    [result, setResult] = useState<{
      url: string;
      blob: Blob;
      subtitles: string;
      format: string;
      duration: number;
      profile: string;
    }>();
  const previewRef = useRef(""),
    resultRef = useRef("");
  const requestVersion = useRef(0);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  async function refresh() {
    const r = await fetch("/api/clones", { cache: "no-store" });
    if (!r.ok) throw new Error("Unable to load saved voices.");
    const data = await r.json();
    setProfiles(data.profiles);
    setInstalled(data.installed);
    setSelected((old) =>
      data.profiles.some((p: CloneProfile) => p.id === old)
        ? old
        : (data.profiles[0]?.id ?? ""),
    );
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    return () => {
      requestVersion.current++;
      URL.revokeObjectURL(previewRef.current);
      URL.revokeObjectURL(resultRef.current);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  async function load(file?: File) {
    if (!file) return;
    const version = ++requestVersion.current;
    setError("");
    setNotice("");
    setBuffer(undefined);
    setPreview("");
    setTranscript("");
    URL.revokeObjectURL(previewRef.current);
    if (file.size > 20 * 1024 * 1024) {
      setError("Use an MP3 or WAV under 20 MB.");
      return;
    }
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      if (version !== requestVersion.current) return;
      if (decoded.duration < 3 || decoded.duration > 120)
        throw new Error(
          "Upload 3–120 seconds of speech; 30 seconds is ideal for choosing a clean part.",
        );
      setBuffer(decoded);
      setFileName(file.name);
      setStart(0);
      setEnd(Math.min(8, decoded.duration));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This audio could not be decoded.",
      );
    } finally {
      await ctx.close();
    }
  }
  async function makePreview() {
    if (!buffer) return;
    try {
      const wav = await referenceWav(buffer, start, end);
      URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(wav.blob);
      previewRef.current = url;
      setPreview(url);
    } catch {
      setError("Check the selected start and end times.");
    }
  }
  const valid = Boolean(
    buffer &&
    start >= 0 &&
    end <= buffer.duration &&
    end - start >= 3 &&
    end - start <= 10,
  );
  const issues = cloneFormIssues({ hasAudio: Boolean(buffer), validRange: valid, name, transcript, consent });
  const locked = saving || busy || transcribing;
  async function transcribe() {
    if (!buffer || !valid || locked) return;
    if (!consent) { setError("আগে নিজের কণ্ঠ বা অনুমতি থাকার ঘরে টিক দিন। Confirm voice permission first."); return; }
    const version = ++requestVersion.current;
    setTranscribing(true);
    setError("");
    setNotice("");
    try {
      const wav = await referenceWav(buffer, start, end);
      const r = await fetch("/api/clones/transcribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: wav.base64, language: referenceLanguage, consent }),
      });
      const data = await r.json();
      if (version !== requestVersion.current) return;
      if (!r.ok) throw new Error(data.error?.message ?? "Transcription failed.");
      setTranscript(data.text);
      setNotice("কথাগুলো লেখা হয়েছে। নির্বাচিত অংশ শুনে ভুল থাকলে ঠিক করে Save voice চাপুন। Review the transcript before saving.");
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      if (version === requestVersion.current) setTranscribing(false);
    }
  }
  async function save() {
    if (locked) return;
    if (issues.length) { setError(issues.join(" ")); return; }
    if (!buffer) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const wav = await referenceWav(buffer, start, end);
      const r = await fetch("/api/clones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, transcript, consent, audio: wav.base64 }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error?.message ?? "Voice could not be saved.");
      await refresh();
      setSelected(data.id);
      setNotice(`“${name.trim()}” সেভ হয়েছে। এবার Your script-এ নতুন কথা লিখে Generate cloned voice + SRT চাপুন।`);
      scriptRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    setError("");
    try {
      const r = await fetch(`/api/clones/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Unable to delete voice.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function generate() {
    if (locked) return;
    setBusy(true);
    setError("");
    const requestedProfile = selected,
      requestedFormat = format,
      source = text;
    try {
      const r = await fetch("/api/clones/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestedProfile,
          text: source,
          language,
          format: requestedFormat,
          rate: 1,
          outputGain,
          normalizeAudio,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error?.message ?? "Generation failed.");
      }
      const blob = await r.blob(),
        duration = Number(r.headers.get("X-Audio-Duration"));
      URL.revokeObjectURL(resultRef.current);
      const url = URL.createObjectURL(blob);
      resultRef.current = url;
      setResult({
        url,
        blob,
        duration,
        format: requestedFormat,
        subtitles: srt(source, duration),
        profile:
          profiles.find((p) => p.id === requestedProfile)?.name ?? "My voice",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="clone-layout">
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {notice && <div role="status" className="success clone-notice">{notice}</div>}
      <section className="panel clone-panel">
        <h2>
          <Upload size={20} /> 1. Add your voice
        </h2>
        <p>
          Upload a clear MP3 or WAV of your own voice. Choose 3–10 seconds with
          one speaker and no music.
        </p>
        <label className="clone-upload">
          Reference recording
          <input
            aria-label="Reference recording"
            type="file"
            accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
            disabled={locked}
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        {buffer && (
          <>
            <p>
              {fileName} · {buffer.duration.toFixed(1)} seconds
            </p>
            <div className="clone-times">
              <label>
                Start (seconds)
                <input
                  type="number"
                  min="0"
                  max={buffer.duration}
                  step="0.1"
                  disabled={locked}
                  value={start}
                  onChange={(e) => {
                    setStart(Number(e.target.value));
                    setPreview("");
                    setTranscript("");
                    setNotice("");
                    setError("");
                  }}
                />
              </label>
              <label>
                End (seconds)
                <input
                  type="number"
                  min="3"
                  max={buffer.duration}
                  step="0.1"
                  disabled={locked}
                  value={end}
                  onChange={(e) => {
                    setEnd(Number(e.target.value));
                    setPreview("");
                    setTranscript("");
                    setNotice("");
                    setError("");
                  }}
                />
              </label>
            </div>
            <p>
              {valid
                ? `${(end - start).toFixed(1)} seconds selected`
                : "Select 3–10 seconds within the recording."}
            </p>
            <button disabled={!valid} onClick={() => void makePreview()}>
              Listen to selected part
            </button>
            {preview && <audio controls autoPlay src={preview} />}
          </>
        )}
        <label>
          Voice name
          <input
            maxLength={60}
            disabled={locked}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>
          নির্বাচিত ৩–১০ সেকেন্ডে যা বলেছেন, সেটাই নিচে লাগবে—নতুন স্ক্রিপ্ট নয়।
          Auto transcribe দিয়ে লিখিয়ে নিয়ে শুনে মিলিয়ে নিন, অথবা নিজে লিখুন।
        </p>
        <label>
          Recording language
          <select value={referenceLanguage} disabled={locked} onChange={(e) => setReferenceLanguage(e.target.value as "bn" | "en")}>
            <option value="bn">বাংলা · Bengali</option>
            <option value="en">English</option>
          </select>
        </label>
        <button disabled={!valid || locked} onClick={() => void transcribe()}>
          {transcribing && <LoaderCircle className="spin" size={16} />}{" "}
          {transcribing ? "অডিও থেকে লিখছি… / Transcribing locally…" : "Auto transcribe selected audio"}
        </button>
        <p>Free local Whisper · Audio stays on this computer. CPU transcription may take a minute. বাংলা শনাক্তকরণে ভুল হতে পারে—শুনে লেখা ঠিক করে নিন। You can always type the exact words yourself.</p>
        <label>
          Exact words in the selected part
          <textarea
            rows={3}
            disabled={locked}
            aria-describedby="clone-save-help"
            maxLength={1000}
            placeholder="Write exactly what you say in those selected seconds, in the original language."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </label>
        <label className="clone-consent">
          <input
            type="checkbox"
            disabled={locked}
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          This is my voice, or I have the speaker’s permission.
        </label>
        <div id="clone-save-help" aria-live="polite">
          {issues.length > 0 ? <><p>সেভ করার আগে / Before saving:</p><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></> : <p>Ready to save. নির্বাচিত অংশের সঙ্গে লেখা মিলে গেলে Save voice চাপুন।</p>}
        </div>
        <button
          className="primary"
          disabled={locked}
          onClick={() => void save()}
        >
          {saving ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Mic2 size={16} />
          )}{" "}
          {saving ? "Saving voice…" : "Save voice for cloning"}
        </button>
        <p>
          Saved privately on this computer. Reference audio and transcripts are
          excluded from Git.
        </p>
      </section>
      <section className="panel clone-panel">
        <h2>
          <Mic2 size={20} /> 2. Speak in your voice
        </h2>
        <p>
          Bengali and English · Local OmniVoice · Free for noncommercial use. No
          API key.
        </p>
        {!installed && (
          <p role="status">
            Cloning model is not installed. Run{" "}
            <code>powershell -File scripts/setup-cloning.ps1</code>, then reopen
            this panel.
          </p>
        )}
        <label>
          Saved voice
          <select
            value={selected}
            disabled={locked}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select your saved voice</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.duration.toFixed(1)}s
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="clone-saved">
            <audio controls src={`/api/clones/${selected}`} />
            <button
              aria-label="Delete saved voice"
              disabled={busy}
              onClick={() => void remove(selected)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
        <div className="clone-times">
          <label>
            Output language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "bn" | "en")}
            >
              <option value="bn">বাংলা · Bengali</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Audio format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "wav" | "mp3")}
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
            </select>
          </label>
        </div>
        <label>
          Your script
          <textarea
            ref={scriptRef}
            rows={7}
            maxLength={600}
            placeholder="Write the Bengali or English words you want your cloned voice to say…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          Output volume {Math.round(outputGain * 100)}%
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
        <p>
          {text.length}/600 characters. A reference in the same language usually
          gives better pronunciation.
        </p>
        <button
          className="primary"
          disabled={locked || !installed || !selected || text.trim().length < 2}
          onClick={() => void generate()}
        >
          {busy && <LoaderCircle className="spin" size={16} />}{" "}
          {busy ? `Generating… ${elapsed}s` : "Generate cloned voice + SRT"}
        </button>
        <p>
          CPU generation can take several minutes. Similarity and expression
          depend on your recording; exact emotion matching is not guaranteed.
        </p>
        {result && (
          <div className="clone-output">
            <strong>
              {result.profile} · {result.duration.toFixed(1)}s · Generated voice
            </strong>
            <AudioPlayer key={result.url} src={result.url} />
            <div className="clone-times">
              <button
                onClick={() =>
                  download(result.blob, `byteminus-cloned.${result.format}`)
                }
              >
                <Download size={16} /> Download voice
              </button>
              <button
                onClick={() =>
                  download(
                    new Blob([result.subtitles], {
                      type: "application/x-subrip;charset=utf-8",
                    }),
                    "byteminus-cloned-estimated.srt",
                  )
                }
              >
                <Download size={16} /> Download SRT
              </button>
            </div>
            <p>SRT uses estimated sentence timing.</p>
          </div>
        )}
      </section>
    </div>
  );
}
