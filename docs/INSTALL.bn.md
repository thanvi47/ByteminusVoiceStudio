# ByteminusVoiceStudio — নতুন PC-তে ধাপে ধাপে setup

Free local বাংলা/English AI text-to-speech, expressive voice, WAV/MP3 ও estimated SRT। কোনো paid speech API লাগে না। এই guide **Windows 10/11 64-bit, PowerShell**-এর জন্য। [macOS/Linux/Ubuntu guide এখানে](INSTALL.mac-linux.bn.md)।

## ১. প্রয়োজনীয় software ও hardware

- [Node.js 22 LTS](https://nodejs.org/en/download), npm-সহ; [Git for Windows](https://git-scm.com/downloads/win)। Install-এর পরে নতুন PowerShell খুলুন।
- Windows-এ native DLL error এড়াতে [Microsoft Visual C++ v14 Redistributable x64](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) runtime install/update করুন। Driver/runtime installer নিজের স্বাভাবিক Windows permission চাইতে পারে।
- Internet এবং বড় model/package download-এর জন্য যথেষ্ট disk space। সব optional feature-এর জন্য কয়েক দশ GB খালি রাখা ব্যবহারিকভাবে ভালো; মাপ feature অনুযায়ী বদলায়।
- বড় expressive model-এর জন্য 16 GB RAM ভালো starting point; কম RAM-এ ধীর হতে পারে। এখানে Ryzen 7/16 GB CPU-তে পরীক্ষা হয়েছে।
- NVIDIA GPU থাকলে উপযুক্ত official NVIDIA driver আগে লাগবে। GPU ছাড়াও CPU-তে চলে। Setup Python, uv ও app-এর Python packages project-এর ভেতর install করে; global Python/pip লাগবে না।
- AMD Radeon GPU থাকলেই CUDA ব্যবহার করা যায় না। এই সংস্করণে AMD DirectML/ROCm acceleration নেই; RX 570-এর মতো AMD PC CPU-তে চলবে। `-Device cuda` কেবল compatible NVIDIA setup-এর জন্য।

```powershell
node --version
npm --version
git --version
```

কোনো command না পাওয়া গেলে software install করে PowerShell আবার খুলুন। ছোট local folder ব্যবহার করুন; যেমন D drive-এর Projects folder। Network/OneDrive folder-এর বদলে local disk ভালো।

## ২. GitHub থেকে project নিন

```powershell
git clone https://github.com/thanvi47/ByteminusVoiceStudio.git
cd ByteminusVoiceStudio
```

এরপর সব command এই project folder-এ চালান, যেখানে `package.json` আছে।

## ৩. Setup-এর পথ বাছুন

### সাধারণ বাংলা + English emotional voice

```powershell
./scripts/setup.ps1
```

এটি locked web packages (`npm ci --legacy-peer-deps`), isolated Python, CPU/CUDA PyTorch, Mithi/Kokoro এবং English Parler package/model install করে। শেষে `doctor` check চলে। বাংলা emotional Arjun/Aditi এবং cloning/transcription আলাদা optional feature।

### সব optional feature-সহ

আগে নিজের free [Hugging Face account](https://huggingface.co/join) দিয়ে [Indic model page](https://huggingface.co/ai4bharat/indic-parler-tts)-এ access-এর শর্ত পড়ে গ্রহণ করুন। তারপর:

```powershell
./scripts/setup.ps1 -All
```

প্রয়োজনে setup terminal-এ Hugging Face login চাইবে। নিজের approved account-এর read token দিন। Fine-grained token হলে gated model পড়ার অনুমতি থাকতে হবে। Browser-এর model approval ও local token login আলাদা; token দিলেই gate approval হয় না। Token chat/screenshot/Git-এ দেবেন না।

`-All` base + English expressive + Bengali Indic/FLAN-T5 tokenizer + OmniVoice cloning + Whisper reference transcription install করে এবং `doctor --all` চালায়। **OmniVoice weights noncommercial/community terms-এ**; [third-party notices](../THIRD_PARTY_NOTICES.md) আগে পড়ুন। Download code/model free হলেও সব model-এর commercial rights এক নয়।

Token বানাতে Hugging Face-এর [Settings → Access Tokens](https://huggingface.co/settings/tokens) → **New token**, একটি নাম দিন, local model download-এর জন্য **Read** role নিন। Model access আগে approved থাকতে হবে। Production-এ model-scoped fine-grained read token ব্যবহার করুন। বিস্তারিত [official token guide](https://huggingface.co/docs/hub/security-tokens)। Token কেবল স্থানীয় login prompt-এ paste করুন; password লাগবে না।

পরে আলাদা feature যোগ করা যায়:

```powershell
./scripts/setup.ps1 -BengaliExpressive
./scripts/setup.ps1 -Cloning
./scripts/setup.ps1 -Transcription
```

কোনো step ব্যর্থ হলে setup থামবে। Error ঠিক করে একই command পুনরায় চালান; সম্পূর্ণ downloaded model সাধারণত reuse হয়। Download পুরো শেষ না হওয়া পর্যন্ত terminal বন্ধ করবেন না।

## ৪. আগে base install করা থাকলে Indic error ঠিক করুন

মূল `setup-neural.ps1 -Expressive` **English Parler** নামায়, Bengali Indic নয়। `indic is not installed`/unavailable দেখালে browser-এ উপরের access নিয়ে:

```powershell
./.venv/Scripts/hf.exe auth login
./scripts/setup-bengali-expressive.ps1
npm run doctor
```

`.models/indic/`-এ weights/config/tokenizer এবং `.models/indic-description/`-এ matching tokenizer লাগবে। শুধু JSON নামালে হবে না। Git clone-এর সঙ্গে বড় model বা token আসে না। অন্য optional feature missing কি না জানতে `npm run doctor -- --all`।

## ৫. App চালান এবং voice তৈরি করুন

```powershell
npm run dev
```

Chrome-এ [http://127.0.0.1:3000](http://127.0.0.1:3000) খুলুন। Terminal চালু রাখুন; command web app ও Python voice server চালায়/reuse করে।

1. সাধারণ বাংলা: **Bengali → Charvi/Mithi**।
2. English emotion: **English · Expressive → Lea/Jon → Excited/Scared**।
3. বাংলা emotion: **Bengali · Expressive → Aditi/Arjun**, Indic download সফল হওয়ার পরে।
4. ছোট script দিয়ে **Generate voice + SRT** চাপুন। Preview শুনে audio ও estimated SRT download করুন।
5. Clone: **Voice cloning**, নিজের/অনুমতিপ্রাপ্ত MP3/WAV, 3–10 second পরিষ্কার reference, exact transcript, voice name ও permission checkbox। Auto-transcription চাইলে Whisper install লাগবে।

Emotion শুধু expressive engine-এ। Intensity 0% neutral direction; 1–34% subtle। Mithi/Kokoro emotion বন্ধ। Natural sound-এর জন্য speed/pitch 1.00 রাখুন। CPU expressive generation-এ অনেক সময় লাগতে পারে; বারবার submit নয়। SRT timing আনুমানিক, model acting/উচ্চারণ প্রতিটি script-এ নিখুঁত নয়।

## ৬. CPU/GPU automatic settings

Header-এ active voice-এর runtime দেখা যায়। CUDA availability, free VRAM ও ছোট kernel operation যাচাই হয়; GPU নাম পেলেই GPU ব্যবহার দাবি করে না।

| Runtime | Script characters | Automatic batch |
| --- | ---: | ---: |
| CPU | 3,000 | thread budget অনুযায়ী 160–300 |
| Usable CUDA, VRAM <16 GB | 6,000 | 600 |
| Usable CUDA, VRAM ≥16 GB | 12,000 | 1,200 |

বড় script sequential sections থেকে এক audio-তে জোড়া হয়। GPU selection-এর সময় অন্তত 6 GB free VRAM লাগে। Cloning-এর আলাদা 600-character/90-second limit আছে। Apple MPS/AMD DirectML enabled নয়। এই CPU-only PC-তে RTX 5090 inference সরাসরি benchmark করা যায়নি।

NVIDIA support install/repair: `./scripts/setup.ps1 -Device cuda`। Compatible driver লাগবে। CPU packages force করতে `-Device cpu`। চালুর আগে optional overrides: `$env:BYTEMINUS_CPU_THREADS="8"`, `$env:BYTEMINUS_DEVICE="cpu"` বা `"cuda"`। Default auto; explicit unavailable CUDA স্পষ্ট error দেয়। পরিবর্তনের পরে পুরোনো service বন্ধ করুন।

## ৭. প্রতিদিন চালু, বন্ধ ও update

পরেরবার শুধু project folder-এ `npm run dev`। বন্ধ করতে running app/service terminal-এ **Ctrl+C**।

Update-এর আগে terminals বন্ধ করুন, নিজের code changes সংরক্ষণ করুন; force reset নয়:

```powershell
git pull --ff-only
npm ci --legacy-peer-deps
npm run doctor
npm run dev
```

Python dependencies বদলালে আগের setup command আবার চালান। শুধু git pull packages/models install করে না। পুরোনো server reuse হলে তার terminal-ও Ctrl+C দিয়ে বন্ধ করুন। Browser-এ Ctrl+Shift+R।

## ৮. Troubleshooting

| Error/সমস্যা | সমাধান |
| --- | --- |
| node/npm/git not recognized | Install করে নতুন PowerShell খুলুন। |
| running scripts is disabled | ব্যক্তিগত PC-তে শুধু বর্তমান session-এর জন্য `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, তারপর setup। Managed PC-তে administrator policy অনুসরণ করুন; স্থায়ী system policy বদলাবেন না। |
| indic is not installed | ধাপ ৪: HF access + local login + Bengali setup; restart। |
| HF 401/403/gated repository | সঠিক account-এর model approval ও read-token permissions যাচাই করুন। Browser login একা যথেষ্ট নয়। |
| ModuleNotFoundError/DLL error | `npm run doctor`; দেখানো setup command পুনরায় চালান। Random global pip install নয়। |
| CUDA unavailable/unsupported kernel | NVIDIA driver ও CUDA packages যাচাই করুন; `-Device cuda` repair বা `-Device cpu` fallback। |
| Neural offline/connection refused | `npm run dev` terminal-এর error দেখুন; প্রয়োজনে আলাদা terminal-এ `npm run neural:serve`। Python port 8123 internet-এ প্রকাশ নয়। |
| Port in use | আগের app terminal বন্ধ করুন; অন্য software-এর process অন্ধভাবে kill নয়। |
| Download interrupted/disk full | Network/storage ঠিক করে একই setup rerun; পুরো .models delete দরকার নেই। |
| Generation ধীর/timeout | ছোট script, free RAM, speed/pitch 1.00; CPU-তে অপেক্ষা করুন। |

সব feature check: `npm run doctor -- --all`। Developer checks: `npm test`, `npm run typecheck`, `npm run build`। Doctor package imports/model files/hardware পরীক্ষা করে; corrupted weights, সব driver/antivirus/network এবং subjective quality সম্পূর্ণ নিশ্চয়তা দেয় না। Error report-এ terminal error/doctor output দিন, token বা private recording নয়।

## ৯. GitHub, privacy ও SEO

Git-এ source, package locks, setup/download scripts, docs, generic demos থাকে। `.models`, `.venv`, `.runtime`, `.cache`, `.data`, `.env.local`, private voices/transcripts push হয় না। অন্য PC-তে models install করতে হবে।

GitHub README/About/topics project discovery-এর জন্য। App-এর local private studio default **noindex**। Public deployment/SEO-র জন্য [SEO.md](SEO.md) ও [DEPLOYMENT.md](DEPLOYMENT.md)। SEO localhost প্রকাশ করে না, ranking নিশ্চিত করে না।
