import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";
import {
  Caption,
  Card,
  GridBackdrop,
  Noise,
  SceneHeader,
  clamp,
  enter,
} from "../visuals";

const PARTS = [
  {
    label: "HEADER",
    // base64url(JSON.stringify(code)) — kept in sync by hand; verify with:
    // printf '%s' '{"alg":"HS256","typ":"JWT"}' | base64 | tr '+/' '-_' | tr -d '='
    value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    code: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
    color: theme.color.header,
    note: "演算法與 token 類型",
  },
  {
    label: "PAYLOAD",
    // base64url(JSON.stringify(code)) — see Header note above for how to verify.
    value: "eyJzdWIiOiJ1c2VyXzQyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg2NTA3MjAwfQ",
    code: '{\n  "sub": "user_42",\n  "role": "admin",\n  "exp": 1786507200\n}',
    color: theme.color.payload,
    note: "Claims：身分與權限資料",
  },
  {
    label: "SIGNATURE",
    // Illustrative placeholder, not a real HMAC output for the header/payload above.
    value: "SflKxwRJSMeKKF2QT4fwpMeJf36",
    code: "HMACSHA256(\n  base64url(header) + '.' +\n  base64url(payload), secret\n)",
    color: theme.color.signature,
    note: "證明內容未被竄改",
  },
] as const;

export const Breakdown: React.FC = () => {
  const frame = useCurrentFrame();
  const tokenIn = enter(frame, 25);

  return (
    <AbsoluteFill
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <GridBackdrop glow={theme.color.payload} />
      <Noise />
      <SceneHeader eyebrow="01 · Anatomy" title="JWT 裡面有什麼？" frame={frame} />

      <div
        style={{
          position: "absolute",
          top: 232,
          left: 96,
          right: 96,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          rowGap: 6,
          opacity: tokenIn,
          transform: `scale(${interpolate(tokenIn, [0, 1], [0.96, 1], clamp)})`,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 19,
          fontWeight: 650,
        }}
      >
        {PARTS.map((part, index) => (
          <div key={part.label} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ color: part.color }}>{part.value}</span>
            {index < PARTS.length - 1 ? (
              <span style={{ color: theme.color.textMuted, margin: "0 12px" }}>.</span>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: 330,
          left: 96,
          right: 96,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 26,
        }}
      >
        {PARTS.map((part, index) => {
          const progress = enter(frame, 58 + index * 34);
          return (
            <Card
              key={part.label}
              accent={part.color}
              style={{
                minHeight: 410,
                padding: 30,
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [34, 0], clamp)}px)`,
              }}
            >
              <div
                style={{
                  color: part.color,
                  fontSize: 20,
                  fontWeight: 850,
                  letterSpacing: 3,
                  marginBottom: 26,
                }}
              >
                0{index + 1} / {part.label}
              </div>
              <pre
                style={{
                  color: theme.color.text,
                  fontSize: index === 1 ? 22 : 24,
                  lineHeight: 1.55,
                  margin: 0,
                  minHeight: 232,
                  whiteSpace: "pre-wrap",
                }}
              >
                {part.code}
              </pre>
              <div
                style={{
                  color: theme.color.textMuted,
                  fontSize: 21,
                  borderTop: `1px solid ${theme.color.line}`,
                  paddingTop: 20,
                }}
              >
                {part.note}
              </div>
            </Card>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          right: 96,
          top: 76,
          color: theme.color.warning,
          background: `${theme.color.warning}12`,
          border: `1px solid ${theme.color.warning}55`,
          borderRadius: theme.radius.pill,
          padding: "13px 20px",
          fontSize: 21,
          fontWeight: 700,
          opacity: enter(frame, 175),
        }}
      >
        ⚠ Payload 是編碼，不是加密
      </div>

      <Caption frame={frame}>
        Header 和 Payload 任何人都能解碼；Signature 才是防竄改的關鍵。
      </Caption>
    </AbsoluteFill>
  );
};
