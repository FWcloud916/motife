// Phase 1 acceptance rebuild of scenes/Walkthrough.tsx — the hardest
// target in the rebuild: the original hardcodes each step's start frame
// (STEPS = [{start: 35}, {start: 145}, ...]) coupled to one fixed 18s
// duration. Here the left checklist and the right detail panel both
// derive their timing from the same resolveSteps()/stepStateAtFrame()
// call against STEPS_WINDOW — change the scene's duration and every
// boundary re-times itself, nothing here needs to change.
import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Callout,
  CodeBlock,
  Diagram,
  Icon,
  Scene,
  StepReveal,
  clampExtrapolate,
  reveal,
  resolveSteps,
  stepStateAtFrame,
  tokens,
} from "../../../../components";
import type { GraphSpec, Step, Window } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const STEPS: Step[] = [
  { title: "Extract token", detail: "讀取 Authorization header", weight: 1 },
  { title: "Verify signature", detail: "用可信任的 key 驗章", weight: 1 },
  { title: "Validate claims", detail: "檢查 exp · iss · aud", weight: 1 },
  { title: "Authorize", detail: "套用角色與權限", weight: 0.6 },
];

const STEPS_WINDOW: Window = { from: 0.05, to: 0.98 };

const NETWORK_GRAPH: GraphSpec = {
  direction: "right",
  nodes: [
    { id: "client", icon: "browser", label: "Client", tone: "syntaxB" },
    { id: "apiServer", icon: "server", label: "API Server", tone: "info" },
  ],
  edges: [{ from: "client", to: "apiServer" }],
};

const CLAIM_STEPS: Step[] = [
  { title: "exp", detail: "尚未過期" },
  { title: "iss", detail: "簽發者正確" },
  { title: "aud", detail: "受眾符合" },
];

export const Walkthrough: FC<SceneProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  const ranges = resolveSteps(STEPS, STEPS_WINDOW, durationInFrames);
  const states = ranges.map((range) => stepStateAtFrame(frame, range));
  const activeIndex = (() => {
    const active = states.indexOf("active");
    if (active >= 0) return active;
    return states.every((s) => s !== "pending") ? states.length - 1 : 0;
  })();
  const grantedProgress = reveal(frame, ranges[3].startFrame + 12);

  return (
    <Scene
      durationInFrames={durationInFrames}
      background={{ variant: "grid", glow: "info" }}
      header={{ eyebrow: "02 · Verification", title: "API 如何驗證 JWT？" }}
      caption="JWT 不是「解開就相信」：簽章與 claims 必須全部通過，請求才能被授權。"
    >
      <div style={{ display: "flex", height: "100%", gap: tokens.spacing.lg }}>
        <div style={{ width: 430 }}>
          <Callout variant="card" emphasis="medium" size="lg">
            <StepReveal label="SERVER CHECKLIST" steps={STEPS} window={STEPS_WINDOW} />
          </Callout>
        </div>

        <div style={{ flex: 1 }}>
          <Callout
            variant="card"
            tone={activeIndex === 3 ? "success" : "info"}
            emphasis="medium"
            size="lg"
          >
            <div
              style={{
                alignSelf: "stretch",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: tokens.spacing.lg,
              }}
            >
              <div
                style={{
                  color: tokens.color.text,
                  fontFamily: tokens.fontFamily.sans,
                  fontSize: tokens.fontSize.sm,
                  fontWeight: 720,
                }}
              >
                GET /api/profile
              </div>
              <Callout
                variant="pill"
                tone={activeIndex === 3 ? "success" : "info"}
                text={activeIndex === 3 ? "200 AUTHORIZED" : "VERIFYING"}
              />
            </div>

            <div style={{ alignSelf: "stretch", height: 190, marginBottom: tokens.spacing.md }}>
              <Diagram
                graph={NETWORK_GRAPH}
                activeNodes={activeIndex > 0 ? ["apiServer"] : []}
                reveal={{ window: { from: 0, to: 0.05 } }}
                flows={[
                  {
                    edge: "client->apiServer",
                    window: {
                      from: ranges[0].startFrame / durationInFrames,
                      to: ranges[0].endFrame / durationInFrames,
                    },
                    tone: "syntaxB",
                    label: "Authorization: Bearer JWT",
                  },
                ]}
              />
            </div>

            <div style={{ alignSelf: "stretch", flex: 1 }}>
              {activeIndex === 0 ? (
                <CodeBlock
                  size="sm"
                  lines={[
                    {
                      segments: [
                        { text: "Authorization: ", tone: "syntaxB" },
                        "Bearer eyJhbGci...SflKxw",
                      ],
                    },
                  ]}
                />
              ) : null}

              {activeIndex === 1 ? (
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: tokens.spacing.md }}
                  >
                    <Icon name="key" tone="syntaxC" size="lg" />
                    <div>
                      <div
                        style={{
                          color: tokens.color.tone.syntaxC.fg,
                          fontFamily: tokens.fontFamily.sans,
                          fontSize: tokens.fontSize.xs,
                          fontWeight: 780,
                        }}
                      >
                        RECOMPUTE SIGNATURE
                      </div>
                      <div
                        style={{
                          color: tokens.color.text,
                          fontFamily: tokens.fontFamily.mono,
                          fontSize: tokens.fontSize.xs,
                          marginTop: 10,
                        }}
                      >
                        HMACSHA256(base64url(header)+&apos;.&apos;+base64url(payload), secret)
                        === signature
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 7,
                      borderRadius: tokens.radius.pill,
                      background: tokens.color.line,
                      marginTop: tokens.spacing.md,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${interpolate(frame, [ranges[1].startFrame, ranges[1].endFrame], [0, 100], clampExtrapolate)}%`,
                        background: tokens.color.tone.syntaxC.fg,
                        boxShadow: `0 0 16px ${tokens.color.tone.syntaxC.fg}`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {activeIndex === 2 ? (
                <StepReveal
                  layout="row"
                  steps={CLAIM_STEPS}
                  window={{
                    from: ranges[2].startFrame / durationInFrames,
                    to: ranges[2].endFrame / durationInFrames,
                  }}
                />
              ) : null}

              {activeIndex === 3 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    opacity: grantedProgress,
                    transform: `scale(${interpolate(grantedProgress, [0, 1], [0.88, 1], clampExtrapolate)})`,
                  }}
                >
                  <Callout
                    variant="banner"
                    tone="success"
                    icon="shield"
                    text="Access granted"
                    detail="role: admin · scope: profile:read"
                  />
                </div>
              ) : null}
            </div>
          </Callout>
        </div>
      </div>
    </Scene>
  );
};
