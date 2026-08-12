interface Point {
  x: number;
  y: number;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function length(v: Point): number {
  return Math.hypot(v.x, v.y);
}

function normalize(v: Point): Point {
  const len = length(v);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function scale(v: Point, factor: number): Point {
  return { x: v.x * factor, y: v.y * factor };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Builds an SVG path `d` string through `points` with rounded corners —
 * the shape a computed dagre edge route (a polyline through bend points)
 * needs to read as a deliberate curve rather than a jagged line. Degrades
 * gracefully: 0/1/2-point routes, and collinear or duplicate points
 * (`normalize` returns the zero vector instead of dividing by zero),
 * never produce NaN in the output.
 */
export function buildRoundedPath(points: readonly Point[], radius = 14): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const toPrevLen = length(sub(prev, curr));
    const toNextLen = length(sub(next, curr));
    const r = Math.min(radius, toPrevLen / 2, toNextLen / 2);

    const start = add(curr, scale(normalize(sub(prev, curr)), r));
    const end = add(curr, scale(normalize(sub(next, curr)), r));

    d += ` L ${start.x} ${start.y} Q ${curr.x} ${curr.y} ${end.x} ${end.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
