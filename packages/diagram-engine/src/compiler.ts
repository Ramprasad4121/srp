import type { ProtocolDiagram, ExcalidrawDiagramElement } from "@srp/shared-types";

export const DIAGRAM_FAMILIES = [
  "protocol-map",
  "trust-boundary",
  "value-flow",
  "state-map",
  "interaction-matrix",
  "attack-path",
  "economic-risk",
  "privilege-map",
  "remediation-diff"
] as const;

export type DiagramFamily = typeof DIAGRAM_FAMILIES[number];

export interface DiagramNode {
  readonly id: string;
  readonly label: string;
}

export interface DiagramEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly label: string;
}

export interface CompileDiagramOptions {
  readonly family: DiagramFamily;
  readonly title: string;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

export function compileDiagram(options: CompileDiagramOptions): ProtocolDiagram {
  const compiler = new DiagramCompiler();
  return compiler.compile(options);
}

export function exportToExcalidrawJson(diagram: ProtocolDiagram): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "srp",
    elements: diagram.elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: 20
    },
    files: {}
  }, null, 2);
}

export class DiagramCompiler {
  compile(options: CompileDiagramOptions): ProtocolDiagram {
    const { title, nodes, edges } = options;
    const elements: ExcalidrawDiagramElement[] = [];
    const nodeMap = new Map<string, { x: number; y: number }>();

    let currentY = 100;
    for (const node of nodes) {
      const x = 100;
      const y = currentY;
      nodeMap.set(node.id, { x, y });

      elements.push({
        id: `rect_${node.id}`,
        type: "rectangle",
        x,
        y,
        width: 200,
        height: 50,
        angle: 0,
        seed: Math.random(),
        strokeColor: "#000000",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 1,
        opacity: 100
      });

      elements.push({
        id: `text_${node.id}`,
        type: "text",
        x: x + 10,
        y: y + 15,
        width: 180,
        height: 20,
        angle: 0,
        seed: Math.random(),
        text: node.label,
        fontSize: 16,
        fontFamily: 1,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        textAlign: "center",
        verticalAlign: "middle",
        opacity: 100
      });

      currentY += 100;
    }

    for (const edge of edges) {
      const from = nodeMap.get(edge.fromId);
      const to = nodeMap.get(edge.toId);

      if (from && to) {
        elements.push({
          id: `arrow_${edge.fromId}_${edge.toId}`,
          type: "arrow",
          x: from.x + 100,
          y: from.y + 50,
          width: 0,
          height: 0,
          angle: 0,
          seed: Math.random(),
          points: [[0, 0], [to.x - from.x, to.y - from.y - 50]],
          strokeColor: "#000000",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 1,
          opacity: 100,
          endArrowhead: "arrow"
        });
      }
    }

    return {
      type: "excalidraw",
      version: 2,
      source: "srp",
      title,
      summary: `Generated diagram for ${title}`,
      elements,
      generatedByModel: "DiagramCompiler"
    };
  }
}
