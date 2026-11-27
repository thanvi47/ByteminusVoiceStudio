"""Download pinned model files. Optional Indic weights require approved HF access."""

import argparse
import concurrent.futures
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "whisper": (
        "Systran/faster-whisper-small",
        "536b0662742c02347bc0e980a01041f333bce120",
        lambda p: p in {"README.md", "config.json", "model.bin", "tokenizer.json", "vocabulary.txt"},
    ),
    "indic": (
        "ai4bharat/indic-parler-tts",
        "660bc53c64ae83150613264111708a0465211237",
        lambda p: (
            p.endswith((".json", ".safetensors", ".model"))
            or p in {"LICENSE", "README.md"}
        ),
    ),
    "indic-description": (
        "google/flan-t5-large",
        "0613663d0d48ea86ba8cb3d7a44f0f65dc596a2a",
        lambda p: (
            p
            in {
                "config.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "spiece.model",
                "tokenizer.json",
            }
        ),
    ),
    "omnivoice": (
        "k2-fsa/OmniVoice",
        "3fc979d1cd72492cd679c5ac2611e0d7ac047ba1",
        lambda p: (
            p.endswith((".json", ".safetensors", ".jinja"))
            or p.endswith(("LICENSE", "README.md"))
        ),
    ),
    "mithi": (
        "Oomni/mithi-v2-flash",
        "1fc0dd68496a2483508ec764d310146c41ff90be",
        lambda p: (
            p in {"run.py", "config.json", "LICENSE", "README.md"}
            or p.endswith(".safetensors")
            or p.startswith("indic_encoder/")
        ),
    ),
    "kokoro": (
        "hexgrad/Kokoro-82M",
        "f3ff3571791e39611d31c381e3a41a3af07b4987",
        lambda p: (
            p in {"config.json", "kokoro-v1_0.pth", "LICENSE", "README.md", "VOICES.md"}
            or p.startswith("voices/")
            and p.endswith(".pt")
            and p.split("/")[-1].startswith(("af_", "am_", "bf_", "bm_"))
        ),
    ),
    "parler": (
        "parler-tts/parler-tts-mini-v1",
        "0392b9451a601e528fd863bbb0598431fee810d9",
        lambda p: (
            p.endswith((".json", ".safetensors", ".model"))
            or p in {"LICENSE", "README.md"}
        ),
    ),
}


def download(name):
    repo, revision, include = MODELS[name]
    with urllib.request.urlopen(
        f"https://huggingface.co/api/models/{repo}/revision/{revision}", timeout=60
    ) as response:
        metadata = json.load(response)
    sha = metadata["sha"]
    folder = ROOT / ".models" / name
    folder.mkdir(parents=True, exist_ok=True)
    source_file = folder / "source.json"
    previous = json.loads(source_file.read_text(encoding="utf-8")) if source_file.exists() else None
    replace_stale = previous is not None and (
        previous.get("repository") != repo or previous.get("revision") != sha
    )
    if name == "indic":
        from huggingface_hub import get_token

        token = get_token()
        if not token:
            raise RuntimeError(
                "Sign in using hf auth login and accept access at https://huggingface.co/ai4bharat/indic-parler-tts first. No paid subscription is needed."
            )

    def fetch(entry):
        relative = entry["rfilename"]
        if not include(relative):
            return
        target = folder / relative
        if not target.resolve().is_relative_to(folder.resolve()):
            raise ValueError("Unsafe model path")
        target.parent.mkdir(parents=True, exist_ok=True)
        if not replace_stale and target.exists() and target.stat().st_size > 0:
            return
        temporary = target.with_name(target.name + ".partial")
        print(f"Downloading {name}/{relative}", flush=True)
        # Authenticated gated files use the official Hub client so redirect credentials are handled safely.
        if name == "indic":
            from huggingface_hub import hf_hub_download

            hf_hub_download(repo, relative, revision=sha, local_dir=folder, token=token)
            return
        urllib.request.urlretrieve(
            f"https://huggingface.co/{repo}/resolve/{sha}/{relative}", temporary
        )
        temporary.replace(target)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(fetch, metadata["siblings"]))
    (folder / "source.json").write_text(
        json.dumps({"repository": repo, "revision": sha}, indent=2), encoding="utf-8"
    )
    print(f"{name}: files ready at revision {sha}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("models", nargs="+", choices=list(MODELS))
    for name in parser.parse_args().models:
        download(name)
