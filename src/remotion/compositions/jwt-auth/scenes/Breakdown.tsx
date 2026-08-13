// Phase 2 rewrite of Breakdown.tsx — see Intro.tsx for the primitive
// discipline this and the other three scenes now share.
import type { FC } from "react";
import { Callout, CodeBlock, Scene, Stack, Text } from "../../../../components";
import type { CodeLine, Tone } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const PARTS: Array<{
  label: string;
  value: string;
  codeLines: CodeLine[];
  tone: Tone;
  note: string;
}> = [
  {
    label: "HEADER",
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    codeLines: [
      { segments: ["{"] },
      { segments: ['"alg": "HS256",'], indent: 1 },
      { segments: ['"typ": "JWT"'], indent: 1 },
      { segments: ["}"] },
    ],
    tone: "syntaxA",
    note: "演算法與 token 類型",
  },
  {
    label: "PAYLOAD",
    value: "eyJzdWIiOiJ1c2VyXzQyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg2NTA3MjAwfQ",
    codeLines: [
      { segments: ["{"] },
      { segments: ['"sub": "user_42",'], indent: 1 },
      { segments: ['"role": "admin",'], indent: 1 },
      { segments: ['"exp": 1786507200'], indent: 1 },
      { segments: ["}"] },
    ],
    tone: "syntaxB",
    note: "Claims：身分與權限資料",
  },
  {
    label: "SIGNATURE",
    value: "SflKxwRJSMeKKF2QT4fwpMeJf36",
    codeLines: [
      { segments: ["HMACSHA256("] },
      { segments: ["base64url(header) + '.' +"], indent: 1 },
      { segments: ["base64url(payload), secret"], indent: 1 },
      { segments: [")"] },
    ],
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
    <Stack align="center" gap="lg">
      <Stack width="wide">
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
      </Stack>

      <Stack direction="row" gap="lg" width="full">
        {PARTS.map((part, index) => (
          <Callout
            key={part.label}
            variant="card"
            tone={part.tone}
            emphasis="medium"
            size="lg"
            grow
            window={{ from: 0.18 + index * 0.1, to: 0.18 + index * 0.1 + 0.3 }}
          >
            <Text role="label" tone={part.tone} content={`0${index + 1} / ${part.label}`} />
            <CodeBlock chrome="bare" size="sm" lines={part.codeLines} />
            <Text role="detail" content={part.note} />
          </Callout>
        ))}
      </Stack>

      <Callout
        variant="pill"
        tone="warning"
        text="⚠ Payload 是編碼，不是加密"
        window={{ from: 0.58, to: 0.65 }}
      />
    </Stack>
  </Scene>
);
