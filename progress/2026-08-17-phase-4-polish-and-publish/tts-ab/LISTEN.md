# TTS A/B — 評分表

全部 7 組候選已產生並透過對話傳送 mp3(2026-08-18)。聽完之後在這裡填分數。
1–5 分,仿 `motife eval` 人工評分的格式。

## 評分表

| label | 口音自然度 | 中英混讀 | 語速節奏 | 整體 | 備註 |
|---|---|---|---|---|---|
| A-baseline(alloy,無引導) |  |  |  |  |  |
| B-alloy-instr(alloy + 台灣口音引導) |  |  |  |  |  |
| C-coral-instr(coral + 引導) |  |  |  |  |  |
| D-sage-instr(sage + 引導) |  |  |  |  |  |
| E-ash-instr(ash + 引導) |  |  |  |  |  |
| F-11-xuming(ElevenLabs「Xu Ming」台灣國語) |  |  |  |  |  |
| G-11-roy(ElevenLabs「Roy - Taiwanese Youth」台灣國語) |  |  |  |  |  |

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
