// Phase 1 acceptance rebuild of scenes/Summary.tsx. Deliberately omits
// Scene's `caption` prop, same as the original: this scene has never
// rendered the storyboard's summary narration (see storyboard.ts).
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { Callout, Icon, Scene, reveal, tokens } from "../../../../components";
import type { IconName, Tone } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const RULES: Array<{ number: string; title: string; detail: string; icon: IconName; tone: Tone }> = [
  { number: "01", title: "Verify signature", detail: "只信任你允許的演算法與 key", icon: "key", tone: "success" },
  { number: "02", title: "Validate claims", detail: "檢查 exp、iss、aud 與權限", icon: "shield", tone: "success" },
  { number: "03", title: "Payload is public", detail: "不要放密碼或任何敏感資料", icon: "user", tone: "warning" },
];

export const Summary: FC<SceneProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const footerIn = reveal(frame, 110);

  return (
    <Scene
      durationInFrames={durationInFrames}
      background={{ variant: "grid", glow: "success" }}
      header={{
        eyebrow: "THE TAKEAWAY",
        title: "驗證完整性，不是隱藏內容",
        tone: "success",
        scale: "hero",
      }}
    >
      <div style={{ display: "flex", height: "100%", alignItems: "center" }}>
        <div style={{ display: "flex", gap: tokens.spacing.lg, width: "100%" }}>
          {RULES.map((rule, index) => (
            <div key={rule.number} style={{ flex: 1 }}>
              <Callout
                variant="card"
                tone={rule.tone}
                emphasis="medium"
                size="lg"
                window={{ from: 0.13 + index * 0.08, to: 0.13 + index * 0.08 + 0.25 }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      color: tokens.color.tone[rule.tone].fg,
                      fontFamily: tokens.fontFamily.sans,
                      fontSize: tokens.fontSize.xs,
                      fontWeight: 850,
                      letterSpacing: 2,
                    }}
                  >
                    {rule.number}
                  </div>
                  <Icon name={rule.icon} tone={rule.tone} />
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    color: tokens.color.text,
                    fontFamily: tokens.fontFamily.sans,
                    fontSize: tokens.fontSize.md,
                    fontWeight: 780,
                    marginTop: tokens.spacing.lg,
                  }}
                >
                  {rule.title}
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    color: tokens.color.textMuted,
                    fontFamily: tokens.fontFamily.sans,
                    fontSize: tokens.fontSize.sm,
                    lineHeight: 1.55,
                    marginTop: tokens.spacing.sm,
                  }}
                >
                  {rule.detail}
                </div>
              </Callout>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: tokens.spacing.xl,
          right: tokens.spacing.xl,
          bottom: tokens.spacing.lg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.spacing.md,
          opacity: footerIn,
          color: tokens.color.textMuted,
          fontFamily: tokens.fontFamily.sans,
          fontSize: tokens.fontSize.sm,
        }}
      >
        <Icon name="shield" tone="info" size="sm" />
        <span>
          <strong style={{ color: tokens.color.text }}>Sign · Verify · Authorize</strong>
          {" — "}這就是 JWT 的信任鏈
        </span>
      </div>
    </Scene>
  );
};
