// Turn flat paths ("Trips/2024/Italy") into a nested tree. Used by the Tags and Folders pages.

export interface TreeNode {
  name: string;
  /** Full path from the root, e.g. "Trips/2024". */
  path: string;
  children: TreeNode[];
}

export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const full of paths) {
    let node = root;
    let path = '';
    for (const part of full.split('/').filter(Boolean)) {
      path = path ? `${path}/${part}` : part;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}
