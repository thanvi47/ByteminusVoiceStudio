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
}: {
  src: string;
  audioRef?: Ref<HTMLAudioElement>;
  onPlay?: () => void;
  preload?: "none" | "metadata" | "auto";
}) {
  const element = useRef<HTMLAudioElement | null>(null),
    graph = useRef<Graph | null>(null);
  const [volume, setVolume] = useState(1),
    [error, setError] = useState("");
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
