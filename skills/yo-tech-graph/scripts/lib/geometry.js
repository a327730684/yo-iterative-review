// Deterministic geometry primitives ported from fireworks-tech-graph
// (fireworks_geometry.py + the routing section of generate-from-template.py).
// Node stdlib only. All functions are pure; tie-breaks are deterministic.

export const EPSILON = 1e-6;

export const almostEqual = (a, b, eps = EPSILON) => Math.abs(a - b) <= eps;

export const samePoint = (a, b, eps = EPSILON) =>
  almostEqual(a[0], b[0], eps) && almostEqual(a[1], b[1], eps);

export const segmentAxis = (a, b) => {
  if (almostEqual(a[1], b[1])) return "horizontal";
  if (almostEqual(a[0], b[0])) return "vertical";
  return "other";
};

export const routeIsOrthogonal = (points) =>
  points.every((p, i) => i === 0 || segmentAxis(points[i - 1], p) !== "other");

export const routeLengthEuclid = (points) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

export const routeLengthManhattan = (points) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.abs(p[0] - points[i][0]) + Math.abs(p[1] - points[i][1]), 0);

export const bendCount = (points) => {
  const axes = [];
  for (let i = 1; i < points.length; i++) {
    if (!samePoint(points[i - 1], points[i])) axes.push(segmentAxis(points[i - 1], points[i]));
  }
  let bends = 0;
  for (let i = 1; i < axes.length; i++) if (axes[i] !== axes[i - 1]) bends++;
  return bends;
};

export const boundsIntersect = (a, b, padding = 0) =>
  !(a[2] + padding <= b[0] || b[2] + padding <= a[0] || a[3] + padding <= b[1] || b[3] + padding <= a[1]);

export const expandBounds = ([l, t, r, b], padding) => [l - padding, t - padding, r + padding, b + padding];

export const pointInBounds = ([x, y], [l, t, r, b], { padding = 0, interior = false } = {}) => {
  if (interior) return l + padding < x && x < r - padding && t + padding < y && y < b - padding;
  return l - padding <= x && x <= r + padding && t - padding <= y && y <= b + padding;
};

export const boundsInside = (inner, outer, padding = 0) => {
  const [il, it, ir, ib] = inner;
  const [ol, ot, orr, ob] = outer;
  return il >= ol + padding && it >= ot + padding && ir <= orr - padding && ib <= ob - padding;
};

export const routeInsideCanvas = (points, [l, t, r, b], margin = 0) => {
  const safe = [l + margin, t + margin, r - margin, b - margin];
  return points.every((p) => pointInBounds(p, safe));
};

export const rectangleBounds = (x, y, width, height) => [x, y, x + width, y + height];

const orientation = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const onSegment = (p, a, b, eps = EPSILON) =>
  Math.min(a[0], b[0]) - eps <= p[0] && p[0] <= Math.max(a[0], b[0]) + eps &&
  Math.min(a[1], b[1]) - eps <= p[1] && p[1] <= Math.max(a[1], b[1]) + eps &&
  Math.abs(orientation(a, b, p)) <= eps;

// Proper crossing, touch, or collinear overlap between two segments.
export const segmentInteraction = (a1, a2, b1, b2) => {
  const axisA = segmentAxis(a1, a2);
  const axisB = segmentAxis(b1, b2);

  if (axisA === "horizontal" && axisB === "horizontal" && almostEqual(a1[1], b1[1])) {
    const start = Math.max(Math.min(a1[0], a2[0]), Math.min(b1[0], b2[0]));
    const end = Math.min(Math.max(a1[0], a2[0]), Math.max(b1[0], b2[0]));
    if (end - start > EPSILON) return { kind: "overlap", overlapLength: end - start };
    if (almostEqual(start, end)) return { kind: "touch", point: [start, a1[1]] };
    return null;
  }
  if (axisA === "vertical" && axisB === "vertical" && almostEqual(a1[0], b1[0])) {
    const start = Math.max(Math.min(a1[1], a2[1]), Math.min(b1[1], b2[1]));
    const end = Math.min(Math.max(a1[1], a2[1]), Math.max(b1[1], b2[1]));
    if (end - start > EPSILON) return { kind: "overlap", overlapLength: end - start };
    if (almostEqual(start, end)) return { kind: "touch", point: [a1[0], start] };
    return null;
  }
  if (axisA === "horizontal" && axisB === "vertical") {
    const p = [b1[0], a1[1]];
    return onSegment(p, a1, a2) && onSegment(p, b1, b2) ? { kind: "crossing", point: p } : null;
  }
  if (axisA === "vertical" && axisB === "horizontal") {
    const p = [a1[0], b1[1]];
    return onSegment(p, a1, a2) && onSegment(p, b1, b2) ? { kind: "crossing", point: p } : null;
  }

  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (Math.abs(o1) <= EPSILON && Math.abs(o2) <= EPSILON && Math.abs(o3) <= EPSILON && Math.abs(o4) <= EPSILON) {
    const candidates = [a1, a2, b1, b2].filter((p) => onSegment(p, a1, a2) && onSegment(p, b1, b2));
    const unique = uniquePoints(candidates);
    if (unique.length >= 2) {
      let maxDist = 0;
      for (const p of unique) for (const q of unique) maxDist = Math.max(maxDist, Math.hypot(p[0] - q[0], p[1] - q[1]));
      return { kind: "overlap", overlapLength: maxDist };
    }
    if (unique.length) return { kind: "touch", point: unique[0] };
    return null;
  }
  if (o1 * o2 <= EPSILON && o3 * o4 <= EPSILON) {
    const denom = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
    if (Math.abs(denom) <= EPSILON) return null;
    const d1 = a1[0] * a2[1] - a1[1] * a2[0];
    const d2 = b1[0] * b2[1] - b1[1] * b2[0];
    const p = [(d1 * (b1[0] - b2[0]) - (a1[0] - a2[0]) * d2) / denom, (d1 * (b1[1] - b2[1]) - (a1[1] - a2[1]) * d2) / denom];
    return onSegment(p, a1, a2) && onSegment(p, b1, b2) ? { kind: "crossing", point: p } : null;
  }
  return null;
};

