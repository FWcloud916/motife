// Keyless end-to-end proof of the narration-audio render path — the half
// of Phase 3's TTS integration that `pnpm smoke` can't see: the audio
// sidecar riding through inputProps, calculateMetadata's passthrough,
// <Audio src={staticFile(...)}> resolving against bundle({publicDir}),
// and the per-scene delaySeconds <Sequence>. No TTS API is involved on
// purpose: the input WAVs are synthesized right here in Node (44-byte
// RIFF header + sine PCM), because what's under test is the renderer
// side, not the synthesis side (src/tts/ has its own unit tests).
//
// The render itself uses codec "wav" — the same composition and audio
// mix as an mp4 render, minus the video/AAC encode — so the output is
// raw PCM we can assert on WITHOUT any decoder: Remotion's mp4 AAC track
// is CBR (constant packet sizes, and it muxes a silent track even with
// no <Audio> mounted), so "an audio track exists" or packet-size
// heuristics prove nothing; actual sample RMS does.
//
// Usage: pnpm smoke:audio   (part of `pnpm verify`)
//
// Same bundle() -> selectComposition() -> renderMedia() shape as
// scripts/render-dsl.mjs, and the same one-shared-inputProps-object
// discipline CLAUDE.md requires.

import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const SAMPLE_RATE = 44100;

/** 16-bit mono PCM WAV of a sine tone — a valid audio file with zero
 * dependencies. */
function makeWav(seconds, frequency) {
  const sampleCount = Math.round(seconds * SAMPLE_RATE);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < sampleCount; i++) {
    const amplitude = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * 0.4 * 0x7fff;
    buffer.writeInt16LE(Math.round(amplitude), 44 + i * 2);
  }
  return buffer;
}

/** Minimal RIFF walker for the RENDERED wav (which need not put `data` at
 * a fixed offset): returns 16-bit PCM samples plus the sample rate. */
function readWav(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("audio-smoke: rendered output is not a RIFF/WAVE file");
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        pcm: buffer.readUInt16LE(body) === 1,
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = buffer.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  if (!format || !data) throw new Error("audio-smoke: wav is missing fmt/data chunks");
  if (!format.pcm || format.bitsPerSample !== 16) {
    throw new Error(`audio-smoke: expected 16-bit PCM, got ${JSON.stringify(format)}`);
  }
  return { format, data };
}

/** RMS (0..1) of the interleaved 16-bit samples between two timestamps. */
function rmsBetween({ format, data }, fromSeconds, toSeconds) {
  const bytesPerFrame = 2 * format.channels;
  const start = Math.floor(fromSeconds * format.sampleRate) * bytesPerFrame;
  const end = Math.min(Math.floor(toSeconds * format.sampleRate) * bytesPerFrame, data.length);
  let sum = 0;
  let count = 0;
  for (let i = start; i + 1 < end; i += 2) {
    const sample = data.readInt16LE(i) / 0x8000;
    sum += sample * sample;
    count++;
  }
  // Remotion trims trailing silence from wav output, so a window past the
  // end of the data IS silence — return 0 rather than erroring. Tone
  // checks in a truncated file still fail correctly (0 < threshold).
  if (count === 0) return 0;
  return Math.sqrt(sum / count);
}

// Minimal valid document: four beats, 2s each (room for the 0.3s delay +
// 1s tone inside every scene) — mirrors Root.tsx's BLANK_DOC shape.
const SCENES = ["intro", "breakdown", "walkthrough", "summary"];
const DOC = {
  version: 1,
  id: "AudioSmoke",
  title: "Audio Smoke",
  scenes: SCENES.map((id) => ({
    id,
    beat: id,
    durationInSeconds: 2,
    narration: "A one-second test tone plays.",
    content: { type: "pill", text: id },
  })),
};

async function main() {
  const root = path.join("out", "audio-smoke");
  const publicDir = path.resolve(root, "public");
  const audioDir = path.join(publicDir, "audio");
  await fs.mkdir(audioDir, { recursive: true });

  // A different pitch per scene: if scene→audio mapping ever crossed
  // wires, per-window RMS would still pass but the pitches would lie —
  // and a future stricter check (FFT) could tell them apart.
  const audio = { scenes: {} };
  for (const [index, id] of SCENES.entries()) {
    await fs.writeFile(path.join(audioDir, `${id}.wav`), makeWav(1, 330 + index * 110));
    audio.scenes[id] = { src: `audio/${id}.wav`, delaySeconds: 0.3 };
  }

  await ensureBrowser();
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    rspack: true,
    publicDir,
  });

  // One object, reused for both calls below (CLAUDE.md).
  const inputProps = { doc: DOC, audio };

  const composition = await selectComposition({
    serveUrl,
    id: "DslPreview",
    inputProps,
  });

  const outPath = path.join(root, "audio-smoke.wav");
  await renderMedia({
    composition,
    serveUrl,
    codec: "wav",
    outputLocation: outPath,
    inputProps,
    overwrite: true,
  });

  const wav = readWav(await fs.readFile(outPath));

  // Sanity: audio must span at least through the last scene's tone
  // (ends at 7.3s) — Remotion trims trailing silence, so the file being
  // shorter than the 8s video is expected, but shorter than the last
  // tone means a scene lost its narration.
  const audioSeconds = wav.data.length / (2 * wav.format.channels * wav.format.sampleRate);
  if (audioSeconds < 7.25) {
    throw new Error(
      `audio-smoke: audio spans only ${audioSeconds.toFixed(2)}s — the last scene's ` +
        `narration (6.3s–7.3s) is missing from the mix.`,
    );
  }

  // Scene N occupies [2N, 2N+2); its tone plays [2N+0.3, 2N+1.3).
  const checks = [
    // Pre-delay silence at the head of scene 1 — proves delaySeconds
    // actually delays (an un-delayed mount would put tone here).
    { label: "intro pre-delay silence", from: 0.02, to: 0.25, expectTone: false },
    { label: "intro tone", from: 0.45, to: 1.15, expectTone: true },
    // Post-tone tail of scene 1 — proves audio doesn't smear across time.
    { label: "intro tail silence", from: 1.5, to: 1.95, expectTone: false },
    // The LAST scene's tone — proves per-scene mapping survived to the
    // end of the timeline, not just the first mount.
    { label: "summary tone", from: 6.45, to: 7.15, expectTone: true },
    { label: "summary tail silence", from: 7.5, to: 7.95, expectTone: false },
  ];

  const failures = [];
  for (const check of checks) {
    const rms = rmsBetween(wav, check.from, check.to);
    const pass = check.expectTone ? rms > 0.1 : rms < 0.01;
    console.log(
      `audio-smoke: ${check.label} (${check.from}s–${check.to}s) rms=${rms.toFixed(4)} ` +
        `${pass ? "ok" : "FAIL"}`,
    );
    if (!pass) failures.push(check.label);
  }
  if (failures.length > 0) {
    throw new Error(
      `audio-smoke: FAILED — ${failures.join(", ")}. The narration sidecar was dropped or ` +
        `mis-timed between inputProps and the audio mix.`,
    );
  }
  console.log(`audio-smoke: OK -> ${outPath} (${wav.format.channels}ch @ ${wav.format.sampleRate}Hz)`);
}

main().catch((error) => {
  console.error("audio-smoke: FAILED");
  console.error(error);
  process.exit(1);
});
