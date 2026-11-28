# GPU speech validation — v0.2.1

Tested on 28 November 2026: Windows, AMD Ryzen 7 PRO 5850U, AMD Radeon(TM) integrated graphics, 16 logical CPU processors, 8 configured CPU compute threads. DirectML environment: torch-directml 0.2.5.dev240914, Torch 2.4.1, float32. This is not an RX 570, RTX 5090, Intel Arc or Apple M-series benchmark.

Real `/synthesize` requests produced nonempty PCM with nonzero RMS and reported `backend=directml`, `device=privateuseone:0`, `mixedOperations=true`. A second request for each engine reported `modelCacheHit=true`. Automatic full-model CPU fallback did not occur in these checks. This verifies successful GPU-assisted generation, not linguistic accuracy or expressive acting quality.

| Engine and selected profile | Fixed script | Audio length | First request | Warm request |
| --- | --- | --- | --- | --- |
| Kokoro `af_heart`, Neutral | Hello. Today is a new day. | 2.25s | 20.08s | 1.92s |
| Mithi `charvi`, Neutral | আজ একটি নতুন দিন। | 1.33s | 4.89s | 1.63s |
| Parler `Jon`, Excited, 30% intensity | Hello there. | 2.15s | 56.48s | 24.63s |
| Indic `Aditi`, Scared, 30% intensity | আজ একটি নতুন দিন। | 2.31s | 45.34s | 26.25s |

One first and one warm sample per engine; these are observations, not statistical performance guarantees. First versus warm is not CPU versus GPU. First Kokoro request also includes process/Python startup. Engine switches keep the process but replace the resident model. Expressive generation remains slow on this shared-memory integrated GPU. Faster or dedicated GPU hardware can behave differently; GPU usage alone does not guarantee lower latency than CPU.

A separate same-environment CPU/GPU check with the longer fixed scripts in the benchmark command measured warm means of 2.64s CPU / 2.80s DirectML for Kokoro and 3.62s CPU / 4.59s DirectML for Mithi. In those samples this integrated GPU was slower than CPU. The confirmed latency improvement is avoiding repeated process/model/pipeline loading; the fix enables real GPU execution, not a universal GPU speedup. Benchmark your own card before choosing a backend for performance.

## Why the earlier version returned to CPU

- The natural decoder's depthwise `ConvTranspose1d(groups=1024)` was rejected by DirectML. Only that small operator now executes on CPU.
- Mithi's complex FFT could abort the native DirectML process with `ComplexFloat` unsupported. Original FFT methods now run on CPU, keeping the real reconstruction rather than a substitute voice engine.
- DirectML Parler could not use PyTorch inference tensors; it uses `no_grad` instead.
- DirectML bool/integer promotion corrupted the delay-pattern tokens into boolean tensors. Delay-pattern and causal-attention mask arithmetic now executes on CPU with dtype preserved. Embeddings and heavy transformer/codec layers remain on GPU.

All adapters are application code; upstream downloaded model sources and model weights are not modified. CPU-side mask/FFT operations do not replace the model, script, voice or emotion prompt. Some CPU usage during GPU generation is expected. Windows Task Manager may initially show the 3D graph rather than the relevant compute engine; use actual backend diagnostics alongside the relevant GPU engine graph.

## Reproduce on another Windows PC

Stop the studio with Ctrl+C, update source, install DirectML if missing, then:

```powershell
git pull --ff-only
./scripts/stop-neural.ps1
./scripts/setup-directml.ps1
.venv/Scripts/python.exe scripts/benchmark-directml.py --engine kokoro
.venv/Scripts/python.exe scripts/benchmark-directml.py --engine mithi
npm run dev
```

The benchmark uses fixed generic scripts and checks the actual backend. It measures the CPU and DirectML paths in the same isolated Torch version, separately from the main application's modern Torch CPU path. It saves local WAV/JSON results under ignored `.cache/benchmarks/`. Listen to both before assessing quality. Drivers, memory pressure, power mode, text length and thermal limits affect timings.

The Windows launcher stops its spawned process trees on Ctrl+C, rather than leaving a venv Python child serving an older backend. It refuses to reuse a neural service reporting another version. The stop script only stops port 8123 when the executable is inside this project and its command identifies the neural service; it refuses unrelated processes. Stop active generation before updating. Restart and hard-refresh the browser after pulling source.

The main hardware guide covers CUDA, ROCm, XPU, MPS and strict overrides. Those backends were not available on this test machine. Optional OmniVoice cloning does not support this older DirectML environment; native modern supported backends or CPU are still required. No claim is made that every GPU, model and operating-system combination works.
