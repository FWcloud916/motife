---
name: motife-generate
description: Turn a technical-concept description into a motife explainer MP4 by acting as the semantic layer yourself — write the DSL document, validate it with the compiler CLI, synthesize narration, render, then visually review stills and revise. Use when asked to create a new motife video from a concept/prompt without (or instead of) the LLM-API pipeline.
---

# Motife video generation (skill mode)

You are the **semantic layer** and the **vision critic**: you write the
DSL document and you judge the rendered frames. The compiler and component
library own all layout, coordinates, easing, and animation — never try to
express those, they are not in the schema.

## Hard rules

- A document is valid only when `pnpm motife validate` says so — never
  hand-wave validation. Never construct/cast a `DslDocument` in TS.
- NEVER edit the checked-in eval docs (`src/dsl/docs/*.json`) — they are
  few-shot examples and a frame-pinned regression baseline. All work
  happens in a run directory under `out/runs/`.
- `doc.json` is the only file you edit; `doc.tts.json` is derived — after
  any edit, re-run `motife tts` (its narration-hash cache re-synthesizes
  only scenes whose narration changed).

## Workflow

1. **Study the format.** Read [docs/dsl-schema.md](../../../docs/dsl-schema.md)
   and skim one real document (e.g. `src/dsl/docs/jwt-auth.json`).
2. **Write the document.** Create `out/runs/<slug>/doc.json`: four-beat
   narrative (intro → breakdown → walkthrough → summary), narration in the
   user's language (default zh-TW) at a comfortable ~8 chars/sec for the
   provisional `durationInSeconds`.
3. **Validate until clean** (the issue report is written to be followed
   literally — path, message, fix):

   ```bash
   pnpm motife validate out/runs/<slug>/doc.json
   ```

4. **Narration audio** (needs `OPENAI_API_KEY` or ElevenLabs keys; if no
   TTS key is available, skip this step — durations then stay your
   estimates):

   ```bash
   pnpm motife tts --run out/runs/<slug>
   ```

5. **Render + stills:**

   ```bash
   pnpm motife render --run out/runs/<slug>
   pnpm motife stills --run out/runs/<slug> --iter 1
   ```

6. **Be the critic.** Read every still yourself and check: element
   overlap/collision, text overflow or clipping, content off-screen, weak
   contrast, large dead regions, caption band truncated or covering
   content, visual density vs narration. Fixes must be DSL-expressible:
   reorder/remove/reword content, change emphasis/size/layout node
   choices, split a scene — never pixels.
7. **Revise** `doc.json`, then repeat steps 3–6 with `--iter 2`. Do at
   most 2 revision rounds; ship the best cut as
   `pnpm motife render --run out/runs/<slug> --out out/runs/<slug>/final.mp4`
   and summarize any unresolved issues.

CLI/env details: [docs/agent-pipeline.md](../../../docs/agent-pipeline.md).
