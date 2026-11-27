# macOS ও Linux/Ubuntu setup — ByteminusVoiceStudio

> Hardware update: automatic CPU/CUDA/ROCm/XPU/MPS selection and experimental Windows DirectML. GPU tensor detection does not verify speech. **[Compatibility, tested limits and update commands](HARDWARE.bn.md)**.

Windows guide: [INSTALL.bn.md](INSTALL.bn.md)। এখানে Terminal/Bash ব্যবহার করবেন, PowerShell `.ps1` নয়। কোনো paid speech API লাগে না।

## Platform ও সীমা

- **macOS Apple Silicon (M1/M2/M3/M4 ও পরবর্তী arm64)**: native arm64 Terminal/Node ব্যবহার করুন; Rosetta x86_64 session নয়। বর্তমান adapter Apple Metal/MPS probe করে; unsupported operation হলে CPU fallback। macOS 15 এখানে CI target; অন্য OS version-এর package availability আলাদা হতে পারে।
- **Intel Mac**: pinned PyTorch 2.8 neural stack-এর official macOS x86_64 wheel নেই। Installer শুরুতেই থামে। পুরোনো Torch বসিয়ে dependency ভেঙে ফেলবেন না। [Upstream deprecation](https://dev-discuss.pytorch.org/t/pytorch-macos-x86-builds-deprecation-starting-january-2024/1690)।
- **Ubuntu 22.04/24.04 x86_64 / glibc Linux**: CPU এবং compatible NVIDIA driver থাকলে CUDA। Linux aarch64 path আছে, কিন্তু x86_64-এর সমান verification দাবি করা হচ্ছে না। Alpine/musl supported নয়।
- Node.js **22+** দরকার; 22 পরীক্ষিত version। Model/package download-এর জন্য কয়েক দশ GB free disk এবং expressive model-এর জন্য 16 GB RAM ব্যবহারিক starting point। Model weights ও Python environments GitHub source ZIP-এ থাকে না।

## ১. macOS prerequisites

প্রথমে Apple command-line build tools install করুন; installer খুললে সেটি শেষ করুন:

```bash
xcode-select --install
```

[Homebrew](https://brew.sh/) install করা থাকলে:

```bash
brew install node@22 git libsndfile espeak-ng ffmpeg pkg-config
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version
npm --version
git --version
uname -m
```

শেষ command `arm64` হওয়া উচিত। `node@22` keg-only; প্রতিবার Terminal-এ Node না পেলে উপরকার PATH line নিজের shell startup file-এ যোগ করুন। Homebrew-এর বর্তমান supported macOS versions দেখুন; পুরোনো macOS-এ bottle unavailable হতে পারে। [Node formula](https://formulae.brew.sh/formula/node@22), [eSpeak NG formula](https://formulae.brew.sh/formula/espeak-ng)।

## ২. Ubuntu prerequisites

```bash
sudo apt-get update
sudo apt-get install -y git curl build-essential pkg-config libsndfile1 espeak-ng ffmpeg
```

[Official Node.js download](https://nodejs.org/en/download) থেকে Node 22+ install করুন। Ubuntu-এর পুরোনো default `apt install nodejs` package 22-এর কম হতে পারে। আগে থেকে nvm থাকলে:

```bash
nvm install 22
nvm use 22
```

যাচাই:

```bash
node --version
npm --version
git --version
```

NVIDIA চাইলে distribution-supported NVIDIA driver আগে install করুন, reboot করে `nvidia-smi` পরীক্ষা করুন। App installer নিজে driver install/upgrade করে না।

## ৩. Project নামান ও base setup চালান

```bash
git clone https://github.com/thanvi47/ByteminusVoiceStudio.git
cd ByteminusVoiceStudio
bash scripts/setup.sh
```

এই script pinned uv download, managed Python 3.12, `.venv/bin/python`, আলাদা `.runtime/parler-env/bin/python`, locked packages, Mithi/Kokoro/English Parler models এবং doctor check চালায়। Mac-এ official PyPI Torch wheel ব্যবহার করে; Linux-এ CPU/CUDA wheel hardware অনুযায়ী নেয়। System Python/global pip বদলায় না। `sudo bash scripts/setup.sh` চালাবেন না।

## ৪. সব optional feature

নিজের free Hugging Face account দিয়ে [Indic model access](https://huggingface.co/ai4bharat/indic-parler-tts)-এর শর্ত আগে গ্রহণ করুন। তারপর:

```bash
bash scripts/setup.sh --all
```

প্রয়োজনে terminal-এ HF read token login আসবে। Browser model approval ও local token login আলাদা। Token কেবল নিজের terminal-এ দিন। এতে Bengali Indic + FLAN-T5 tokenizer, OmniVoice cloning, Whisper reference transcription-ও install হবে। OmniVoice model-এর noncommercial/community terms আছে; [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) পড়ুন।

আলাদা feature বা hardware override:

```bash
bash scripts/setup.sh --bengali-expressive
bash scripts/setup.sh --cloning
bash scripts/setup.sh --transcription
bash scripts/setup.sh --device cpu
```

NVIDIA Linux-এর জন্য `bash scripts/setup.sh --device cuda`। macOS-এ CUDA flag পরিষ্কার error দেয়। Manual HF login: `.venv/bin/hf auth login`।

## ৫. চালু ও ব্যবহার

```bash
npm run doctor -- --all
npm run dev
```

সব optional feature না নিলে `npm run doctor` ব্যবহার করুন। Terminal খোলা রেখে browser-এ [http://127.0.0.1:3000](http://127.0.0.1:3000) খুলুন। প্রথমে ছোট script: Mithi/Charvi সাধারণ বাংলা, Parler/Lea English emotional, Indic/Aditi বাংলা emotional। Generate voice + SRT → preview → download। SRT timing estimated।

পরেরবার শুধু `npm run dev`। বন্ধ: running app/service terminal-এ Ctrl+C। বড় CPU expressive request অনেক সময় নিতে পারে; আবার submit করবেন না।

## ৬. Update

App বন্ধ করে নিজের code changes সংরক্ষণ করুন:

```bash
git pull --ff-only
bash scripts/setup.sh
npm run doctor
npm run dev
```

আগে সব feature install করলে setup-এ `--all` রাখুন। Model download সম্পূর্ণ থাকলে reuse হয়। নতুন folder/অন্য OS-এ `.venv`/`.runtime` copy করবেন না—আবার setup চালান। ZIP থেকে install করলে নতুন source ZIP নামিয়ে setup দিন; `.git` ছাড়া git pull কাজ করে না। v0.1.0 ZIP-এ Unix installer নেই; v0.1.1 বা নতুন main/source version নিন।

## ৭. Troubleshooting

| সমস্যা | সমাধান |
| --- | --- |
| Permission denied on setup.sh | `bash scripts/setup.sh` ব্যবহার করুন; executable bit প্রয়োজন নেই। |
| Intel Mac/Rosetta error | Apple Silicon হলে native arm64 Terminal ও Node ব্যবহার করুন। প্রকৃত Intel Mac-এ এই neural lock unsupported। |
| espeak/libsndfile missing | উপরের brew/apt native dependencies install করুন; doctor-এর error দেখুন। |
| No matching wheel / package build failed | OS/CPU ও Node/Python version মিলান; compiler tools install করুন। Logs ছাড়া পুরোনো random Torch/NumPy বসাবেন না। |
| Indic 401/403 | নিজের HF account-এ gate approval, read-token scope, `.venv/bin/hf auth login`, তারপর Bengali setup। |
| CUDA unavailable | Driver ও CUDA PyTorch মিলান; `--device cpu` fallback। Apple Silicon-এ MPS probe হয়; unsupported speech operation হলে CPU fallback। |
| Port 3000/8123 occupied | নিজের পুরোনো app terminal বন্ধ করুন; অন্য software-এর process অন্ধভাবে kill নয়। |
| Wrong interpreter after moving folder | নতুন folder-এ fresh environments setup করুন। Model/private data আলাদা রাখুন। |

`--skip-models --skip-web` CI-only flags; এগুলো দিয়ে setup শেষ হলেও voice generation ready নয়। `npm run doctor -- --all --packages-only` কেবল imports/hardware পরীক্ষা করে, weights/generation নয়।

## Verification

Repository-এর **Unix package setup** workflow Ubuntu x86_64 ও Apple Silicon macOS runner-এ shell syntax এবং all-feature package import check চালায়, multi-GB weights ও private HF credentials ছাড়াই। এই check successful হলেও বাস্তব model generation/GPU performance বা প্রতিটি OS version নিখুঁত হওয়ার নিশ্চয়তা নয়। Windows CPU-তে real generation আলাদাভাবে পরীক্ষা হয়েছে।
