import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";
import {
  Caption,
  Card,
  FlowLine,
  GridBackdrop,
  Icon,
  Noise,
  Pill,
  SceneHeader,
  clamp,
  enter,
} from "../visuals";

const STEPS = [
  { title: "Extract token", detail: "讀取 Authorization header", start: 35 },
  { title: "Verify signature", detail: "用可信任的 key 驗章", start: 145 },
  { title: "Validate claims", detail: "檢查 exp · iss · aud", start: 270 },
  { title: "Authorize", detail: "套用角色與權限", start: 410 },
] as const;

const StepItem: React.FC<{
  index: number;
  title: string;
  detail: string;
  active: boolean;
  done: boolean;
  progress: number;
}> = ({ index, title, detail, active, done, progress }) => {
  const color = done ? theme.color.mint : active ? theme.color.cyan : theme.color.textMuted;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 18,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 17,
          display: "grid",
          placeItems: "center",
          color,
          background: `${color}15`,
          border: `1px solid ${color}66`,
          fontSize: 20,
          fontWeight: 850,
          boxShadow: active ? `0 0 28px ${color}22` : undefined,
        }}
      >
        {done ? "✓" : index + 1}
      </div>
      <div>
        <div style={{ color, fontSize: 25, fontWeight: 760, marginBottom: 7 }}>{title}</div>
        <div style={{ color: theme.color.textMuted, fontSize: 19 }}>{detail}</div>
      </div>
    </div>
  );
};

