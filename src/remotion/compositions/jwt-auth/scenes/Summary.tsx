import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";
import {
  Card,
  GridBackdrop,
  Icon,
  Noise,
  Pill,
  clamp,
  enter,
} from "../visuals";

const RULES = [
  { number: "01", title: "Verify signature", detail: "只信任你允許的演算法與 key" },
  { number: "02", title: "Validate claims", detail: "檢查 exp、iss、aud 與權限" },
  { number: "03", title: "Payload is public", detail: "不要放密碼或任何敏感資料" },
] as const;

export const Summary: React.FC = () => {
  const frame = useCurrentFrame();
  const heroIn = enter(frame, 3);

  return (
    <AbsoluteFill
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <GridBackdrop glow={theme.color.mint} />
      <Noise />

      <div
        style={{
          position: "absolute",
          left: 96,
          top: 92,
          opacity: heroIn,
          transform: `translateY(${interpolate(heroIn, [0, 1], [22, 0], clamp)}px)`,
        }}
      >
        <Pill color={theme.color.mint}>THE TAKEAWAY</Pill>
        <div
          style={{
            color: theme.color.text,
            fontSize: 82,
            fontWeight: 820,
            letterSpacing: -3.5,
            marginTop: 26,
          }}
        >
          驗證完整性，不是隱藏內容
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 340,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
        }}
      >
        {RULES.map((rule, index) => {
          const progress = enter(frame, 38 + index * 25);
          return (
            <Card
              key={rule.number}
              accent={index === 2 ? theme.color.warning : theme.color.mint}
              style={{
                height: 350,
                padding: 34,
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [34, 0], clamp)}px)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 55,
                }}
              >
                <div
                  style={{
                    color: index === 2 ? theme.color.warning : theme.color.mint,
                    fontSize: 23,
                    fontWeight: 850,
                    letterSpacing: 2,
                  }}
                >
                  {rule.number}
                </div>
                <Icon
                  name={index === 0 ? "key" : index === 1 ? "shield" : "user"}
                  color={index === 2 ? theme.color.warning : theme.color.mint}
                  size={54}
                />
              </div>
              <div style={{ color: theme.color.text, fontSize: 32, fontWeight: 780 }}>
                {rule.title}
              </div>
              <div
                style={{
                  color: theme.color.textMuted,
                  fontSize: 22,
                  lineHeight: 1.55,
                  marginTop: 17,
                }}
              >
                {rule.detail}
              </div>
            </Card>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          bottom: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          opacity: enter(frame, 110),
          color: theme.color.textMuted,
          fontSize: 24,
        }}
      >
        <Icon name="shield" color={theme.color.cyan} size={38} />
        <span>
          <strong style={{ color: theme.color.text }}>Sign · Verify · Authorize</strong>
          {" — "}這就是 JWT 的信任鏈
        </span>
      </div>
    </AbsoluteFill>
  );
};
