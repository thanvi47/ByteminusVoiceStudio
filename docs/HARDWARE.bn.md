# Hardware নির্বাচন ও পুরোনো PC update

সব backend বিনামূল্যের local software। GPU নাম দেখা এবং সেই GPU-তে সম্পূর্ণ speech তৈরি হওয়া আলাদা পরীক্ষা। Auto mode প্রথমে ছোট tensor operation চালায়, তারপর আসল speech তৈরি করে। Unsupported operation/কম memory হলে একই model ও voice দিয়ে CPU-তে একবার retry হয়। CPU retry-ও ব্যর্থ হলে error দেখায়; অন্য robotic engine বসায় না। Header-এর tooltip-এ কারণ দেখা যায়।

| Computer | Backend ও installer |
| --- | --- |
| Windows/Linux Intel বা AMD CPU | CPU, automatic thread count |
| Windows/Linux compatible NVIDIA | CUDA 12.8 / Torch 2.8; compatible NVIDIA driver লাগবে |
| Linux supported AMD | ROCm 6.4 / Torch 2.8; আগে matching ROCm driver/runtime লাগবে |
| Windows/Linux supported Intel Arc / Core Ultra GPU | XPU / Torch 2.8; matching Intel driver লাগবে |
| Apple Silicon M-series | MPS / Metal; native arm64 macOS environment |
| Windows AMD, Intel Iris Xe/UHD বা অন্য DirectX 12 GPU | Experimental isolated DirectML; unsupported speech operations হলে CPU |
| Intel Mac | এই pinned Torch 2.8 stack-এ native macOS x86_64 unsupported; Linux x86_64 ব্যবহার করুন |

**RX 570:** NVIDIA CUDA চলবে না। Windows-এ DirectML চেষ্টা করা যায়; Linux-এ এই পুরোনো card-এর জন্য official ROCm support দাবি করা হচ্ছে না। Driver বা model operator না মিললে CPU চলবে। সব GPU-তে acceleration নিশ্চিত করার কোনো setting নেই।

## Windows update

চলমান generation শেষ হতে দিন। Server terminal-এ Ctrl+C দিন। Project folder-এর PowerShell-এ:

```powershell
git pull --ff-only
./scripts/stop-neural.ps1
./scripts/setup.ps1 -All -Device auto
npm run doctor -- --all
npm run dev
```

`-All` optional cloning/transcription/Indic-ও install করে; Indic-এ নিজের Hugging Face account দিয়ে access approval প্রয়োজন। শুধু সাধারণ বাংলা/English ও English expressive চাইলে `-All` বাদ দিন। Browser-এ Ctrl+Shift+R দিন। Git local changes থাকলে pull থামবে; নিজের পরিবর্তন সংরক্ষণ করুন, force reset করবেন না। ZIP installation হলে নতুন folder-এ নতুন source extract করে setup করুন। `.models` ও private `.data` backup করে স্থানান্তর করা যায়; অন্য PC-এর `.venv`, `.runtime`, `node_modules` কপি করবেন না।

Manual repair:

```powershell
./scripts/setup.ps1 -Device cuda
# অথবা supported Intel Arc:
./scripts/setup.ps1 -Device xpu
# অথবা experimental AMD/Intel DirectML environment:
./scripts/setup-directml.ps1
```

DirectML পুরোনো Torch 2.4.1 ব্যবহার করে আলাদা `.runtime/directml-env`-এ। Main Torch downgrade করবেন না। OmniVoice cloning DirectML সমর্থন করে না; CPU/native modern backend ব্যবহার করে। Natural DirectML adapter CPU text/prosody ও GPU waveform decoder চেষ্টা করে; successful হলেও CPU usage থাকবে।

## macOS / Linux update

```bash
git pull --ff-only
bash scripts/setup.sh --all --device auto
npm run doctor -- --all
npm run dev
```

Manual installer selection: `--device cpu`, `cuda`, `rocm`, `xpu` বা `mps`। Mac-এ `mps/cpu/auto`; Linux-এ `cuda/rocm/xpu/cpu/auto`। Linux auto detection-এর জন্য NVIDIA-তে `nvidia-smi`, AMD-তে working `rocminfo`, Intel-এ `xpu-smi` লাগে। না থাকলে explicit flag ব্যবহার করুন। Install flag কোন wheel বসবে তা ঠিক করে; runtime operation probe-এর পরে device নির্বাচন করে।

