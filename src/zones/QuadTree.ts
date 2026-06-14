export interface QuadTreeNode {
  x: number;
  y: number;
  size: number;
  depth: number;
}

export function getChildNodes(node: QuadTreeNode): QuadTreeNode[] {
  const childSize = node.size / 2;
  const depth = node.depth + 1;
  return [
    { x: node.x, y: node.y, size: childSize, depth },
    { x: node.x + childSize, y: node.y, size: childSize, depth },
    { x: node.x, y: node.y + childSize, size: childSize, depth },
    { x: node.x + childSize, y: node.y + childSize, size: childSize, depth },
  ];
}
