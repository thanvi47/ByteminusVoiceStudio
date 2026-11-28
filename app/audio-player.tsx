"use client";
import { useEffect, useRef, useState, type Ref } from "react";
type Graph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  compressor: DynamicsCompressorNode;
};
export default function AudioPlayer({
  src,
  audioRef,
  onPlay,
  preload = "metadata",
  autoPlay = false,
}: {
  src: string;
  audioRef?: Ref<HTMLAudioElement>;
  onPlay?: () => void;
  preload?: "none" | "metadata" | "auto";
  autoPlay?: boolean;
}) {
  const element = useRef<HTMLAudioElement | null>(null),
    graph = useRef<Graph | null>(null);
  const [volume, setVolume] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    if (!autoPlay) return;
    void element.current?.play().catch(() => setError("Your audio is ready. This browser needs you to press Play to listen."));
  }, [src, autoPlay]);
  useEffect(
    () => () => {
      const g = graph.current;
      if (g) {
        g.source.disconnect();
        g.gain.disconnect();
        g.compressor.disconnect();
        void g.context.close();
      }
    },
    [],
  );
  function apply(value: number) {
    const player = element.current;
    if (!player) return;
    if (!graph.current && value <= 1) {
      player.volume = value;
      return;
    }
    try {
      if (!graph.current) {
        const context = new AudioContext(),
          source = context.createMediaElementSource(player),
          gain = context.createGain(),
          compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -3;
        compressor.knee.value = 4;
        compressor.ratio.value = 16;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.15;
        source.connect(gain);
        gain.connect(compressor);
        compressor.connect(context.destination);
        graph.current = { context, source, gain, compressor };
      }
      player.volume = 1;
      graph.current.gain.gain.value = value;
      void graph.current.context
        .resume()
        .catch(() => setError("Click Play again to enable the volume boost."));
    } catch {
      player.volume = Math.min(1, value);
      setError(
        "Boost is unavailable in this browser; normal playback volume still works.",
      );
    }
  }
  return (
    <div className="volume-player">
      <audio
        controls
        src={src}
        preload={preload}
        ref={(node) => {
          element.current = node;
          if (typeof audioRef === "function") audioRef(node);
          else if (audioRef) audioRef.current = node;
        }}
        onPlay={() => {
          apply(volume);
          onPlay?.();
        }}
      />
      <div className="audio-tools">
        <button type="button" onClick={() => { const p = element.current; if (p) p.currentTime = Math.max(0, p.currentTime - 5); }}>−5 seconds</button>
        <button type="button" onClick={() => { const p = element.current; if (p && Number.isFinite(p.duration)) p.currentTime = Math.min(p.duration, p.currentTime + 5); }}>+5 seconds</button>
        <label>Speed <select aria-label="Audio playback speed" defaultValue="1" onChange={(e) => { if (element.current) element.current.playbackRate = Number(e.target.value); }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
        </select></label>
      </div>
      <label>
        Playback volume <span>{Math.round(volume * 100)}%</span>
        <input
          aria-label="Playback volume"
          type="range"
          min="0"
          max="3"
          step="0.05"
          value={volume}
          onChange={(e) => {
            const value = +e.target.value;
            setVolume(value);
            setError("");
            apply(value);
          }}
        />
      </label>
      <small>Immediate playback boost · downloaded file unchanged</small>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
