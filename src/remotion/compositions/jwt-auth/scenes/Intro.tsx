// Phase 2 rewrite of Intro.tsx, using only the Stage 1 semantic primitives
// (Stack/Text/Diagram/CodeBlock/Callout) — zero raw `<div style>`, zero
// useCurrentFrame(). This is the shape the Phase 2 DSL will emit directly;
// see docs/component-library.md for the primitive reference.
import type { FC } from "react";
import { Callout, CodeBlock, Diagram, Scene, Stack, Text } from "../../../../components";
import type { GraphSpec } from "../../../../components";

interface SceneProps {
  durationInFrames: number;
}

const GRAPH: GraphSpec = {
  direction: "right",
  nodes: [
    { id: "client", icon: "browser", label: "Client", detail: "已登入的使用者", tone: "info" },
    { id: "authServer", icon: "server", label: "Auth Server", detail: "簽發 JWT", tone: "success" },
  ],
  edges: [{ from: "client", to: "authServer", label: "LOGIN" }],
};

export const Intro: FC<SceneProps> = ({ durationInFrames }) => (
  <Scene
    durationInFrames={durationInFrames}
    background={{ variant: "grid", glow: "success" }}
    caption="登入成功後，伺服器簽發 JWT；之後每次請求都帶著它證明身分。"
  >
    <Stack grow align="center" justify="center" gap="lg">
      <Stack align="center" gap="sm">
        <Callout variant="pill" tone="success" text="AUTHENTICATION, EXPLAINED" />
        <Text role="hero" content="JWT 驗證流程" align="center" />
        <Text role="subtitle" content="一張能被伺服器驗證的數位通行證" align="center" />
      </Stack>

      <Diagram
        graph={GRAPH}
        width="wide"
        fit="width"
        activeNodes={[{ node: "authServer", window: { from: 0.6, to: 1 } }]}
        reveal={{ window: { from: 0.23, to: 0.4 } }}
        flows={[
          {
            edge: "client->authServer",
            window: { from: 0.35, to: 0.58 },
            tone: "success",
            label: "LOGIN",
          },
        ]}
      />

      <Stack width="half">
        <CodeBlock
          size="sm"
          reveal={{ window: { from: 0.6, to: 0.75 } }}
          lines={[{ segments: [{ text: "eyJhbGci...eyJzdWI...SflKxw", tone: "success" }] }]}
        />
      </Stack>
    </Stack>
  </Scene>
);