export const uniquePoints = (points, tolerance = 0.01) => {
  const result = [];
  for (const p of points) {
    const rounded = [round2(p[0]), round2(p[1])];
    if (!result.some((q) => samePoint(rounded, q, tolerance))) result.push(rounded);
  }
  return result;
};

const isSharedRouteEndpoint = (p, first, second, tolerance = 0.01) =>
  [first[0], first[first.length - 1]].some((e) => samePoint(p, e, tolerance)) &&
  [second[0], second[second.length - 1]].some((e) => samePoint(p, e, tolerance));

export const routeInteractions = (route, others) => {
  const crossings = [];
  let overlapCount = 0;
  let overlapLength = 0;
  for (const other of others) {
    if (other.length < 2) continue;
    for (let i = 1; i < route.length; i++) {
      for (let j = 1; j < other.length; j++) {
        const hit = segmentInteraction(route[i - 1], route[i], other[j - 1], other[j]);
        if (!hit) continue;
        if (hit.kind === "overlap") {
          overlapCount += 1;
          overlapLength += hit.overlapLength;
          continue;
        }
        if (!hit.point || isSharedRouteEndpoint(hit.point, route, other)) continue;
        crossings.push(hit.point);
      }
    }
  }
  return { crossings: uniquePoints(crossings), overlapCount, overlapLength: round2(overlapLength) };
};

export const routeCrossingCount = (route, others) => routeInteractions(route, others).crossings.length;

// ---- Text metrics (port of estimate_text_width; shared by every placement) ----

const COMBINING_RANGES = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a], [0x064b, 0x065f],
  [0x0670, 0x0670], [0x06d6, 0x06dc], [0x0e31, 0x0e31], [0x0e34, 0x0e3a], [0x0e47, 0x0e4e],
  [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x20d0, 0x20f0], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f],
  [0x200b, 0x200f], [0x2060, 0x2064],
];
const WIDE_RANGES = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd], [0x30000, 0x3fffd],
];
const inRanges = (code, ranges) => ranges.some(([lo, hi]) => code >= lo && code <= hi);

export const isCombining = (ch) => inRanges(ch.codePointAt(0), COMBINING_RANGES);
export const isEastAsianWide = (ch) => inRanges(ch.codePointAt(0), WIDE_RANGES);

export const estimateTextWidth = (text, fontSize = 12, weight = 1.0) => {
  let units = 0;
  for (const ch of String(text ?? "")) {
    if (isCombining(ch)) continue;
    if (isEastAsianWide(ch)) units += 1.0;
    else if (/\s/.test(ch)) units += 0.36;
    else if ("ilI.,:;!'`|".includes(ch)) units += 0.32;
    else if ("MW@#%&".includes(ch)) units += 0.82;
    else units += 0.58;
  }
  return Math.max(fontSize * 1.5, units * fontSize * weight);
};

