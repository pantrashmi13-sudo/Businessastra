// Force-directed layout engine for the knowledge graph
// Uses a simple spring-electric model without external dependencies

import { type GraphNode, type GraphEdge, CLUSTERS } from "./schema";

interface LayoutOptions {
  width: number;
  height: number;
  iterations: number;
  /** Repulsion strength between nodes */
  repulsion: number;
  /** Attraction strength along edges */
  attraction: number;
  /** Target edge length */
  edgeLength: number;
  /** Damping factor (0-1) */
  damping: number;
  /** Cluster gravity — pull nodes toward their cluster center */
  clusterGravity: number;
}

const DEFAULTS: LayoutOptions = {
  width: 1200,
  height: 800,
  iterations: 300,
  repulsion: 8000,
  attraction: 0.005,
  edgeLength: 160,
  damping: 0.92,
  clusterGravity: 0.01,
};

/** Compute cluster center positions in a circle */
function getClusterCenters(
  clusters: typeof CLUSTERS,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const centers = new Map<string, { x: number; y: number }>();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const angleStep = (2 * Math.PI) / clusters.length;

  clusters.forEach((cluster, i) => {
    const angle = angleStep * i - Math.PI / 2;
    centers.set(cluster.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return centers;
}

/** Initialize node positions within their cluster */
function initializePositions(nodes: GraphNode[], width: number, height: number): void {
  const clusterCenters = getClusterCenters(CLUSTERS, width, height);

  // Group nodes by cluster
  const clusterNodes = new Map<string, GraphNode[]>();
  for (const cluster of CLUSTERS) {
    clusterNodes.set(cluster.id, []);
  }

  for (const node of nodes) {
    const cluster = CLUSTERS.find((c) => c.nodeIds.includes(node.id));
    if (cluster) {
      clusterNodes.get(cluster.id)!.push(node);
    }
  }

  // Position each node near its cluster center with jitter
  for (const [clusterId, cNodes] of clusterNodes) {
    const center = clusterCenters.get(clusterId) || { x: width / 2, y: height / 2 };
    const count = cNodes.length;
    const cols = Math.ceil(Math.sqrt(count));

    cNodes.forEach((node, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const spacing = 80;
      node.x = center.x + (col - cols / 2) * spacing + (Math.random() - 0.5) * 20;
      node.y =
        center.y + (row - Math.ceil(count / cols) / 2) * spacing + (Math.random() - 0.5) * 20;
      node.vx = 0;
      node.vy = 0;
    });
  }
}

/** Run the force simulation */
export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: Partial<LayoutOptions>,
): GraphNode[] {
  const opts = { ...DEFAULTS, ...options };
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const clusterCenters = getClusterCenters(CLUSTERS, opts.width, opts.height);

  initializePositions(nodes, opts.width, opts.height);

  for (let iter = 0; iter < opts.iterations; iter++) {
    const temperature = 1 - iter / opts.iterations; // cooling

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;

        const force = (opts.repulsion * temperature) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;

      const displacement = dist - opts.edgeLength;
      const force = opts.attraction * displacement * temperature;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Cluster gravity
    for (const node of nodes) {
      const cluster = CLUSTERS.find((c) => c.nodeIds.includes(node.id));
      if (!cluster) continue;
      const center = clusterCenters.get(cluster.id);
      if (!center) continue;

      node.vx += (center.x - node.x) * opts.clusterGravity * temperature;
      node.vy += (center.y - node.y) * opts.clusterGravity * temperature;
    }

    // Center gravity (mild)
    const cx = opts.width / 2;
    const cy = opts.height / 2;
    for (const node of nodes) {
      node.vx += (cx - node.x) * 0.0005 * temperature;
      node.vy += (cy - node.y) * 0.0005 * temperature;
    }

    // Apply velocity with damping and clamp to bounds
    const margin = 60;
    for (const node of nodes) {
      node.vx *= opts.damping;
      node.vy *= opts.damping;
      node.x += node.vx;
      node.y += node.vy;

      // Clamp
      node.x = Math.max(margin, Math.min(opts.width - margin, node.x));
      node.y = Math.max(margin, Math.min(opts.height - margin, node.y));
    }
  }

  return nodes;
}

/** Compute edge midpoint for label placement */
export function getEdgeMidpoint(source: GraphNode, target: GraphNode): { x: number; y: number } {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
}

/** Compute curved path for parallel edges between same node pair */
export function getEdgePath(source: GraphNode, target: GraphNode, curveOffset: number = 0): string {
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;

  if (curveOffset === 0) {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }

  // Perpendicular offset for curve
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const cx = mx + nx * curveOffset;
  const cy = my + ny * curveOffset;

  return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
}
