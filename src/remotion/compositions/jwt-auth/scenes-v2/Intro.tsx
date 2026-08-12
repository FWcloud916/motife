// Phase 1 acceptance rebuild of scenes/Intro.tsx — component-library only,
// hand-written props (motife-plan.md §3 Phase 1 acceptance: rebuild the
// baseline video from the library at quality no worse than the manual
// version). See ../scenes/Intro.tsx for the original.
import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Callout,
  CodeBlock,
  Diagram,
  Scene,
  clampExtrapolate,
  reveal,
  tokens,
} from "../../../../components";
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

export const Intro: FC<SceneProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const titleIn = reveal(frame, 4);

  return (
    <Scene
      durationInFrames={durationInFrames}
      background={{ variant: "grid", glow: "success" }}
      caption="登入成功後，伺服器簽發 JWT；之後每次請求都帶著它證明身分。"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: tokens.spacing.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0], clampExtrapolate)}px)`,
          }}
        >
          <Callout variant="pill" tone="success" text="AUTHENTICATION, EXPLAINED" />
          <div
            style={{
              color: tokens.color.text,
              fontFamily: tokens.fontFamily.sans,
              fontSize: tokens.fontSize.xl,
              lineHeight: 1,
              fontWeight: 820,
              letterSpacing: -5,
              marginTop: 28,
            }}
          >
            JWT 驗證流程
          </div>
          <div
            style={{
              color: tokens.color.textMuted,
              fontFamily: tokens.fontFamily.sans,
              fontSize: 28,
              marginTop: 20,
              letterSpacing: 1,
            }}
          >
            一張能被伺服器驗證的數位通行證
          </div>
        </div>

        <div style={{ width: 760, height: 260 }}>
          <Diagram
            graph={GRAPH}
            activeNodes={frame > 108 ? ["authServer"] : []}
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
        </div>

        <div style={{ width: 460 }}>
          <CodeBlock
            size="sm"
            reveal={{ window: { from: 0.6, to: 0.75 } }}
            lines={[{ segments: [{ text: "eyJhbGci...eyJzdWI...SflKxw", tone: "success" }] }]}
          />
        </div>
      </div>
    </Scene>
  );
};
