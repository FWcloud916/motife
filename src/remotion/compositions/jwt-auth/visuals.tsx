import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { theme } from "../../theme";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const enter = (frame: number, delay = 0): number =>
  interpolate(frame, [delay, delay + 22], [0, 1], clamp);

export const GridBackdrop: React.FC<{ glow?: string }> = ({
  glow = theme.color.accent,
}) => (
  <AbsoluteFill style={{ backgroundColor: theme.color.bg, overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: "27%",
        top: "8%",
        width: "50%",
        height: "72%",
        borderRadius: "50%",
        background: glow,
        opacity: 0.12,
        filter: "blur(170px)",
      }}
    />
    <svg width="100%" height="100%" style={{ opacity: 0.22 }}>
      <defs>
        <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
          <path d="M72 0H0V72" fill="none" stroke={theme.color.line} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </AbsoluteFill>
);

export const Noise: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "soft-light" }}>
    <svg width="100%" height="100%">
      <filter id="noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          seed="7"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  </AbsoluteFill>
);

export const SceneHeader: React.FC<{
  eyebrow: string;
  title: string;
  frame: number;
  accent?: string;
}> = ({ eyebrow, title, frame, accent = theme.color.cyan }) => {
  const progress = enter(frame);
  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 96,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [18, 0], clamp)}px)`,
      }}
    >
      <div
        style={{
          color: accent,
          fontSize: theme.fontSize.xs,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: theme.color.text,
          fontSize: theme.fontSize.lg,
          fontWeight: 750,
          letterSpacing: -2.5,
        }}
      >
        {title}
      </div>
    </div>
  );
};

export const Pill: React.FC<{
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}> = ({ children, color = theme.color.cyan, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      color,
      background: `${color}15`,
      border: `1px solid ${color}55`,
      borderRadius: theme.radius.pill,
      padding: "10px 18px",
      fontSize: theme.fontSize.xs,
      fontWeight: 700,
      letterSpacing: 0.5,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card: React.FC<{
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
}> = ({ children, style, accent = theme.color.line }) => (
  <div
    style={{
      background: `linear-gradient(145deg, ${theme.color.surfaceRaised}f2, ${theme.color.surface}f2)`,
      border: `1px solid ${accent}88`,
      borderRadius: theme.radius.md,
      boxShadow: `0 28px 80px #0008, inset 0 1px 0 #ffffff0c`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Icon: React.FC<{
  name: "browser" | "server" | "key" | "shield" | "check" | "user";
  color?: string;
  size?: number;
}> = ({ name, color = theme.color.cyan, size = 52 }) => {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<typeof name, ReactNode> = {
    browser: (
      <>
        <rect x="4" y="6" width="40" height="34" rx="5" />
        <path d="M4 15h40M11 10.5h.1M17 10.5h.1" />
      </>
    ),
    server: (
      <>
        <rect x="7" y="5" width="34" height="13" rx="3" />
        <rect x="7" y="30" width="34" height="13" rx="3" />
        <path d="M13 11.5h.1M13 36.5h.1M20 11.5h15M20 36.5h15M24 18v12" />
      </>
    ),
    key: (
      <>
        <circle cx="17" cy="25" r="9" />
        <path d="M26 25h17M37 25v6M32 25v4" />
      </>
    ),
    shield: (
      <>
        <path d="M24 4 41 11v12c0 11-7 18-17 22C14 41 7 34 7 23V11Z" />
        <path d="m16 24 5 5 11-12" />
      </>
    ),
    check: <path d="m9 25 10 10L40 13" />,
    user: (
      <>
        <circle cx="24" cy="16" r="9" />
        <path d="M8 43c1-10 7-15 16-15s15 5 16 15" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
      {paths[name]}
    </svg>
  );
};

export const NodeCard: React.FC<{
  icon: "browser" | "server" | "key" | "shield" | "user";
  label: string;
  detail: string;
  color?: string;
  active?: boolean;
  style?: CSSProperties;
}> = ({ icon, label, detail, color = theme.color.cyan, active = false, style }) => (
  <Card
    accent={active ? color : theme.color.line}
    style={{
      width: 268,
      height: 228,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 17,
      boxShadow: active
        ? `0 0 0 1px ${color}55, 0 25px 80px ${color}22`
        : "0 25px 70px #0007",
      ...style,
    }}
  >
    <div
      style={{
        width: 82,
        height: 82,
        borderRadius: 25,
        display: "grid",
        placeItems: "center",
        background: `${color}13`,
        border: `1px solid ${color}44`,
      }}
    >
      <Icon name={icon} color={color} />
    </div>
    <div style={{ color: theme.color.text, fontSize: 30, fontWeight: 750 }}>{label}</div>
    <div style={{ color: theme.color.textMuted, fontSize: 20 }}>{detail}</div>
  </Card>
);

export const FlowLine: React.FC<{
  progress: number;
  color?: string;
  label?: string;
  reverse?: boolean;
  width?: number;
}> = ({ progress, color = theme.color.cyan, label, reverse = false, width = 390 }) => {
  const lineWidth = width;
  const dotRadius = 9;
  const travelled = interpolate(progress, [0, 1], [0, lineWidth], clamp);
  const dotX = interpolate(
    progress,
    [0, 1],
    reverse ? [lineWidth - dotRadius, dotRadius] : [dotRadius, lineWidth - dotRadius],
    clamp,
  );
  return (
    <div style={{ width: lineWidth, height: 74, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 0,
          right: 0,
          height: 2,
          background: theme.color.line,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 34,
          left: reverse ? lineWidth - travelled : 0,
          width: travelled,
          height: 6,
          background: reverse
            ? `linear-gradient(90deg, ${color}, transparent)`
            : `linear-gradient(90deg, transparent, ${color})`,
          boxShadow: `0 0 18px ${color}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 28,
          left: dotX,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 28px ${color}`,
          transform: "translateX(-50%)",
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            textAlign: "center",
            color,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export const Caption: React.FC<{ children: ReactNode; frame: number }> = ({
  children,
  frame,
}) => {
  const opacity = interpolate(frame, [10, 25], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 210,
        right: 210,
        bottom: 48,
        textAlign: "center",
        color: theme.color.text,
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.5,
        opacity,
        textShadow: "0 3px 16px #000",
      }}
    >
      {children}
    </div>
  );
};
