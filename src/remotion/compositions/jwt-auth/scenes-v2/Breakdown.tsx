// Phase 1 acceptance rebuild of scenes/Breakdown.tsx — see that file for
// the original this reproduces using only src/components.
import type { FC } from "react";
import { Callout, CodeBlock, Scene, tokens } from "../../../../components";
import type { Tone } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const PARTS: Array<{
  label: string;
  value: string;
  code: string;
  tone: Tone;
  note: string;
}> = [
  {
    label: "HEADER",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    code: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
    tone: "syntaxA",
    note: "演算法與 token 類型",
  },
  {
    label: "PAYLOAD",
    value: "eyJzdWIiOiJ1c2VyXzQyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg2NTA3MjAwfQ",
    code: '{\n  "sub": "user_42",\n  "role": "admin",\n  "exp": 1786507200\n}',
    tone: "syntaxB",
    note: "Claims：身分與權限資料",
  },
  {
    label: "SIGNATURE",
    value: "SflKxwRJSMeKKF2QT4fwpMeJf36",
    code: "HMACSHA256(\n  base64url(header) + '.' +\n  base64url(payload), secret\n)",
    tone: "syntaxC",
    note: "證明內容未被竄改",
  },
];

export const Breakdown: FC<SceneProps> = ({ durationInFrames }) => (
  <Scene
    durationInFrames={durationInFrames}
    background={{ variant: "grid", glow: "syntaxB" }}
    header={{ eyebrow: "01 · Anatomy", title: "JWT 裡面有什麼？" }}
    caption="Header 和 Payload 任何人都能解碼；Signature 才是防竄改的關鍵。"
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacing.lg,
      }}
    >
      <CodeBlock
        size="sm"
        reveal={{ window: { from: 0.08, to: 0.2 } }}
        lines={[
          {
            segments: PARTS.reduce<Array<string | { text: string; tone: Tone }>>(
              (segments, part, index) => {
                if (index > 0) segments.push(".");
                segments.push({ text: part.value, tone: part.tone });
                return segments;
              },
              [],
            ),
          },
        ]}
      />

      <div style={{ display: "flex", gap: tokens.spacing.lg, width: "100%" }}>
        {PARTS.map((part, index) => (
          <div key={part.label} style={{ flex: 1 }}>
            <Callout
              variant="card"
              tone={part.tone}
              emphasis="medium"
              size="lg"
              window={{ from: 0.18 + index * 0.1, to: 0.18 + index * 0.1 + 0.3 }}
            >
              <div
                style={{
                  alignSelf: "flex-start",
                  color: tokens.color.tone[part.tone].fg,
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: tokens.fontSize.xs,
                  fontWeight: 850,
                  letterSpacing: 3,
                }}
              >
                0{index + 1} / {part.label}
              </div>
              <pre
                style={{
                  alignSelf: "flex-start",
                  color: tokens.color.text,
                  fontFamily: tokens.fontFamily.mono,
                  fontSize: tokens.fontSize.sm,
                  lineHeight: 1.55,
                  margin: `${tokens.spacing.md}px 0`,
                  minHeight: 130,
                  whiteSpace: "pre-wrap",
                }}
              >
                {part.code}
              </pre>
              <div
                style={{
                  alignSelf: "stretch",
                  color: tokens.color.textMuted,
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: tokens.fontSize.xs,
                  borderTop: `1px solid ${tokens.color.line}`,
                  paddingTop: tokens.spacing.sm,
                }}
              >
                {part.note}
              </div>
            </Callout>
          </div>
        ))}
      </div>

      <Callout
        variant="pill"
        tone="warning"
        text="⚠ Payload 是編碼，不是加密"
        window={{ from: 0.58, to: 0.65 }}
      />
    </div>
  </Scene>
);
