// Input normalization ported from diagram_ir.py (semantic-contract validation
// lives in styles.js; engineering enrichers are out of scope for v1).

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const deepCopy = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

const finite = (value, path) => {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) throw new Error(`${path} must be a finite number`);
  return n;
};

const validateNumericFields = (item, fields, path) => {
  for (const field of fields) {
    if (item[field] !== undefined && item[field] !== null) finite(item[field], `${path}.${field}`);
  }
};

// Validates and normalizes the input JSON in place-safe fashion (returns a copy).
export const normalizeDiagram = (data, expectedMode, resolveStyle) => {
  if (!isPlainObject(data)) throw new Error("diagram input must be a JSON object");
  const normalized = deepCopy(data);
  const inputSchema = "schema_version" in normalized ? "v1" : "legacy";
  const schemaVersion = normalized.schema_version ?? 1;
  if (typeof schemaVersion === "boolean" || schemaVersion !== 1) {
    throw new Error(`unsupported schema_version: ${schemaVersion}`);
  }

  const mode = String(normalized.mode || normalized.template_type || expectedMode);
  if (normalized.mode && mode !== expectedMode) {
    throw new Error(`mode ${JSON.stringify(mode)} conflicts with template type ${JSON.stringify(expectedMode)}`);
  }
  normalized.schema_version = 1;
  normalized.mode = mode;

  validateNumericFields(normalized, ["width", "height"], "diagram");
  for (const field of ["width", "height"]) {
    if (field in normalized && finite(normalized[field], `diagram.${field}`) <= 0) {
      throw new Error(`diagram.${field} must be greater than zero`);
    }
  }

  const rawContainers = normalized.containers ?? [];
  if (!Array.isArray(rawContainers)) throw new Error("containers must be an array");
  const containers = [];
  const containerIds = new Set();
  rawContainers.forEach((rawContainer, index) => {
    if (!isPlainObject(rawContainer)) throw new Error(`containers[${index}] must be an object`);
    const container = deepCopy(rawContainer);
    const containerId = String(container.id || "").trim();
    if (!containerId) throw new Error(`containers[${index}].id must be a non-empty string`);
    if (containerIds.has(containerId)) throw new Error(`duplicate container id: ${containerId}`);
    containerIds.add(containerId);
    container.id = containerId;
    validateNumericFields(container, ["x", "y", "width", "height"], `containers[${index}]`);
    containers.push(container);
  });
  normalized.containers = containers;

  const rawNodes = normalized.nodes ?? [];
  if (!Array.isArray(rawNodes)) throw new Error("nodes must be an array");
  const nodeIds = new Set();
  rawNodes.forEach((rawNode, index) => {
    if (!isPlainObject(rawNode)) throw new Error(`nodes[${index}] must be an object`);
    const node = rawNode;
    const nodeId = String(node.id || `node-${String(index).padStart(3, "0")}`);
    if (nodeIds.has(nodeId)) throw new Error(`duplicate node id: ${nodeId}`);
    if (containerIds.has(nodeId)) throw new Error(`duplicate diagram id: ${nodeId}`);
    nodeIds.add(nodeId);
    node.id = nodeId;
    validateNumericFields(node, ["x", "y", "width", "height", "r", "offset_y"], `nodes[${index}]`);
  });

  if ("edges" in normalized && !("arrows" in normalized)) {
    normalized.arrows = normalized.edges;
    delete normalized.edges;
  }
  const rawEdges = normalized.arrows ?? [];
  if (!Array.isArray(rawEdges)) throw new Error("arrows must be an array");
  const edgeIds = new Set();
  rawEdges.forEach((rawEdge, index) => {
    if (!isPlainObject(rawEdge)) throw new Error(`arrows[${index}] must be an object`);
    const edge = rawEdge;
    const edgeId = String(edge.id || `edge-${String(index).padStart(3, "0")}`);
    if (edgeIds.has(edgeId)) throw new Error(`duplicate edge id: ${edgeId}`);
    if (containerIds.has(edgeId) || nodeIds.has(edgeId)) {
      throw new Error(`duplicate diagram id: ${edgeId}`);
    }
    edgeIds.add(edgeId);
    edge.id = edgeId;
    const source = edge.source !== null && edge.source !== undefined ? String(edge.source) : null;
    const target = edge.target !== null && edge.target !== undefined ? String(edge.target) : null;
    for (const [name, endpoint] of [["source", source], ["target", target]]) {
      if (endpoint && !nodeIds.has(endpoint)) {
        throw new Error(`arrows[${index}].${name} references unknown node: ${endpoint}`);
      }
    }
    validateNumericFields(edge, ["x1", "y1", "x2", "y2", "label_dx", "label_dy", "routing_padding", "port_clearance"], `arrows[${index}]`);
    const rawWaypoints = edge.route_points ?? [];
    if (!Array.isArray(rawWaypoints)) throw new Error(`arrows[${index}].route_points must be an array`);
    rawWaypoints.forEach((rawWaypoint, waypointIndex) => {
      if (!Array.isArray(rawWaypoint) || rawWaypoint.length !== 2) {
        throw new Error(`arrows[${index}].route_points[${waypointIndex}] must be [x, y]`);
      }
      finite(rawWaypoint[0], `arrows[${index}].route_points[${waypointIndex}][0]`);
      finite(rawWaypoint[1], `arrows[${index}].route_points[${waypointIndex}][1]`);
    });
  });

  const styleIndex = resolveStyle(normalized);
  return { inputSchema, mode, styleIndex, data: normalized };
};