Runtime force করতে launch-এর আগে PowerShell-এ `$env:BYTEMINUS_DEVICE="cpu"` অথবা Unix-এ `export BYTEMINUS_DEVICE=cpu`। Accepted values: `auto`, `cpu`, `cuda`, `rocm`, `xpu`, `mps`, `directml`। Explicit unsupported backend স্পষ্ট error দেয়; auto-তেই GPU failure CPU-তে retry হয়। Override মুছতে PowerShell-এ `Remove-Item Env:BYTEMINUS_DEVICE` বা Unix-এ `unset BYTEMINUS_DEVICE`। Restart প্রয়োজন।

## Status ও performance

- `Detected; render unverified`: শুধু tensor probe সফল, speech GPU-তে যাচাই হয়নি।
- `Last render`: আসল generation-এর backend। `CPU + GPU` মানে mixed execution। Header tooltip-এ fallback reason ও model status থাকে; status প্রতি 15 সেকেন্ডে refresh হয়। Cloning আলাদা process, studio header cloning-এর backend দাবি করে না।
- CUDA/ROCm/XPU/MPS-এর memory API পাওয়া গেলে তার ভিত্তিতে budget নির্বাচন হয়। অন্তত 16 GB accelerator memory হলে 12,000 script characters, অন্তত 6 GB হলে 6,000; অন্যথায় 3,000। Free memory guard natural model-এ 1 GB, expressive/cloning-এ 6 GB। DirectML-এ নির্ভরযোগ্য VRAM API নেই, তাই conservative budget; VRAM বানিয়ে দেখায় না।
- Thread count auto হলেও autoregressive speech-এর কিছু ধাপ sequential; সব core সব সময় 100% হবে না। একসঙ্গে বহু model process চালালে RAM শেষ হতে পারে।

## কী পরীক্ষা হয়েছে

v0.2.1-এ Windows AMD Radeon(TM) integrated GPU-তে আসল API দিয়ে Kokoro, Mithi, English Parler এবং Bengali Indic Parler audio তৈরি হয়েছে; চারটির দ্বিতীয় request-এ warm cache hit ও DirectML backend যাচাই হয়েছে। v0.2.0-এর depthwise convolution, complex FFT এবং expressive token-mask dtype failure ঠিক করা হয়েছে। Natural engine-এ বড় decoder convolution GPU-তে, text/prosody ও ছোট unsupported operator CPU-তে চলে। Expressive transformer/codec GPU-তে, integer ও causal mask CPU-তে থাকে। তাই `CPU + GPU` দেখানো সঠিক; CPU usage শূন্য হবে না।

একটি ছোট generic sample-এর first/warm request: Kokoro 20.08/1.92s, Mithi 4.89/1.63s, Parler Jon Excited 56.48/24.63s, Indic Aditi Scared 45.34/26.25s। এগুলো model-load বনাম warm-request সময়, CPU বনাম GPU speedup নয়; প্রতিটি engine-এর text/audio duration আলাদা। Full details: [GPU validation](GPU_VALIDATION.md)। Expressive inference এই integrated GPU-তেও ধীর। RX 570, অন্য AMD/Intel/NVIDIA বা Apple GPU এই PC-তে benchmark করা হয়নি; তাদের driver/operator compatibility এখনও আলাদা যাচাই প্রয়োজন। Package CI pass মানে GPU audio verified নয়।

নিজের Windows PC-তে actual CPU/GPU comparison চালাতে `.venv/Scripts/python.exe scripts/benchmark-directml.py --engine mithi` অথবা `--engine kokoro` দিন। একই isolated Torch version-এ first load ও দুটি warm request মাপবে, actual backend assert করবে, generic WAV ও JSON `.cache/benchmarks`-এ রাখবে। CPU fallback হলে GPU success বলে দেখাবে না।

Upstream: [PyTorch wheels](https://pytorch.org/get-started/previous-versions/), [Intel GPU support matrix](https://docs.pytorch.org/docs/2.8/notes/get_start_xpu.html), [Microsoft DirectML](https://learn.microsoft.com/en-us/windows/ai/directml/pytorch-windows), [Apple MPS](https://docs.pytorch.org/docs/2.8/notes/mps.html)। Driver support matrix মেনে চলুন।
