import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../types';

/**
 * Ước tính chiều cao không gian cần thiết cho mỗi ô (bao gồm khoảng đệm dọc)
 */
function getEstimatedNodeSlotHeight(node?: CustomNode): number {
  if (!node) return 140;
  const shape = node.data?.shape || 'pill';
  if (shape === 'full') return 420;
  if (shape === 'card') return 175;
  return 125;
}

/**
 * Ước tính khoảng cách ngang giữa các tầng
 */
function getEstimatedLevelGap(node?: CustomNode): number {
  if (!node) return 350;
  const shape = node.data?.shape || 'pill';
  if (shape === 'full') return 490;
  if (shape === 'card') return 360;
  return 330;
}

/**
 * Tự động sắp xếp vị trí các ô theo cấu trúc Sơ đồ tư duy Hình cây Phân tầng (Hierarchical Mindmap Tree)
 * - Ô gốc ở trung tâm, các nhánh cấp 1, cấp 2, cấp 3 tỏa sang phải/trái cân đối, không đè lên nhau.
 */
export function computeHierarchicalTreeLayout(
  nodes: CustomNode[],
  edges: Edge[],
  centerOrigin = { x: 480, y: 320 }
): CustomNode[] {
  if (!nodes || nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [
      {
        ...nodes[0],
        position: { x: centerOrigin.x, y: centerOrigin.y },
      },
    ];
  }

  const nodeById = new Map<string, CustomNode>();
  nodes.forEach((n) => nodeById.set(n.id, n));

  const outAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const undirectedAdj = new Map<string, string[]>();

  nodes.forEach((n) => {
    outAdj.set(n.id, []);
    inDegree.set(n.id, 0);
    undirectedAdj.set(n.id, []);
  });

  edges.forEach((e) => {
    if (!nodeById.has(e.source) || !nodeById.has(e.target) || e.source === e.target) return;
    outAdj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    undirectedAdj.get(e.source)?.push(e.target);
    undirectedAdj.get(e.target)?.push(e.source);
  });

  // Chọn ứng viên làm Root tốt nhất: ưu tiên inDegree === 0 có nhiều nhánh ra nhất, hoặc node đầu tiên có nhiều kết nối nhất
  const candidates = [...nodes].sort((a, b) => {
    const inA = inDegree.get(a.id) || 0;
    const inB = inDegree.get(b.id) || 0;
    if (inA === 0 && inB > 0) return -1;
    if (inB === 0 && inA > 0) return 1;
    const outA = outAdj.get(a.id)?.length || 0;
    const outB = outAdj.get(b.id)?.length || 0;
    if (outB !== outA) return outB - outA;
    return 0;
  });

  const visited = new Set<string>();
  const treeChildren = new Map<string, string[]>();
  nodes.forEach((n) => treeChildren.set(n.id, []));

  const roots: string[] = [];

  const buildSpanningTree = (rootId: string) => {
    const queue: string[] = [rootId];
    visited.add(rootId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const directTargets = outAdj.get(curr) || [];
      const fallbackNeighbors = undirectedAdj.get(curr) || [];
      const nextList = [...directTargets, ...fallbackNeighbors];
      for (const nxt of nextList) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          treeChildren.get(curr)?.push(nxt);
          queue.push(nxt);
        }
      }
    }
  };

  for (const cand of candidates) {
    if (!visited.has(cand.id)) {
      roots.push(cand.id);
      buildSpanningTree(cand.id);
    }
  }

  // Tính chiều cao cần thiết cho mỗi cây con (Subtree Height)
  const subtreeHeight = new Map<string, number>();
  const calcHeight = (nodeId: string): number => {
    const ch = treeChildren.get(nodeId) || [];
    const selfH = getEstimatedNodeSlotHeight(nodeById.get(nodeId));
    if (ch.length === 0) {
      subtreeHeight.set(nodeId, selfH);
      return selfH;
    }
    const sumChildren = ch.reduce((acc, cId) => acc + calcHeight(cId), 0);
    const h = Math.max(selfH, sumChildren);
    subtreeHeight.set(nodeId, h);
    return h;
  };

  roots.forEach((r) => calcHeight(r));

  const positions = new Map<string, { x: number; y: number }>();

  // Hàm đệ quy đặt vị trí cho một nhánh theo hướng (dir = 1: sang phải, dir = -1: sang trái)
  const layoutBranch = (nodeId: string, x: number, centerY: number, dir: 1 | -1) => {
    positions.set(nodeId, { x: Math.round(x), y: Math.round(centerY) });
    const ch = treeChildren.get(nodeId) || [];
    if (ch.length === 0) return;

    const totalH = ch.reduce((acc, cId) => acc + (subtreeHeight.get(cId) || 130), 0);
    let cursorY = centerY - totalH / 2;
    const stepX = getEstimatedLevelGap(nodeById.get(nodeId)) * dir;

    for (const cId of ch) {
      const cH = subtreeHeight.get(cId) || 130;
      const childCenterY = cursorY + cH / 2;
      layoutBranch(cId, x + stepX, childCenterY, dir);
      cursorY += cH;
    }
  };

  // Xử lý Root chính đầu tiên: Nếu có từ 4 nhánh con cấp 1 trở lên, chia đều 2 cánh Phải & Trái cho cân đối chuẩn Mindmap
  const mainRoot = roots[0];
  if (mainRoot) {
    positions.set(mainRoot, { x: centerOrigin.x, y: centerOrigin.y });
    const topChildren = treeChildren.get(mainRoot) || [];
    const rootStepX = getEstimatedLevelGap(nodeById.get(mainRoot));

    if (topChildren.length >= 4) {
      const half = Math.ceil(topChildren.length / 2);
      const rightChildren = topChildren.slice(0, half);
      const leftChildren = topChildren.slice(half);

      // Cánh phải (+X)
      const rightTotalH = rightChildren.reduce((acc, id) => acc + (subtreeHeight.get(id) || 130), 0);
      let cursorRightY = centerOrigin.y - rightTotalH / 2;
      for (const cId of rightChildren) {
        const cH = subtreeHeight.get(cId) || 130;
        layoutBranch(cId, centerOrigin.x + rootStepX, cursorRightY + cH / 2, 1);
        cursorRightY += cH;
      }

      // Cánh trái (-X)
      const leftTotalH = leftChildren.reduce((acc, id) => acc + (subtreeHeight.get(id) || 130), 0);
      let cursorLeftY = centerOrigin.y - leftTotalH / 2;
      for (const cId of leftChildren) {
        const cH = subtreeHeight.get(cId) || 130;
        layoutBranch(cId, centerOrigin.x - rootStepX, cursorLeftY + cH / 2, -1);
        cursorLeftY += cH;
      }
    } else {
      // Nếu ít hơn 4 nhánh con cấp 1, tỏa sang phải theo cây phân cấp chuẩn
      const totalH = topChildren.reduce((acc, id) => acc + (subtreeHeight.get(id) || 130), 0);
      let cursorY = centerOrigin.y - totalH / 2;
      for (const cId of topChildren) {
        const cH = subtreeHeight.get(cId) || 130;
        layoutBranch(cId, centerOrigin.x + rootStepX, cursorY + cH / 2, 1);
        cursorY += cH;
      }
    }
  }

  // Các cụm rời rạc hoặc ô độc lập khác (nếu có): xếp gọn bên dưới cây chính
  if (roots.length > 1) {
    const mainTreeMaxY = Math.max(
      centerOrigin.y + 220,
      ...Array.from(positions.values()).map((p) => p.y + 180)
    );
    let extraCursorY = mainTreeMaxY;
    let isolatedCol = 0;

    for (let i = 1; i < roots.length; i++) {
      const rId = roots[i];
      const ch = treeChildren.get(rId) || [];
      if (ch.length > 0) {
        const rH = subtreeHeight.get(rId) || 160;
        layoutBranch(rId, centerOrigin.x - 200, extraCursorY + rH / 2, 1);
        extraCursorY += rH + 80;
      } else {
        // Ô đơn lẻ không có dây nối: xếp thành lưới ngang gọn gàng
        const col = isolatedCol % 3;
        const row = Math.floor(isolatedCol / 3);
        positions.set(rId, {
          x: Math.round(centerOrigin.x - 320 + col * 320),
          y: Math.round(extraCursorY + row * 140),
        });
        isolatedCol++;
      }
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) || n.position,
  }));
}
