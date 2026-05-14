export type Cleanup = () => void;

const cleanupMap = new WeakMap<Node, Cleanup[]>();

export function addCleanup(node: Node, cleanup: void | Cleanup | null | undefined): void {
  if (typeof cleanup !== "function") return;
  const existing = cleanupMap.get(node);
  if (existing) {
    existing.push(cleanup);
    return;
  }
  cleanupMap.set(node, [cleanup]);
}

export function cleanupNode(node: Node): void {
  const own = cleanupMap.get(node);
  if (own) {
    cleanupMap.delete(node);
    for (let i = own.length - 1; i >= 0; i -= 1) {
      try {
        own[i]?.();
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  for (const child of Array.from(node.childNodes)) {
    cleanupNode(child);
  }
}

export function removeNode(node: Node): void {
  cleanupNode(node);
  node.parentNode?.removeChild(node);
}

export function replaceChildrenClean(parent: Node, children: Node[]): void {
  for (const child of Array.from(parent.childNodes)) {
    cleanupNode(child);
    parent.removeChild(child);
  }
  for (const child of children) parent.appendChild(child);
}

export function clearBetween(start: Node, end: Node): void {
  let cursor = start.nextSibling;
  while (cursor && cursor !== end) {
    const next = cursor.nextSibling;
    removeNode(cursor);
    cursor = next;
  }
}