export const estimateTextBounds = (x, y, text, { fontSize = 12, anchor = "start", padding = 0 } = {}) => {
  const width = estimateTextWidth(text, fontSize);
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const top = y - fontSize * 0.82;
  return [left - padding, top - padding, left + width + padding, y + fontSize * 0.24 + padding];
};

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const formatNumber = (v) => {
  const rounded = round2(v);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

// SVG path with deterministic semicircular jump-over arcs at declared crossings.
export const pathWithBridges = (route, bridges, radius = 5.0) => {
  if (!route.length) return "";
  const commands = [`M ${formatNumber(route[0][0])},${formatNumber(route[0][1])}`];
  const remaining = uniquePoints(bridges);
  for (let i = 1; i < route.length; i++) {
    const [sx, sy] = route[i - 1];
    const [ex, ey] = route[i];
    const axis = segmentAxis(route[i - 1], route[i]);
    if (axis === "horizontal") {
      const dir = ex >= sx ? 1 : -1;
      const candidates = remaining
        .filter(([bx, by]) => almostEqual(by, sy, 0.1) && Math.min(sx, ex) + radius * 1.5 < bx && bx < Math.max(sx, ex) - radius * 1.5)
        .sort((a, b) => dir * a[0] - dir * b[0]);
      let last = sx;
      for (const [bx, by] of candidates) {
        if (Math.abs(bx - last) < radius * 2.5) continue;
        const before = bx - dir * radius;
        const after = bx + dir * radius;
        commands.push(`L ${formatNumber(before)},${formatNumber(by)}`);
        const sweep = dir > 0 ? 0 : 1;
        commands.push(`A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 ${sweep} ${formatNumber(after)},${formatNumber(by)}`);
        last = after;
      }
      commands.push(`L ${formatNumber(ex)},${formatNumber(ey)}`);
    } else if (axis === "vertical") {
      const dir = ey >= sy ? 1 : -1;
      const candidates = remaining
        .filter(([bx, by]) => almostEqual(bx, sx, 0.1) && Math.min(sy, ey) + radius * 1.5 < by && by < Math.max(sy, ey) - radius * 1.5)
        .sort((a, b) => dir * a[1] - dir * b[1]);
      let last = sy;
      for (const [bx, by] of candidates) {
        if (Math.abs(by - last) < radius * 2.5) continue;
        const before = by - dir * radius;
        const after = by + dir * radius;
        commands.push(`L ${formatNumber(bx)},${formatNumber(before)}`);
        const sweep = dir > 0 ? 1 : 0;
        commands.push(`A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 ${sweep} ${formatNumber(bx)},${formatNumber(after)}`);
        last = after;
      }
      commands.push(`L ${formatNumber(ex)},${formatNumber(ey)}`);
    } else {
      commands.push(`L ${formatNumber(ex)},${formatNumber(ey)}`);
    }
  }
  return commands.join(" ");
};

// ---- Orthogonal routing (ported from generate-from-template.py) ----

// Collision test for an axis-aligned segment against a rectangle.
export const segmentHitsBounds = ([x1, y1], [x2, y2], [l, t, r, b]) => {
  const eps = 1e-6;
  if (Math.abs(y1 - y2) < eps) {
    const y = y1;
    if (!(t + eps < y && y < b - eps)) return false;
    const segL = Math.min(x1, x2);
    const segR = Math.max(x1, x2);
    const ovL = Math.max(segL, l);
    const ovR = Math.min(segR, r);
    if (ovR - ovL <= eps) return false;
    if (Math.abs(ovL - x1) < eps && Math.abs(ovR - x1) < eps) return false;
    if (Math.abs(ovL - x2) < eps && Math.abs(ovR - x2) < eps) return false;
    return true;
  }
  if (Math.abs(x1 - x2) < eps) {
    const x = x1;
    if (!(l + eps < x && x < r - eps)) return false;
    const segT = Math.min(y1, y2);
    const segB = Math.max(y1, y2);
    const ovT = Math.max(segT, t);
    const ovB = Math.min(segB, b);
    if (ovB - ovT <= eps) return false;
    if (Math.abs(ovT - y1) < eps && Math.abs(ovB - y1) < eps) return false;
    if (Math.abs(ovT - y2) < eps && Math.abs(ovB - y2) < eps) return false;
    return true;
  }
  return false;
};

export const collisionCount = (points, obstacles) => {
  let count = 0;
  for (let i = 1; i < points.length; i++)
    for (const obs of obstacles) if (segmentHitsBounds(points[i - 1], points[i], obs)) count++;
  return count;
};

export const routeCollides = (points, obstacles) => collisionCount(points, obstacles) > 0;

export const portAxis = (port) => {
  if (!port) return null;
  const p = String(port).toLowerCase();
  if (p === "left" || p === "right") return "horizontal";
  if (p === "top" || p === "bottom") return "vertical";
  return null;
};

export const offsetPoint = ([x, y], port, distance) => {
  if (!port) return [x, y];
  const p = String(port).toLowerCase();
  if (p === "left") return [x - distance, y];
  if (p === "right") return [x + distance, y];
  if (p === "top") return [x, y - distance];
  if (p === "bottom") return [x, y + distance];
  return [x, y];
};

export const clearPortPoint = (endpoint, port, desiredDistance, obstacles, canvasBounds) => {
  for (const fraction of [1.0, 0.75, 0.5, 0.35, 0.2, 0.0]) {
    const candidate = offsetPoint(endpoint, port, desiredDistance * fraction);
    if (canvasBounds && !pointInBounds(candidate, canvasBounds)) continue;
    if (obstacles.some((obs) => pointInBounds(candidate, obs, { interior: true }) || segmentHitsBounds(endpoint, candidate, obs))) continue;
    return candidate;
  }
  return endpoint;
};

export const simplifyPoints = (points, protectedPoints = []) => {
  const protectedSet = new Set(protectedPoints.map(([x, y]) => `${round2(x)},${round2(y)}`));
  const deduped = [];
  for (const [x, y] of points) {
    const pt = [round2(x), round2(y)];
    if (deduped.length && samePoint(pt, deduped[deduped.length - 1], 0)) continue;
    deduped.push(pt);
  }
  const collapsed = [];
  for (const point of deduped) {
    if (collapsed.length < 2) {
      collapsed.push(point);
      continue;
    }
    const [x0, y0] = collapsed[collapsed.length - 2];
    const [x1, y1] = collapsed[collapsed.length - 1];
    const [x2, y2] = point;
    const collinearV = x0 === x1 && x1 === x2;
    const collinearH = y0 === y1 && y1 === y2;
    if ((collinearV || collinearH) && !protectedSet.has(`${x1},${y1}`)) collapsed[collapsed.length - 1] = point;
    else collapsed.push(point);
  }
  return collapsed;
};

const routeUsesLane = (points, value, axis, tolerance = 1.0) =>
  points.some((p) => Math.abs((axis === "x" ? p[0] : p[1]) - value) <= tolerance);

export const routeScore = (points, hintX, hintY, sourcePort, targetPort, existingRoutes = []) => {
  const length = routeLengthManhattan(points);
  const bends = Math.max(0, points.length - 2);
  let score = length + bends * 22;
  if (points.length >= 2 && sourcePort) {
    if (segmentAxis(points[0], points[1]) !== portAxis(sourcePort)) score += 180;
  }
  if (points.length >= 2 && targetPort) {
    if (segmentAxis(points[points.length - 2], points[points.length - 1]) !== portAxis(targetPort)) score += 180;
  }
  for (const lane of hintX) if (routeUsesLane(points, lane, "x")) score -= 28;
  for (const lane of hintY) if (routeUsesLane(points, lane, "y")) score -= 28;
  const interactions = routeInteractions(points, existingRoutes);
  score += interactions.crossings.length * 640;
  score += interactions.overlapCount * 900 + interactions.overlapLength * 18;
  return score;
};

const cmpPoints = (a, b) => a[0] - b[0] || a[1] - b[1];
const cmpPath = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = cmpPoints(a[i], b[i]);
    if (d !== 0) return d;
  }
  return a.length - b.length;
};

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const cmp = a[i][0] - a[parent][0] || (a[i][0] === a[parent][0] ? cmpPath(a[i][1], a[parent][1]) : 0);
      if (cmp >= 0) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && (a[l][0] - a[m][0] < 0 || (a[l][0] === a[m][0] && cmpPath(a[l][1], a[m][1]) < 0))) m = l;
        if (r < a.length && (a[r][0] - a[m][0] < 0 || (a[r][0] === a[m][0] && cmpPath(a[r][1], a[m][1]) < 0))) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

