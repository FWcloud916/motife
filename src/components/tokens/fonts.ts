import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadNotoSansTC } from "@remotion/google-fonts/NotoSansTC";

const SANS_WEIGHTS = ["400", "600", "700", "800"] as const;
const MONO_WEIGHTS = ["400", "600", "700"] as const;
// The chinese-traditional subset alone splits into ~100 unicode-range
// font-face chunks per weight (Google's CSS API), so each extra weight
// here multiplies real network requests at render startup — observed
// ~400 requests at 4 weights during smoke. Two weights (regular + bold)
// keep glyph coverage for narration/labels without that blowup; widen
// this only if a real scene needs an intermediate CJK weight.
const CJK_WEIGHTS = ["400", "700"] as const;

let loaded = false;

/**
 * Registers every font the component library depends on: Inter (Latin UI
 * text), Noto Sans TC (CJK narration/labels), JetBrains Mono (CodeBlock /
 * Terminal). @remotion/google-fonts manages delayRender()/continueRender()
 * internally, so every render (Studio, renderStill, renderMedia) waits for
 * real glyphs instead of silently falling back to whatever font the host
 * machine happens to have — the render-determinism gap the Phase 0 scenes
 * had. Call once, before RemotionRoot mounts; idempotent for safety.
 */
export function loadFonts(): void {
  if (loaded) return;
  loaded = true;
  loadInter("normal", { weights: [...SANS_WEIGHTS], subsets: ["latin"] });
  loadNotoSansTC("normal", {
    weights: [...CJK_WEIGHTS],
    subsets: ["chinese-traditional"],
    // The request count above is an accepted, documented trade-off (see
    // CJK_WEIGHTS comment), not an oversight — silence the per-render nag.
    ignoreTooManyRequestsWarning: true,
  });
  loadJetBrainsMono("normal", { weights: [...MONO_WEIGHTS], subsets: ["latin"] });
}
