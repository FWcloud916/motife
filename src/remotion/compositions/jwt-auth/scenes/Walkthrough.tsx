// Phase 2 rewrite of Walkthrough.tsx — the hardest scene in the library:
// the left checklist and the right detail panel both derive their timing
// from the same stepWindows(CHECKS, CHECKS_WINDOW) call, so the two stay in
// sync purely by construction (the same discipline useSteps() established
// for StepReveal, now generalised to a symbolic-window/StepSwitch pair).
// Zero useCurrentFrame() and zero raw `<div style>` here — see Intro.tsx.
import type { FC } from "react";
import {
  Callout,
  CodeBlock,
  Diagram,
  Icon,
  Meter,
  Scene,
  Stack,
  StepReveal,
  StepSwitch,
  Text,
  stepWindows,
} from "../../../../components";
import type { GraphSpec, Step, Window } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const CHECKS: Step[] = [
  { title: "Extract token", detail: "讀取 Authorization header", weight: 1 },
  { title: "Verify signature", detail: "用可信任的 key 驗章", weight: 1 },
  { title: "Validate claims", detail: "檢查 exp · iss · aud", weight: 1 },
  { title: "Authorize", detail: "套用角色與權限", weight: 0.6 },
];

const CHECKS_WINDOW: Window = { from: 0.05, to: 0.98 };

// Every timed element on the right derives its window from this one array
// instead of re-deriving frame math per element — the fix for the fragility
// docs/component-library.md warns about (a sibling that recomputes the same
// boundaries independently can silently desync from the checklist).
const CHECKS_WINDOWS = stepWindows(CHECKS, CHECKS_WINDOW);

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

// Shared by both outer card-tone branches below — a Diagram plus the
// per-step detail panel. Reused by reference (not duplicated), and safe to
// share because StepSwitch only ever mounts one matching case at a time.
const diagramAndDetail = (
  <>
    <Diagram
      graph={NETWORK_GRAPH}
      activeNodes={[{ node: "apiServer", window: CHECKS_WINDOWS[1] }]}
      reveal={{ window: { from: 0, to: 0.05 } }}
      flows={[
        {
          edge: "client->apiServer",
          window: CHECKS_WINDOWS[0],
          tone: "syntaxB",
          label: "Authorization: Bearer JWT",
        },
      ]}
    />

    <StepSwitch
      stepWindows={CHECKS_WINDOWS}
      cases={[
        {
          steps: [0, 0],
          content: (
            <CodeBlock
              chrome="bare"
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
          ),
        },
        {
          steps: [1, 1],
          content: (
            <Stack gap="md">
              <Stack direction="row" align="center" gap="md">
                <Icon name="key" tone="syntaxC" size="lg" />
                <Stack gap="sm">
                  <Text role="label" tone="syntaxC" content="RECOMPUTE SIGNATURE" />
                  <CodeBlock
                    chrome="bare"
                    size="sm"
                    lines={[
                      {
                        segments: [
                          "HMACSHA256(base64url(header)+'.'+base64url(payload), secret) === signature",
                        ],
                      },
                    ]}
                  />
                </Stack>
              </Stack>
              <Meter tone="syntaxC" window={CHECKS_WINDOWS[1]} />
            </Stack>
          ),
        },
        {
          steps: [2, 2],
          content: <StepReveal layout="row" steps={CLAIM_STEPS} window={CHECKS_WINDOWS[2]} />,
        },
        {
          steps: [3, 3],
          content: (
            <Stack grow align="center" justify="center">
              <Callout
                variant="banner"
                tone="success"
                icon="shield"
                text="Access granted"
                detail="role: admin · scope: profile:read"
                window={{ from: CHECKS_WINDOWS[3].from + 0.02, to: CHECKS_WINDOWS[3].to }}
              />
            </Stack>
          ),
        },
      ]}
    />
  </>
);

export const Walkthrough: FC<SceneProps> = ({ durationInFrames }) => (
  <Scene
    durationInFrames={durationInFrames}
    background={{ variant: "grid", glow: "info" }}
    header={{ eyebrow: "02 · Verification", title: "API 如何驗證 JWT？" }}
    caption="JWT 不是「解開就相信」：簽章與 claims 必須全部通過，請求才能被授權。"
  >
    <Stack direction="row" grow gap="lg" align="stretch">
      <Callout variant="card" emphasis="medium" size="lg" width="narrow">
        <StepReveal label="SERVER CHECKLIST" steps={CHECKS} window={CHECKS_WINDOW} />
      </Callout>

      <StepSwitch
        stepWindows={CHECKS_WINDOWS}
        cases={[
          {
            steps: [0, 2],
            content: (
              <Callout variant="card" tone="info" emphasis="medium" size="lg" grow>
                <Stack direction="row" justify="between" align="center">
                  <Text role="label" content="GET /api/profile" />
                  <Callout variant="pill" tone="info" text="VERIFYING" />
                </Stack>
                {diagramAndDetail}
              </Callout>
            ),
          },
          {
            steps: [3, 3],
            content: (
              <Callout variant="card" tone="success" emphasis="medium" size="lg" grow>
                <Stack direction="row" justify="between" align="center">
                  <Text role="label" content="GET /api/profile" />
                  <Callout variant="pill" tone="success" text="200 AUTHORIZED" />
                </Stack>
                {diagramAndDetail}
              </Callout>
            ),
          },
        ]}
      />
    </Stack>
  </Scene>
);