const stateKey = (point, incoming) => `${point[0]}|${point[1]}|${incoming}`;

// Deterministic rectilinear route on an obstacle visibility grid (bend-aware Dijkstra).
export const visibilityGridRoute = (start, end, obstacles, { canvasBounds, hintX, hintY, existingRoutes }) => {
  if (samePoint(start, end, 0)) return [start];
  let [cl, ct, cr, cb] = canvasBounds ?? [0, 0, 0, 0];
  if (!canvasBounds) {
    const xs = [start[0], end[0]];
    const ys = [start[1], end[1]];
    for (const [l, t, r, b] of obstacles) { xs.push(l, r); ys.push(t, b); }
    cl = Math.min(...xs) - 64; ct = Math.min(...ys) - 64; cr = Math.max(...xs) + 64; cb = Math.max(...ys) + 64;
  }
  const inset = 4.0;

  const xSet = new Set([round2(start[0]), round2(end[0]), round2((start[0] + end[0]) / 2), round2(cl + inset), round2(cr - inset), ...hintX.map(round2)]);
  const ySet = new Set([round2(start[1]), round2(end[1]), round2((start[1] + end[1]) / 2), round2(ct + inset), round2(cb - inset), ...hintY.map(round2)]);
  for (const [l, t, r, b] of obstacles) { xSet.add(round2(l)); xSet.add(round2(r)); ySet.add(round2(t)); ySet.add(round2(b)); }
  for (const route of existingRoutes) {
    for (const [x, y] of route) {
      for (const d of [-10, 0, 10]) { xSet.add(round2(x + d)); ySet.add(round2(y + d)); }
    }
  }
  const xValues = [...xSet].filter((v) => cl - EPSILON <= v && v <= cr + EPSILON).sort((a, b) => a - b);
  const yValues = [...ySet].filter((v) => ct - EPSILON <= v && v <= cb + EPSILON).sort((a, b) => a - b);

  const pointKey = (p) => `${p[0]}|${p[1]}`;
  const points = new Map();
  for (const x of xValues) {
    for (const y of yValues) {
      const p = [x, y];
      if (!obstacles.some((obs) => pointInBounds(p, obs, { interior: true }))) points.set(pointKey(p), p);
    }
  }
  points.set(pointKey(start), start);
  points.set(pointKey(end), end);

  const byY = new Map();
  const byX = new Map();
  for (const p of points.values()) {
    if (!byY.has(p[1])) byY.set(p[1], []);
    if (!byX.has(p[0])) byX.set(p[0], []);
    byY.get(p[1]).push(p);
    byX.get(p[0]).push(p);
  }

  const adjacency = new Map();
  for (const p of points.values()) adjacency.set(pointKey(p), []);
  const connect = (line, sortKey) => {
    const ordered = [...line].sort((a, b) => a[sortKey] - b[sortKey] || a[1 - sortKey] - b[1 - sortKey]);
    for (let i = 1; i < ordered.length; i++) {
      const first = ordered[i - 1];
      const second = ordered[i];
      if (obstacles.some((obs) => segmentHitsBounds(first, second, obs))) continue;
      adjacency.get(pointKey(first)).push(second);
      adjacency.get(pointKey(second)).push(first);
    }
  };
  for (const line of byY.values()) connect(line, 0);
  for (const line of byX.values()) connect(line, 1);
  for (const list of adjacency.values()) list.sort(cmpPoints);

  // Dijkstra over (point, incoming-axis) states so bends have an explicit cost.
  const startState = stateKey(start, "");
  const distances = new Map([[startState, 0.0]]);
  const paths = new Map([[startState, [start]]]);
  const queue = new MinHeap();
  queue.push([0.0, [start], start, ""]);
  let bestEnd = null;

  while (queue.size) {
    const [cost, pathKey, point, incoming] = queue.pop();
    const state = stateKey(point, incoming);
    const known = distances.get(state);
    const knownPath = paths.get(state);
    if (cost > known + EPSILON || cmpPath(pathKey, knownPath) !== 0) continue;
    if (samePoint(point, end, 0)) {
      bestEnd = [cost, pathKey];
      break;
    }
    for (const neighbor of adjacency.get(pointKey(point)) ?? []) {
      const axis = segmentAxis(point, neighbor);
      if (axis === "other") continue;
      const distance = Math.abs(neighbor[0] - point[0]) + Math.abs(neighbor[1] - point[1]);
      const interactions = routeInteractions([point, neighbor], existingRoutes);
      let extra = distance;
      if (incoming && incoming !== axis) extra += 22.0;
      extra += interactions.crossings.length * 640.0;
      extra += interactions.overlapCount * 10000.0 + interactions.overlapLength * 30.0;
      if (axis === "vertical" && hintX.some((v) => Math.abs(point[0] - v) <= 1)) extra -= Math.min(18.0, distance * 0.08);
      if (axis === "horizontal" && hintY.some((v) => Math.abs(point[1] - v) <= 1)) extra -= Math.min(18.0, distance * 0.08);
      const nextState = stateKey(neighbor, axis);
      const nextCost = cost + extra;
      const nextPath = [...pathKey, neighbor];
      const oldCost = distances.has(nextState) ? distances.get(nextState) : Infinity;
      const oldPath = paths.get(nextState);
      if (nextCost < oldCost - EPSILON || (Math.abs(nextCost - oldCost) <= EPSILON && (!oldPath || cmpPath(nextPath, oldPath) < 0))) {
        distances.set(nextState, nextCost);
        paths.set(nextState, nextPath);
        queue.push([nextCost, nextPath, neighbor, axis]);
      }
    }
  }

  if (!bestEnd) return null;
  return simplifyPoints(bestEnd[1]);
};

