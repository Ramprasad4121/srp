/**
 * Represents a node in the project dependency graph.
 */
export interface ProjectNode {
  readonly id: string;
  readonly name: string;
  readonly filePath: string;
  readonly kind: "contract" | "interface" | "library" | "abstract";
  readonly inheritsFrom: readonly string[];
  readonly imports: readonly string[];
}

/**
 * Represents an edge in the project dependency graph.
 */
export interface ProjectEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly relationship: "inherits" | "imports" | "calls" | "delegates";
}

/**
 * The full project dependency graph.
 */
export interface ProjectGraph {
  readonly nodes: readonly ProjectNode[];
  readonly edges: readonly ProjectEdge[];
}

/**
 * Creates an empty project graph.
 */
export function createEmptyGraph(): ProjectGraph {
  return { nodes: [], edges: [] };
}

/**
 * Adds a node to the graph (immutable).
 */
export function addNode(graph: ProjectGraph, node: ProjectNode): ProjectGraph {
  return {
    ...graph,
    nodes: [...graph.nodes, node]
  };
}

/**
 * Adds an edge to the graph (immutable).
 */
export function addEdge(graph: ProjectGraph, edge: ProjectEdge): ProjectGraph {
  return {
    ...graph,
    edges: [...graph.edges, edge]
  };
}

/**
 * Finds all nodes that a given node depends on (direct dependencies).
 */
export function getDirectDependencies(graph: ProjectGraph, nodeId: string): readonly ProjectNode[] {
  const edgeTargets = graph.edges
    .filter((edge) => edge.fromId === nodeId)
    .map((edge) => edge.toId);
  return graph.nodes.filter((node) => edgeTargets.includes(node.id));
}

/**
 * Finds all nodes that depend on the given node (reverse dependencies).
 */
export function getReverseDependencies(graph: ProjectGraph, nodeId: string): readonly ProjectNode[] {
  const edgeSources = graph.edges
    .filter((edge) => edge.toId === nodeId)
    .map((edge) => edge.fromId);
  return graph.nodes.filter((node) => edgeSources.includes(node.id));
}

/**
 * Simple topological sort for the graph.
 * Returns nodes in dependency order (dependencies first).
 */
export function topologicalSort(graph: ProjectGraph): readonly ProjectNode[] {
  const visited = new Set<string>();
  const result: ProjectNode[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const deps = graph.edges
      .filter((e) => e.fromId === nodeId)
      .map((e) => e.toId);

    for (const dep of deps) {
      visit(dep);
    }

    const node = nodeMap.get(nodeId);
    if (node) result.push(node);
  }

  for (const node of graph.nodes) {
    visit(node.id);
  }

  return result;
}
