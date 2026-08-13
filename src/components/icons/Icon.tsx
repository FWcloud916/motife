import type { FC } from "react";
import type { Size, Tone } from "../tokens";
import { tokens } from "../tokens";
import type { IconName } from "./registry";
import { ICON_PATHS } from "./registry";

const ICON_SIZE: Record<Size, number> = { sm: 32, md: 52, lg: 72 };

export interface IconProps {
  name: IconName;
  tone?: Tone;
  size?: Size;
}

export const Icon: FC<IconProps> = ({ name, tone = "info", size = "md" }) => {
  const color = tokens.color.tone[tone].fg;
  const px = ICON_SIZE[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  );
};