export const toFloat = (value, fallback = 0.0) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

// Main router: explicit route_points recurse; otherwise candidate topologies
// scored by route_score, with the visibility grid as the escape hatch.
export const buildOrthogonalRoute = (start, end, obstacles, arrowData, { canvasBounds = null, existingRoutes = [] } = {}) => {
  const rawWaypoints = arrowData.route_points ?? [];
  if (rawWaypoints.length) {
    const waypoints = rawWaypoints.map((raw, index) => {
      if (!Array.isArray(raw) || raw.length !== 2) throw new Error(`route waypoint ${index + 1} must be [x, y]`);
      const waypoint = [toFloat(raw[0]), toFloat(raw[1])];
      if (obstacles.some((obs) => pointInBounds(waypoint, obs, { interior: true }))) {
        throw new Error(`route waypoint ${index + 1} intersects an obstacle: ${waypoint}`);
      }
      if (canvasBounds && !pointInBounds(waypoint, canvasBounds)) {
        throw new Error(`route waypoint ${index + 1} is outside the canvas: ${waypoint}`);
      }
      return waypoint;
    });

    const mandatory = [start, ...waypoints, end];
    const assembled = [];
    mandatory.slice(0, -1).forEach((segmentStart, index) => {
      const segmentEnd = mandatory[index + 1];
      const segmentData = { ...arrowData };
      delete segmentData.route_points;
      if (index > 0) delete segmentData.source_port;
      if (index < mandatory.length - 2) delete segmentData.target_port;
      const occupiedRoutes = [...existingRoutes];
      if (assembled.length >= 2) occupiedRoutes.push(assembled);
      const segmentRoute = buildOrthogonalRoute(segmentStart, segmentEnd, obstacles, segmentData, {
        canvasBounds,
        existingRoutes: occupiedRoutes,
      });
      if (assembled.length) assembled.push(...segmentRoute.slice(1));
      else assembled.push(...segmentRoute);
    });
    const result = simplifyPoints(assembled, waypoints);
    if (!routeIsOrthogonal(result)) throw new Error("explicit route waypoints could not be connected orthogonally");
    if (waypoints.some((w) => !result.some((p) => samePoint(p, w, 0)))) {
      throw new Error("explicit route waypoint was not preserved");
    }
    if (routeCollides(result, obstacles)) throw new Error("explicit route waypoints cannot be connected without crossing an obstacle");
    return result;
  }

  const routingPadding = toFloat(arrowData.routing_padding, 24);
  const portClearance = toFloat(arrowData.port_clearance, Math.max(18, routingPadding * 0.85));
  const sourcePort = String(arrowData.source_port ?? "").trim().toLowerCase() || null;
  const targetPort = String(arrowData.target_port ?? "").trim().toLowerCase() || null;
  const innerStart = clearPortPoint(start, sourcePort, portClearance, obstacles, canvasBounds);
  const innerEnd = clearPortPoint(end, targetPort, portClearance, obstacles, canvasBounds);
  const [ssx, ssy] = innerStart;
  const [eex, eey] = innerEnd;

  const expanded = [];
  for (const bounds of obstacles) {
    const padded = expandBounds(bounds, routingPadding);
    const relaxed = [start, end, innerStart, innerEnd].some(
      (p) => pointInBounds(p, padded, { interior: true }) && !pointInBounds(p, bounds, { interior: true }),
    );
    expanded.push(relaxed ? bounds : padded);
  }

  const hintX = (arrowData.corridor_x ?? []).map((v) => toFloat(v));
  const hintY = (arrowData.corridor_y ?? []).map((v) => toFloat(v));
  const laneX = [...new Set([ssx, eex, round2((ssx + eex) / 2), ...hintX, ...expanded.map((b) => b[0]), ...expanded.map((b) => b[2])])].sort((a, b) => a - b);
  const laneY = [...new Set([ssy, eey, round2((ssy + eey) / 2), ...hintY, ...expanded.map((b) => b[1]), ...expanded.map((b) => b[3])])].sort((a, b) => a - b);
  let leftRail; let rightRail; let topRail; let bottomRail;
  if (expanded.length) {
    leftRail = Math.min(...expanded.map((b) => b[0])) - 24;
    rightRail = Math.max(...expanded.map((b) => b[2])) + 24;
    topRail = Math.min(...expanded.map((b) => b[1])) - 24;
    bottomRail = Math.max(...expanded.map((b) => b[3])) + 24;
  } else {
    leftRail = Math.min(ssx, eex) - 48;
    rightRail = Math.max(ssx, eex) + 48;
    topRail = Math.min(ssy, eey) - 48;
    bottomRail = Math.max(ssy, eey) + 48;
  }

  const candidates = [
    [start, innerStart, innerEnd, end],
    [start, innerStart, [eex, ssy], innerEnd, end],
    [start, innerStart, [ssx, eey], innerEnd, end],
    [start, innerStart, [(ssx + eex) / 2, ssy], [(ssx + eex) / 2, eey], innerEnd, end],
    [start, innerStart, [ssx, (ssy + eey) / 2], [eex, (ssy + eey) / 2], innerEnd, end],
    [start, innerStart, [leftRail, ssy], [leftRail, eey], innerEnd, end],
    [start, innerStart, [rightRail, ssy], [rightRail, eey], innerEnd, end],
    [start, innerStart, [ssx, topRail], [eex, topRail], innerEnd, end],
    [start, innerStart, [ssx, bottomRail], [eex, bottomRail], innerEnd, end],
  ];
  for (const x of laneX) candidates.push([start, innerStart, [x, ssy], [x, eey], innerEnd, end]);
  for (const y of laneY) candidates.push([start, innerStart, [ssx, y], [eex, y], innerEnd, end]);
  for (const x of hintX) for (const y of hintY) {
    candidates.push([start, innerStart, [x, ssy], [x, y], [eex, y], innerEnd, end]);
  }

  const visibility = visibilityGridRoute(innerStart, innerEnd, expanded, {
    canvasBounds, hintX, hintY, existingRoutes,
  });
  if (visibility) candidates.push([start, ...visibility, end]);

  let bestRoute = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const simplified = simplifyPoints(candidate);
    if (!routeIsOrthogonal(simplified)) continue;
    if (canvasBounds && !routeInsideCanvas(simplified, canvasBounds)) continue;
    const coll = collisionCount(simplified, expanded);
    const score = routeScore(simplified, hintX, hintY, sourcePort, targetPort, existingRoutes);
    if (coll === 0 && (score < bestScore - EPSILON || (Math.abs(score - bestScore) < EPSILON && (!bestRoute || cmpPath(simplified, bestRoute) < 0)))) {
      bestScore = score;
      bestRoute = simplified;
    }
  }

  if (bestRoute) return bestRoute;
  throw new Error("no collision-free orthogonal route satisfies the current constraints");
};

