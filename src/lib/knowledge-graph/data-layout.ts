import { type DataNode, type DataEdge } from "@/hooks/use-data-graph";

export interface LayoutDataNode extends DataNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

export function computeDataLayout(
  nodes: DataNode[],
  edges: DataEdge[],
  options: { width: number; height: number; iterations: number },
  existingPositions?: Map<string, { x: number; y: number; fx?: number | null; fy?: number | null }>
): LayoutDataNode[] {
  const { width, height, iterations } = options;
  const cx = width / 2;
  const cy = height / 2;

  if (nodes.length === 0) return [];

  // Group nodes by connections
  const adjacency = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    if (!adjacency.has(e.target)) adjacency.set(e.target, []);
    adjacency.get(e.source)!.push(e.target);
    adjacency.get(e.target)!.push(e.source);
  });

  // Find root node (prefer company node or most connected node)
  const rootNode =
    nodes.find((n) => n.table === "companies") ||
    nodes.reduce((prev, curr) => {
      const prevConns = adjacency.get(prev.id)?.length || 0;
      const currConns = adjacency.get(curr.id)?.length || 0;
      return currConns > prevConns ? curr : prev;
    }, nodes[0]);

  // Initial layout: Radial ring distribution around the root
  const nonRootNodes = nodes.filter((n) => n.id !== rootNode?.id);
  const layoutNodes: LayoutDataNode[] = nodes.map((n) => {
    const existing = existingPositions?.get(n.id);
    if (existing && (existing.fx !== undefined && existing.fx !== null)) {
      return {
        ...n,
        x: existing.x,
        y: existing.y,
        vx: 0,
        vy: 0,
        fx: existing.fx,
        fy: existing.fy,
      };
    }

    if (n.id === rootNode?.id) {
      return {
        ...n,
        x: existing?.x ?? cx,
        y: existing?.y ?? cy,
        vx: 0,
        vy: 0,
        fx: existing?.fx ?? cx,
        fy: existing?.fy ?? cy,
      };
    }

    // Place in radial rings based on index
    const index = nonRootNodes.findIndex((item) => item.id === n.id);
    const ringRadius = 220 + Math.floor(index / 8) * 160;
    const ringItems = Math.min(8, nonRootNodes.length);
    const angle = ((index % 8) * (2 * Math.PI)) / ringItems + (Math.floor(index / 8) * 0.4);

    return {
      ...n,
      x: existing?.x ?? cx + Math.cos(angle) * ringRadius,
      y: existing?.y ?? cy + Math.sin(angle) * ringRadius,
      vx: 0,
      vy: 0,
      fx: existing?.fx,
      fy: existing?.fy,
    };
  });

  const nodeMap = new Map<string, LayoutDataNode>();
  layoutNodes.forEach((n) => nodeMap.set(n.id, n));

  const repulsion = 45000;
  const idealDistance = 200;
  const minNodeSeparation = 130;
  const attraction = 0.025;
  const damping = 0.85;

  for (let i = 0; i < iterations; i++) {
    // 1. Hard collision repulsion & pairwise repulsive forces
    for (let j = 0; j < layoutNodes.length; j++) {
      for (let k = j + 1; k < layoutNodes.length; k++) {
        const n1 = layoutNodes[j];
        const n2 = layoutNodes[k];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) {
          dist = 1;
        }

        // Strong push if closer than minNodeSeparation
        let force = repulsion / (dist * dist);
        if (dist < minNodeSeparation) {
          force += (minNodeSeparation - dist) * 0.4;
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (n1.fx === undefined || n1.fx === null) {
          n1.vx += fx;
          n1.vy += fy;
        }
        if (n2.fx === undefined || n2.fx === null) {
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }
    }

    // 2. Spring attraction along connected edges
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const delta = dist - idealDistance;
          const force = delta * attraction;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source.fx === undefined || source.fx === null) {
            source.vx += fx;
            source.vy += fy;
          }
          if (target.fx === undefined || target.fx === null) {
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      }
    });

    // 3. Update positions with damping
    layoutNodes.forEach((n) => {
      if (n.fx !== undefined && n.fx !== null) {
        n.x = n.fx;
        n.vx = 0;
      } else {
        // Soft center gravity
        const cdx = cx - n.x;
        const cdy = cy - n.y;
        n.vx += cdx * 0.005;
        n.vy += cdy * 0.005;

        n.vx *= damping;
        n.vy *= damping;

        n.x += n.vx;
        n.y += n.vy;
      }

      // Keep within bounds
      n.x = Math.max(80, Math.min(width - 80, n.x));
      n.y = Math.max(80, Math.min(height - 80, n.y));
    });
  }

  return layoutNodes;
}
