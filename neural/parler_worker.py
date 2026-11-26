"""One-shot expressive English inference in its own pinned Transformers environment."""

import contextlib
import json
import math
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
data = json.load(sys.stdin)


def parts(text):
    last = 0
    for match in re.finditer(
        r"\[(?:pause|break)\s+(\d+(?:\.\d+)?)(ms|s)\]", text, re.I
    ):
        if match.start() > last:
            yield text[last : match.start()]
        yield float(match[1]) / (1000 if match[2] == "ms" else 1)
        last = match.end()
    if last < len(text):
        yield text[last:]


def short_parts(text):
    """Keep each generation below the decoder token budget; never silently truncate long prose."""
    for part in parts(text):
        if isinstance(part, float):
            yield part
            continue
        current = ""
        for word in part.split():
            if len(word) > 160:
                raise ValueError("Use shorter words in expressive mode")
            if len(current) + len(word) + 1 > 160:
                yield current
                current = word
            else:
                current = (current + " " + word).strip()
        if current:
            yield current


def description(data):
    speaker = data["voice"].split(":", 1)[1]
    intensity = data["intensity"]
    emphasis = (
        "slightly" if intensity < 35 else "moderately" if intensity < 75 else "very"
    )
    emotion = data["emotion"] if intensity > 0 else "Neutral"
    styles = {
        "Neutral": "natural, conversational and clear",
        "Happy": "cheerful and happy",
        "Sad": "sad and subdued",
        "Excited": "excited, lively and animated",
        "Angry": "angry and stern",
        "Calm": "calm and soothing",
        "Serious": "serious and composed",
        "Scared": "frightened and hesitant",
        "Nervous": "nervous and uncertain",
        "Surprised": "surprised and animated",
        "Confused": "confused and questioning",
        "Disappointed": "disappointed and low in energy",
        "Worried": "worried and concerned",
        "Relieved": "relieved and relaxed",
        "Frustrated": "frustrated and tense",
        "Embarrassed": "shy and hesitant",
        "Proud": "confident and proud",
        "Hopeful": "optimistic and warm",
        "Whisper": "quiet, soft and intimate",
        "News Presenter": "clear, formal and authoritative",
        "Documentary Narration": "measured, thoughtful and engaging",
        "Storytelling": "expressive, animated and engaging",
    }
    pace = (
        "slow" if data["rate"] < 0.9 else "fast" if data["rate"] > 1.15 else "moderate"
    )
    pitch = (
        "low" if data["pitch"] < 0.9 else "high" if data["pitch"] > 1.1 else "moderate"
    )
    return f"{speaker} speaks in a {emphasis} {styles.get(emotion, 'natural')} tone, with a {pace} speaking rate and {pitch} pitch. Very clear audio, close recording, no background noise. {data.get('style', '')}"


with contextlib.redirect_stdout(sys.stderr):
    import numpy as np
    import torch
    from scipy.signal import resample_poly
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    torch.set_num_threads(min(4, os.cpu_count() or 1))
    folder = str(ROOT / ".models/parler")
    print("Loading expressive model on CPU...", flush=True)
    model = (
        ParlerTTSForConditionalGeneration.from_pretrained(
            folder, local_files_only=True, attn_implementation="eager"
        )
        .to("cpu")
        .eval()
    )
    tokenizer = AutoTokenizer.from_pretrained(folder, local_files_only=True)
    inputs = tokenizer(description(data), return_tensors="pt")
    chunks = []
    length = 0
    torch.manual_seed(42)
    for part in short_parts(data["text"]):
        if isinstance(part, float):
            audio = np.zeros(round(part * 24000), dtype=np.float32)
        elif not part.strip():
            continue
        else:
            prompt = tokenizer(part, return_tensors="pt")
            with torch.inference_mode():
                generation = model.generate(
                    input_ids=inputs.input_ids,
                    attention_mask=inputs.attention_mask,
                    prompt_input_ids=prompt.input_ids,
                    prompt_attention_mask=prompt.attention_mask,
                    max_new_tokens=1800,
                )
            audio = generation.cpu().numpy().squeeze()
            sr = model.config.sampling_rate
            frame_rate = model.audio_encoder.config.frame_rate
            if len(audio) / sr >= (1800 - 12) / frame_rate:
                raise ValueError(
                    "Expressive generation reached its token budget; use shorter text"
                )
            factor = math.gcd(sr, 24000)
            audio = resample_poly(audio, 24000 // factor, sr // factor)
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        length += len(audio)
        if length > 90 * 24000:
            raise ValueError("Audio exceeds 90 seconds")
        chunks.append(audio)
    if not length:
        raise ValueError("No audio generated")
    output = (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype("<i2").tobytes()
sys.stdout.buffer.write(output)