// ---- Arrow label placement ----

export const routeClearanceBounds = (points, padding = 3.0) => {
  const result = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    result.push([
      Math.min(x1, x2) - padding, Math.min(y1, y2) - padding,
      Math.max(x1, x2) + padding, Math.max(y1, y2) + padding,
    ]);
  }
  return result;
};

export const estimateLabelBounds = (x, y, text) => {
  const width = Math.max(36.0, estimateTextWidth(text, 12) + 14);
  return rectangleBounds(x - width / 2, y - 10, width, 20);
};

const chooseLabelPosition = (points) => {
  let best = null;
  let bestLen = -1;
  for (let i = 1; i < points.length; i++) {
    const len = Math.abs(points[i - 1][0] - points[i][0]) + Math.abs(points[i - 1][1] - points[i][1]);
    if (len > bestLen) { bestLen = len; best = [points[i - 1], points[i]]; }
  }
  if (!best) return points[0];
  return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
};

const labelPositionCandidates = (points, text = "") => {
  const segments = [];
  for (let i = 1; i < points.length; i++) segments.push([points[i - 1], points[i]]);
  if (!segments.length) return [points[0]];
  const ranked = [...segments].sort(
    (a, b) =>
      (Math.abs(b[0][0] - b[1][0]) + Math.abs(b[0][1] - b[1][1])) -
      (Math.abs(a[0][0] - a[1][0]) + Math.abs(a[0][1] - a[1][1])),
  );
  const candidates = [];
  const horizontalOffset = 17.0;
  const verticalOffset = Math.max(22.0, estimateTextWidth(text, 12) / 2 + 10);
  const globalX = (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2;
  const globalY = (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2;
  for (const [[x1, y1], [x2, y2]] of ranked) {
    const length = Math.abs(x1 - x2) + Math.abs(y1 - y2);
    if (length < 34) continue;
    const centers = [
      [(x1 + x2) / 2, (y1 + y2) / 2],
      [x1 * 0.7 + x2 * 0.3, y1 * 0.7 + y2 * 0.3],
      [x1 * 0.3 + x2 * 0.7, y1 * 0.3 + y2 * 0.7],
    ];
    for (const [mx, my] of centers) {
      if (Math.abs(y1 - y2) < EPSILON) {
        candidates.push([mx, my - horizontalOffset], [mx, my + horizontalOffset], [mx, my - 30], [mx, my + 30], [mx, my]);
        candidates.push([globalX, my - horizontalOffset], [globalX, my + horizontalOffset]);
      } else if (Math.abs(x1 - x2) < EPSILON) {
        candidates.push([mx - verticalOffset, my], [mx + verticalOffset, my], [mx - verticalOffset - 14, my], [mx + verticalOffset + 14, my], [mx, my]);
        candidates.push([mx - verticalOffset, globalY], [mx + verticalOffset, globalY]);
      } else {
        candidates.push([mx, my - 16], [mx, my + 16], [mx, my]);
      }
    }
  }
  return candidates.length ? candidates : [chooseLabelPosition(points)];
};

export const chooseLabelPositionAvoiding = (
  points, text, occupied,
  { routes = [], canvasBounds = null, dx = 0.0, dy = -4.0 } = {},
) => {
  const routeBounds = routes.flatMap((route) => routeClearanceBounds(route));
  const offsetOptions = [
    [dx, dy], [0.0, -4.0], [0.0, 0.0], [0.0, -14.0], [0.0, 14.0],
    [-18.0, -4.0], [18.0, -4.0], [-32.0, 0.0], [32.0, 0.0],
  ];
  for (const candidate of labelPositionCandidates(points, text)) {
    for (const [offsetX, offsetY] of offsetOptions) {
      const adjusted = [candidate[0] + offsetX, candidate[1] + offsetY];
      const labelBox = estimateLabelBounds(adjusted[0], adjusted[1], text);
      if (canvasBounds && !boundsInside(labelBox, canvasBounds, 4)) continue;
      if (occupied.some((other) => boundsIntersect(labelBox, other, 4))) continue;
      if (routeBounds.some((other) => boundsIntersect(labelBox, other, 1))) continue;
      return adjusted;
    }
  }
  throw new Error(`no collision-free label position for ${JSON.stringify(text)}`);
};

// ---- Single-line / wrapped text fitting ----

export const fittedTextSize = (text, availableWidth, { preferred = 18.0, minimum = 12.0 } = {}) => {
  const estimated = estimateTextWidth(text, preferred, 1.08);
  if (estimated <= Math.max(1.0, availableWidth)) return preferred;
  const scaled = Math.max(minimum, preferred * availableWidth / Math.max(estimated, 1.0));
  return Math.floor(scaled * 100) / 100;
};

export const fitSingleLineText = (text, availableWidth, { preferred = 18.0, minimum = 12.0 } = {}) => {
  const value = String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
  const size = fittedTextSize(value, availableWidth, { preferred, minimum });
  if (estimateTextWidth(value, size, 1.08) <= availableWidth) return [value, size];
  let candidate = value;
  while (candidate && estimateTextWidth(`${candidate}…`, size, 1.08) > availableWidth) {
    candidate = candidate.slice(0, -1).replace(/\s+$/, "");
  }
  return [candidate ? `${candidate}…` : "…", size];
};

export const wrapTextLines = (text, availableWidth, { fontSize = 11.5, maxLines = 2 } = {}) => {
  const value = String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
  if (!value) return [];
  if (estimateTextWidth(value, fontSize) <= availableWidth || maxLines <= 1) return [value];
  const words = value.split(/\s+/);
  let lines;
  if (maxLines === 2 && words.length > 1) {
    const candidates = [];
    for (let index = 1; index < words.length; index++) {
      const candidate = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
      const widths = candidate.map((line) => estimateTextWidth(line, fontSize));
      const overflow = widths.reduce((sum, w) => sum + Math.max(0.0, w - availableWidth), 0);
      candidates.push([[overflow, Math.abs(widths[0] - widths[1])], candidate]);
    }
    candidates.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1]);
    lines = candidates[0][1];
  } else {
    lines = [];
    let current = "";
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (current && estimateTextWidth(candidate, fontSize) > availableWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")];
  }

  const fitted = [];
  for (const line of lines.slice(0, maxLines)) {
    let candidate = line;
    while (candidate.length > 1 && estimateTextWidth(candidate, fontSize) > availableWidth) {
      candidate = candidate.slice(0, -1).replace(/\s+$/, "");
    }
    if (candidate !== line) {
      candidate = `${candidate.replace(/[\s…]+$/, "")}…`;
      while (candidate.length > 1 && estimateTextWidth(candidate, fontSize) > availableWidth) {
        candidate = `${candidate.slice(0, -2).replace(/\s+$/, "")}…`;
      }
    }
    fitted.push(candidate);
  }
  return fitted;
};
