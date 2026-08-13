// Phase 2 rewrite of Summary.tsx. The footer is no longer absolutely
// positioned — it's simply the last child of a `justify="center"` root
// Stack (with a gap before it), which is what replaces Phase 1's
// `position: absolute` band (see docs/component-library.md's Stack
// reference).
import type { FC } from "react";
import { Callout, Icon, Scene, Stack, Text } from "../../../../components";
import type { IconName, Tone } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const RULES: Array<{ number: string; title: string; detail: string; icon: IconName; tone: Tone }> = [
  { number: "01", title: "Verify signature", detail: "只信任你允許的演算法與 key", icon: "key", tone: "success" },
  { number: "02", title: "Validate claims", detail: "檢查 exp、iss、aud 與權限", icon: "shield", tone: "success" },
  { number: "03", title: "Payload is public", detail: "不要放密碼或任何敏感資料", icon: "user", tone: "warning" },
];

export const Summary: FC<SceneProps> = ({ durationInFrames }) => (
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
    {/* justify="center" (not "between"): the cards row must NOT sit flush
        against the top of the content area — at this hero title size its
        line box comes close enough to HEADER_CLEARANCE that a flush card
        row visibly crowds it. Centering the [cards, footer] group
        reproduces Phase 1's original vertically-centered row and keeps a
        clear gap under the header, same as the baseline stills. */}
    <Stack grow justify="center" gap="xl">
      <Stack direction="row" align="center" gap="lg">
        {RULES.map((rule, index) => (
          <Callout
            key={rule.number}
            variant="card"
            tone={rule.tone}
            emphasis="medium"
            size="lg"
            grow
            window={{ from: 0.13 + index * 0.08, to: 0.13 + index * 0.08 + 0.25 }}
          >
            <Stack direction="row" justify="between" align="center">
              <Text role="label" tone={rule.tone} content={rule.number} />
              <Icon name={rule.icon} tone={rule.tone} />
            </Stack>
            <Text role="body" content={rule.title} />
            <Text role="detail" content={rule.detail} />
          </Callout>
        ))}
      </Stack>

      <Stack direction="row" align="center" justify="center" gap="md" window={{ from: 0.6, to: 1 }}>
        <Icon name="shield" tone="info" size="sm" />
        <Text
          role="detail"
          content={[{ text: "Sign · Verify · Authorize", strong: true }, " — 這就是 JWT 的信任鏈"]}
        />
      </Stack>
    </Stack>
  </Scene>
);