export const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const requestProgress = interpolate(frame, [55, 125], [0, 1], clamp);
  const signatureProgress = interpolate(frame, [170, 232], [0, 1], clamp);
  const claimsProgress = interpolate(frame, [292, 380], [0, 1], clamp);
  const grantedProgress = interpolate(frame, [426, 475], [0, 1], clamp);
  const activeIndex = frame < 145 ? 0 : frame < 270 ? 1 : frame < 410 ? 2 : 3;

  return (
    <AbsoluteFill
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <GridBackdrop glow={theme.color.cyan} />
      <Noise />
      <SceneHeader eyebrow="02 · Verification" title="API 如何驗證 JWT？" frame={frame} />

      <Card
        style={{
          position: "absolute",
          left: 96,
          top: 250,
          width: 430,
          height: 650,
          padding: "38px 34px",
        }}
      >
        <div
          style={{
            color: theme.color.textMuted,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 3,
            marginBottom: 38,
          }}
        >
          SERVER CHECKLIST
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 46 }}>
          {STEPS.map((step, index) => (
            <StepItem
              key={step.title}
              index={index}
              title={step.title}
              detail={step.detail}
              active={index === activeIndex}
              done={index < activeIndex || grantedProgress === 1}
              progress={enter(frame, step.start - 18)}
            />
          ))}
        </div>
      </Card>

      <Card
        accent={activeIndex === 3 ? theme.color.mint : theme.color.cyan}
        style={{
          position: "absolute",
          left: 560,
          right: 96,
          top: 250,
          height: 650,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 82,
            borderBottom: `1px solid ${theme.color.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 34px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: activeIndex === 3 ? theme.color.mint : theme.color.cyan,
                boxShadow: `0 0 18px ${activeIndex === 3 ? theme.color.mint : theme.color.cyan}`,
              }}
            />
            <span style={{ color: theme.color.text, fontSize: 24, fontWeight: 720 }}>
              GET /api/profile
            </span>
          </div>
          <Pill color={activeIndex === 3 ? theme.color.mint : theme.color.cyan}>
            {activeIndex === 3 ? "200 AUTHORIZED" : "VERIFYING"}
          </Pill>
        </div>

        <div style={{ position: "absolute", inset: "82px 0 0" }}>
          <div
            style={{
              position: "absolute",
              left: 66,
              top: 62,
              width: 210,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 94,
                height: 94,
                borderRadius: 28,
                display: "grid",
                placeItems: "center",
                background: `${theme.color.payload}16`,
                border: `1px solid ${theme.color.payload}55`,
              }}
            >
              <Icon name="browser" color={theme.color.payload} size={58} />
            </div>
            <div style={{ color: theme.color.text, fontSize: 25, fontWeight: 750 }}>Client</div>
          </div>

          <div style={{ position: "absolute", left: 270, top: 75 }}>
            <FlowLine progress={requestProgress} label="Authorization: Bearer JWT" width={770} />
          </div>

          <div
            style={{
              position: "absolute",
              right: 70,
              top: 62,
              width: 210,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 94,
                height: 94,
                borderRadius: 28,
                display: "grid",
                placeItems: "center",
                background: `${theme.color.cyan}16`,
                border: `1px solid ${theme.color.cyan}55`,
                boxShadow: activeIndex > 0 ? `0 0 32px ${theme.color.cyan}22` : undefined,
              }}
            >
              <Icon name="server" color={theme.color.cyan} size={58} />
            </div>
            <div style={{ color: theme.color.text, fontSize: 25, fontWeight: 750 }}>API Server</div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 52,
              right: 52,
              bottom: 44,
              height: 260,
              borderRadius: theme.radius.md,
              background: "#071321cc",
              border: `1px solid ${theme.color.line}`,
              padding: "30px 34px",
            }}
          >
            {activeIndex === 0 ? (
              <div style={{ opacity: enter(frame, 66) }}>
                <div style={{ color: theme.color.textMuted, fontSize: 18, marginBottom: 20 }}>
                  REQUEST HEADER
                </div>
                <div
                  style={{
                    color: theme.color.text,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 24,
                    lineHeight: 1.7,
                  }}
                >
                  <span style={{ color: theme.color.payload }}>Authorization:</span>{" "}
                  Bearer eyJhbGci...SflKxw
                </div>
              </div>
            ) : null}

            {activeIndex === 1 ? (
              <div style={{ opacity: signatureProgress }}>
                <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
                  <Icon name="key" color={theme.color.signature} size={70} />
                  <div>
                    <div style={{ color: theme.color.signature, fontSize: 23, fontWeight: 780 }}>
                      RECOMPUTE SIGNATURE
                    </div>
                    <div
                      style={{
                        color: theme.color.text,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 21,
                        marginTop: 14,
                      }}
                    >
                      HMAC(header.payload, secret) === signature
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    height: 7,
                    borderRadius: theme.radius.pill,
                    background: theme.color.line,
                    marginTop: 34,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${signatureProgress * 100}%`,
                      background: theme.color.signature,
                      boxShadow: `0 0 16px ${theme.color.signature}`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {activeIndex === 2 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 18,
                }}
              >
                {[
                  ["exp", "尚未過期"],
                  ["iss", "簽發者正確"],
                  ["aud", "受眾符合"],
                ].map(([claim, label], index) => {
                  const progress = interpolate(
                    claimsProgress,
                    [index * 0.28, index * 0.28 + 0.38],
                    [0, 1],
                    clamp,
                  );
                  return (
                    <div
                      key={claim}
                      style={{
                        padding: "25px 20px",
                        borderRadius: theme.radius.sm,
                        background: `${theme.color.mint}0d`,
                        border: `1px solid ${progress > 0.7 ? theme.color.mint : theme.color.line}`,
                        opacity: interpolate(progress, [0, 1], [0.42, 1], clamp),
                      }}
                    >
                      <div style={{ color: theme.color.mint, fontSize: 29, fontWeight: 820 }}>
                        {progress > 0.72 ? "✓ " : "· "}
                        {claim}
                      </div>
                      <div style={{ color: theme.color.textMuted, fontSize: 18, marginTop: 12 }}>
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeIndex === 3 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 30,
                  opacity: grantedProgress,
                  transform: `scale(${interpolate(grantedProgress, [0, 1], [0.88, 1], clamp)})`,
                }}
              >
                <div
                  style={{
                    width: 104,
                    height: 104,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 32,
                    background: `${theme.color.mint}16`,
                    border: `1px solid ${theme.color.mint}66`,
                  }}
                >
                  <Icon name="shield" color={theme.color.mint} size={70} />
                </div>
                <div>
                  <div style={{ color: theme.color.mint, fontSize: 35, fontWeight: 820 }}>
                    Access granted
                  </div>
                  <div style={{ color: theme.color.textMuted, fontSize: 21, marginTop: 10 }}>
                    role: admin · scope: profile:read
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Caption frame={frame}>
        JWT 不是「解開就相信」：簽章與 claims 必須全部通過，請求才能被授權。
      </Caption>
    </AbsoluteFill>
  );
};
