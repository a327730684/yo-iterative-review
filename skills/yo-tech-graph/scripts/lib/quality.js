// Composition-quality contract ported from composition_quality.py.
// Short orthogonal routes, deliberate whitespace, clear labels, and zero
// bridged crossings whenever the topology allows.

const numberOr = (value, fallback) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

export const PROFILES = {
  standard: {
    profile: "standard",
    max_bends_per_edge: 12,
    max_total_bends: 100,
    max_route_stretch: 5.0,
    max_bridged_crossings: 8,
    min_node_gap: 0.0,
    min_container_gutter: 0.0,
    min_label_clearance: 2.0,
    min_segment_length: 0.0,
  },
  showcase: {
    profile: "showcase",
    max_bends_per_edge: 2,
    max_total_bends: 8,
    max_route_stretch: 1.35,
    max_bridged_crossings: 0,
    min_node_gap: 40.0,
    min_container_gutter: 20.0,
    min_label_clearance: 4.0,
    min_segment_length: 16.0,
  },
};

// Resolve a profile name or a mapping with per-key overrides.
export const resolveContract = (raw = null) => {
  let profile;
  let overrides;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    profile = String(raw.profile ?? "standard").trim().toLowerCase();
    overrides = raw;
  } else {
    profile = String(raw || "standard").trim().toLowerCase();
    overrides = {};
  }
  if (!PROFILES[profile]) throw new Error(`unsupported composition profile: ${profile}`);
  const values = { ...PROFILES[profile] };
  for (const key of Object.keys(values)) {
    if (key === "profile" || !(key in overrides)) continue;
    values[key] = numberOr(overrides[key], values[key]);
  }
  for (const key of ["max_bends_per_edge", "max_total_bends", "max_bridged_crossings"]) {
    values[key] = Math.trunc(values[key]);
  }
  for (const key of Object.keys(values)) {
    if (key !== "profile" && values[key] < 0) throw new Error("composition quality limits must be non-negative");
  }
  return values;
};

export const routeStretch = (points) => {
  if (points.length < 2) return 1.0;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]);
  }
  const direct =
    Math.abs(points[points.length - 1][0] - points[0][0]) + Math.abs(points[points.length - 1][1] - points[0][1]);
  return direct <= 1e-9 ? 1.0 : length / direct;
};

const segmentLengths = (points) => {
  const lengths = [];
  for (let i = 1; i < points.length; i++) {
    lengths.push(Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]));
  }
  return lengths;
};

const rectangleGap = (a, b) => {
  const horizontal = Math.max(a[0] - b[2], b[0] - a[2], 0.0);
  const vertical = Math.max(a[1] - b[3], b[1] - a[3], 0.0);
  return Math.hypot(horizontal, vertical);
};

const boundsArea = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);

const containingContainer = (node, containers) => {
  const cx = (node[0] + node[2]) / 2;
  const cy = (node[1] + node[3]) / 2;
  const matches = containers.filter(([, b]) => b[0] <= cx && cx <= b[2] && b[1] <= cy && cy <= b[3]);
  if (!matches.length) return null;
  return matches.reduce((best, item) => (boundsArea(item[1]) < boundsArea(best[1]) ? item : best));
};

const containerGutter = (node, c) =>
  Math.min(node[0] - c[0], node[1] - c[1], c[2] - node[2], c[3] - node[3]);

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export const assessComposition = ({ nodes, containers, edges, contract }) => {
  const violations = [];
  let totalBends = 0;
  let totalBridges = 0;
  let maxStretch = 1.0;
  let shortestSegment = null;

  for (const edge of edges) {
    const edgeId = String(edge.id ?? "edge");
    const points = edge.route ?? [];
    const bends = Math.max(0, edge.bends ?? Math.max(0, points.length - 2));
    const bridges = (edge.bridges ?? []).length;
    const stretch = routeStretch(points);
    const lengths = segmentLengths(points).filter((l) => l > 1e-6);
    const localShortest = lengths.length ? Math.min(...lengths) : null;
    totalBends += bends;
    totalBridges += bridges;
    maxStretch = Math.max(maxStretch, stretch);
    if (localShortest !== null) {
      shortestSegment = shortestSegment === null ? localShortest : Math.min(shortestSegment, localShortest);
    }
    if (bends > contract.max_bends_per_edge) {
      violations.push({ code: "EDGE_BEND_BUDGET", element: edgeId, actual: bends, limit: contract.max_bends_per_edge });
    }
    if (stretch > contract.max_route_stretch + 1e-6) {
      violations.push({
        code: "EDGE_ROUTE_STRETCH", element: edgeId, actual: round2(stretch), limit: contract.max_route_stretch,
      });
    }
    if (localShortest !== null && localShortest + 1e-6 < contract.min_segment_length) {
      violations.push({
        code: "EDGE_MICRO_SEGMENT", element: edgeId, actual: round2(localShortest), limit: contract.min_segment_length,
      });
    }
  }

  if (totalBends > contract.max_total_bends) {
    violations.push({ code: "TOTAL_BEND_BUDGET", element: "diagram", actual: totalBends, limit: contract.max_total_bends });
  }
  if (totalBridges > contract.max_bridged_crossings) {
    violations.push({ code: "BRIDGE_BUDGET", element: "diagram", actual: totalBridges, limit: contract.max_bridged_crossings });
  }

  let minimumGap = null;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [firstId, first] = nodes[i];
      const [secondId, second] = nodes[j];
      const gap = rectangleGap(first, second);
      minimumGap = minimumGap === null ? gap : Math.min(minimumGap, gap);
      if (gap + 1e-6 < contract.min_node_gap) {
        violations.push({
          code: "NODE_GAP", element: `${firstId},${secondId}`, actual: round2(gap), limit: contract.min_node_gap,
        });
      }
    }
  }

  let minimumGutter = null;
  for (const [nodeId, node] of nodes) {
    const match = containingContainer(node, containers);
    if (!match) continue;
    const [containerId, container] = match;
    const gutter = containerGutter(node, container);
    minimumGutter = minimumGutter === null ? gutter : Math.min(minimumGutter, gutter);
    if (gutter + 1e-6 < contract.min_container_gutter) {
      violations.push({
        code: "CONTAINER_GUTTER", element: `${nodeId}@${containerId}`, actual: round2(gutter), limit: contract.min_container_gutter,
      });
    }
  }

  const penalty = violations.length * 12 + totalBridges * 8 + Math.max(0, totalBends - edges.length) * 2;
  return {
    profile: contract.profile,
    ok: violations.length === 0,
    score: Math.max(0, 100 - penalty),
    metrics: {
      total_bends: totalBends,
      bridged_crossings: totalBridges,
      max_route_stretch: round2(maxStretch),
      minimum_node_gap: minimumGap === null ? null : round2(minimumGap),
      minimum_container_gutter: minimumGutter === null ? null : round2(minimumGutter),
      shortest_segment: shortestSegment === null ? null : round2(shortestSegment),
    },
    limits: { ...contract },
    violations,
  };
};
