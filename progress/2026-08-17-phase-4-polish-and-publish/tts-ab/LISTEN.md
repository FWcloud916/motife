# TTS A/B — 評分表

跑完 [README.md](README.md) 的候選矩陣、聽過 `out/tts-ab/<label>/public/audio/*.mp3`
之後在這裡填分數。1–5 分,仿 `motife eval` 人工評分的格式。

## 評分表

| label | 口音自然度 | 中英混讀 | 語速節奏 | 整體 | 備註 |
|---|---|---|---|---|---|
| A-baseline |  |  |  |  |  |
| B-alloy-instr |  |  |  |  |  |
| C-coral-instr |  |  |  |  |  |
| D-sage-instr |  |  |  |  |  |
| E-ash-instr |  |  |  |  |  |
| F-11-multi |  |  |  |  |  |
| G-11-alt |  |  |  |  |  |

備註欄使用建議:若候選「聽起來不穩定/過度風格化」,寫這句而非直接判它輸
(ElevenLabs 的 `voice_settings`/`language_code` 目前沒接,見 README「決策
提醒」)。

## 贏家

- **provider / model / voice:**
- **instructions(若有):**
- **一句話理由:**

## 下一步

選好贏家後開 PR 4b:
- 改 `src/tts/defaults.ts` 的 `DEFAULT_TTS_MODELS`/`DEFAULT_OPENAI_TTS_VOICE`
- 若贏家靠 instructions,決定它要不要進 `.env.example` 的建議值(opt-in,
  不寫死進程式碼——見 README「決策提醒」)
- 更新 `docs/agent-pipeline.md` 與 Phase 4 progress item,把失敗模式 3 標記
  為已修
