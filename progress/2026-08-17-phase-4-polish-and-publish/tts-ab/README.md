# TTS A/B — 中文旁白口音比較(Phase 4 PR 4)

修 Phase 3 失敗模式 3(「TTS 中文旁白口音重」,OpenAI `gpt-4o-mini-tts`
voice=`alloy`)的最後一步。PR 4 已經把 `--tts-model`/`--tts-instructions`/
`MOTIFE_TTS_*` 全部穿線完成並測試過——這份文件是拿那些新旋鈕來做實際比較
的工具,**需要人聽才能判斷哪個候選比較自然**,所以這一步留給你。

選出贏家後,開一個小 PR(4b)把 `src/tts/defaults.ts` 的預設值(以及/或
`.env` 建議值)改成贏家即可,不需要重跑這份 PR 4 的其他任何東西。

**狀態:全部 7 組候選已產生並送出給你聽(2026-08-18)。** 音檔本身在
gitignore 的 `out/tts-ab/` 底下,已透過對話直接傳送 mp3——下面的執行步驟
留著給要重跑/换候選的人參考。

## 先做的事(只需一次,已完成——記錄留給下次重跑的人)

1. **API key**:用 shell inline source 主 checkout 的 `.env`,不在這個
   worktree 建立金鑰複本:
   ```bash
   set -a; source /Users/kdanmobile/Documents/private/motife/.env; set +a
   ```
2. **ElevenLabs 中文 voice**——帳號原本沒有任何中文 voice,但 ElevenLabs
   的**共用語音庫**(不是帳號自己的 voice 列表)可以搜到中文候選:
   ```bash
   curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" \
     "https://api.elevenlabs.io/v1/shared-voices?language=zh&page_size=10" | python3 -m json.tool
   ```
   搜到兩個標記 `taiwan mandarin` 的 voice,已取得使用者確認後加入帳號
   語音庫(`POST /v1/voices/add/{public_owner_id}/{voice_id}`,`public_owner_id`
   來自上面搜尋結果的欄位):
   - `A3T1GnLHdn0WL5w4TMtq` — "Xu Ming"(男聲,zh taiwan mandarin)
   - `XXxvxx0YUt8icTEFE3c6` — "Roy - Taiwanese Youth"(男聲,zh taiwan mandarin)

## 候選矩陣

4 段旁白(見 `fixture.doc.json`,逐字複製自三支基準,基準檔案本身不變):

| scene id | 內容 | 測試重點 |
|---|---|---|
| `control` | mq-backpressure intro | 乾淨中文,零外來語(對照組) |
| `loanword` | jwt-auth breakdown | JWT/Header/Payload/Signature/Base64URL 五個英文詞混讀 |
| `codeswitch` | db-index breakdown | B+Tree/root/internal node/leaf,最難的中英切換 |
| `summary` | jwt-auth summary | 三點收尾,中等外來語密度 |

口音引導文字草稿(可自行調整):
```
以自然、道地的台灣華語朗讀，語速適中、口吻沉穩清晰；句中的英文技術名詞
（例如 JWT、Base64URL、B+Tree）依台灣工程師的習慣發音，不要用美式英語
腔調誦讀中文。
```

| label | provider | model | voice | instructions |
|---|---|---|---|---|
| `A-baseline` | openai | gpt-4o-mini-tts | alloy | (無 — Phase 3 原始設定,對照基準) |
| `B-alloy-instr` | openai | gpt-4o-mini-tts | alloy | 上方引導文字(單獨測 instructions 這個軸) |
| `C-coral-instr` | openai | gpt-4o-mini-tts | coral | 同上 |
| `D-sage-instr` | openai | gpt-4o-mini-tts | sage | 同上 |
| `E-ash-instr` | openai | gpt-4o-mini-tts | ash | 同上 |
| `F-11-xuming` | elevenlabs | eleven_multilingual_v2 | `A3T1GnLHdn0WL5w4TMtq`(Xu Ming) | n/a |
| `G-11-roy` | elevenlabs | eleven_multilingual_v2 | `XXxvxx0YUt8icTEFE3c6`(Roy) | n/a |

`A` vs `B` 單獨測 instructions 有沒有用;`B`–`E` 在固定 instructions 下比較
voice;`F`/`G` 是跨廠牌對照組。

## 執行(對每一列跑一次)

```bash
FIXTURE=progress/2026-08-17-phase-4-polish-and-publish/tts-ab/fixture.doc.json

# OpenAI 候選(以 B-alloy-instr 為例)
pnpm motife tts "$FIXTURE" --run out/tts-ab/B-alloy-instr \
  --tts openai --voice alloy --tts-model gpt-4o-mini-tts \
  --tts-instructions "以自然、道地的台灣華語朗讀，語速適中、口吻沉穩清晰；句中的英文技術名詞（例如 JWT、Base64URL、B+Tree）依台灣工程師的習慣發音，不要用美式英語腔調誦讀中文。"

# A-baseline 不帶 instructions
pnpm motife tts "$FIXTURE" --run out/tts-ab/A-baseline \
  --tts openai --voice alloy --tts-model gpt-4o-mini-tts

# ElevenLabs 候選(voice id 見上方矩陣;第一次使用前該 voice 必須已在帳號
# 語音庫,見上方「先做的事」)
pnpm motife tts "$FIXTURE" --run out/tts-ab/F-11-xuming \
  --tts elevenlabs --voice A3T1GnLHdn0WL5w4TMtq --tts-model eleven_multilingual_v2
```

每組跑完會在 `out/tts-ab/<label>/public/audio/{control,loanword,codeswitch,summary}.mp3`
產生 4 段音檔(`out/` 已 gitignore,不會進版控)。用真正的 `motife tts` 指令
是刻意的——這同時證明新 flag 真的接到 API,也順便驗證了 hash 修復(同一個
`--run` 目錄下換 model 現在會正確重新合成,不會沿用舊快取)。

## 費用/時間估計

7 個候選 × 4 段(每段約 2-4 句話)≈ 2 分鐘音檔,`gpt-4o-mini-tts` 費率下大約
幾美分;ElevenLabs 依帳號方案計費。

## 聽完之後

打開 [`LISTEN.md`](LISTEN.md) 填評分表,選出贏家,然後開 PR 4b 改
`src/tts/defaults.ts`(以及是否要把引導文字變成語言感知的預設值——見下方
「決策提醒」)。

## 決策提醒(選贏家時一併考慮)

- 如果贏家是「加了 instructions 才好」而不是「換 voice 就好」,PR 4b 就不
  只是改一個表,還要決定 `MOTIFE_TTS_INSTRUCTIONS` 該不該變成 zh-TW 的
  硬編碼預設——這對 `--lang en` 的英文旁白是錯的,建議維持 opt-in(寫進
  `.env` 範例建議值,而非程式碼寫死)。
- ElevenLabs 目前沒有接 `voice_settings`(穩定度/相似度/風格)或
  `language_code` 這兩個調校旋鈕(`src/tts/elevenlabs.ts`)。如果 ElevenLabs
  候選聽起來「不穩定」或「過度風格化」,那可能是這些旋鈕沒調,不是
  voice 本身不好——請在 `LISTEN.md` 備註欄寫清楚,而不是直接判它輸。
