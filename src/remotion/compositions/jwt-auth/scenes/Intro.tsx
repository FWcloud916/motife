import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";
import {
  Caption,
  FlowLine,
  GridBackdrop,
  Noise,
  NodeCard,
  Pill,
  clamp,
  enter,
} from "../visuals";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const titleIn = enter(frame, 4);
  const diagramIn = enter(frame, 42);
  const request = interpolate(frame, [64, 104], [0, 1], clamp);
  const response = interpolate(frame, [108, 150], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <GridBackdrop />
      <Noise />

      <div
        style={{
          position: "absolute",
          top: 82,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [24, 0], clamp)}px)`,
        }}
      >
        <Pill color={theme.color.mint}>AUTHENTICATION, EXPLAINED</Pill>
        <div
          style={{
            color: theme.color.text,
            fontSize: theme.fontSize.xl,
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
            color: theme.color.textMuted,
            fontSize: 28,
            marginTop: 20,
            letterSpacing: 1,
          }}
        >
          一張能被伺服器驗證的數位通行證
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 250,
          right: 250,
          top: 450,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: diagramIn,
          transform: `translateY(${interpolate(diagramIn, [0, 1], [28, 0], clamp)}px)`,
        }}
      >
        <NodeCard icon="browser" label="Client" detail="已登入的使用者" />
        <FlowLine progress={request} label="LOGIN" />
        <NodeCard
          icon="server"
          label="Auth Server"
          detail="簽發 JWT"
          color={theme.color.mint}
          active={response > 0.2}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 635,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: response,
          transform: `scale(${interpolate(response, [0, 1], [0.8, 1], clamp)})`,
        }}
      >
        <Pill color={theme.color.mint} style={{ fontFamily: "monospace" }}>
          eyJhbGci...eyJzdWI...SflKxw
        </Pill>
      </div>

      <Caption frame={frame}>
        登入成功後，伺服器簽發 JWT；之後每次請求都帶著它證明身分。
      </Caption>
    </AbsoluteFill>
  );
};
