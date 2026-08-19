# TTS A/B — 評分表

全部 7 組候選已產生並透過對話傳送 mp3(2026-08-18)。聽完之後在這裡填分數。
1–5 分,仿 `motife eval` 人工評分的格式。

## 評分表

| label | 口音自然度 | 中英混讀 | 語速節奏 | 整體 | 備註 |
|---|---|---|---|---|---|
| A-baseline(alloy,無引導) | 3 | 3 | 3 | 3 |  |
| B-alloy-instr(alloy + 台灣口音引導) | 3 | 4 | 4 | 4 |  |
| C-coral-instr(coral + 引導) | 3 | 4 | 4 | 4 |  |
| D-sage-instr(sage + 引導) | 3 | 4 | 4 | 4 |  |
| E-ash-instr(ash + 引導) | 3 | 4 | 4 | 4 |  |
| F-11-xuming(ElevenLabs「Xu Ming」台灣國語) | 4 | 4 | 4 | 4 | 部分口齒不清，但比 roy 自然 |
| G-11-roy(ElevenLabs「Roy - Taiwanese Youth」台灣國語) | 4 | 4 | 4 | 4 |  |

備註欄使用建議:若候選「聽起來不穩定/過度風格化」,寫這句而非直接判它輸
(ElevenLabs 的 `voice_settings`/`language_code` 目前沒接,見 README「決策
提醒」)。

## 贏家

- **provider / model / voice:** elevenlabs / eleven_multilingual_v2 / Xu Ming(`A3T1GnLHdn0WL5w4TMtq`,taiwan mandarin)
- **instructions(若有):** 無(ElevenLabs 不支援)
- **一句話理由:** 比較自然

## 下一步 — 已完成(2026-08-18)

贏家是 ElevenLabs voice(帳號專屬 id),依「決策提醒」的原則不寫死進
`src/tts/defaults.ts`(那個表只放零設定就能跑的安全預設,目前仍是
openai/alloy)。改成 `.env` 層的建議覆寫:

- ✅ 主 checkout `.env`:已設 `MOTIFE_TTS=elevenlabs` /
  `ELEVENLABS_VOICE_ID=A3T1GnLHdn0WL5w4TMtq` / `MOTIFE_TTS_MODEL=eleven_multilingual_v2`
  (本機使用,未進版控)
- ✅ `.env.example`:加了註解掉的建議覆寫區塊,附上為什麼不能當全域預設的
  說明(voice id 帳號專屬,換帳號需要先把這支 voice 從共用語音庫加進自己
  的語音庫)
- ✅ `docs/agent-pipeline.md`:Configuration 段落記錄這個決策
- ✅ Phase 4 progress item:失敗模式 3 標記為已解(見 PROGRESS.md)

沒有另開 PR 4b——PR #16(PR 4)當時還沒合併,這些文件變更直接併入同一個
分支/PR。
