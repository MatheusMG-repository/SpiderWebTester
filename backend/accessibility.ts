import { Page } from 'playwright';

export async function getAccessibilityTree(page: Page): Promise<any> {
  const client = await page.context().newCDPSession(page);
  const { nodes } = await client.send('Accessibility.getFullAXTree');
  const nodeMap = new Map<string, any>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }
  
  function isInteresting(node: any): boolean {
    if (node.ignored) return false;
    const role = node.role?.value;
    if (role === 'none' || role === 'presentation') return false;
    if (role === 'InlineTextBox') return false;
    return true;
  }
  
  function getEffectiveChildren(node: any): any[] {
    const result: any[] = [];
    if (!node.childIds) return result;
    for (const childId of node.childIds) {
      const child = nodeMap.get(childId);
      if (!child) continue;
      if (isInteresting(child)) {
        result.push(child);
      } else {
        result.push(...getEffectiveChildren(child));
      }
    }
    return result;
  }
  
  function serializeNode(node: any): any {
    const serialized: any = {};
    if (node.role?.value) {
      serialized.role = node.role.value;
    }
    if (node.name?.value) {
      serialized.name = node.name.value;
    }
    if (node.properties) {
      for (const prop of node.properties) {
        const name = prop.name;
        const val = prop.value?.value;
        if (name === 'description' && val) serialized.description = val;
        else if (name === 'value' && val !== undefined) serialized.value = val;
        else if (name === 'disabled' && val === true) serialized.disabled = true;
        else if (name === 'expanded' && val === true) serialized.expanded = true;
        else if (name === 'focused' && val === true) serialized.focused = true;
        else if (name === 'level' && typeof val === 'number') serialized.level = val;
        else if (name === 'keyshortcuts' && val) serialized.keyshortcuts = val;
        else if (name === 'roledescription' && val) serialized.roledescription = val;
        else if (name === 'valuetext' && val) serialized.valuetext = val;
      }
    }
    const children = getEffectiveChildren(node).map(serializeNode);
    if (children.length > 0) {
      serialized.children = children;
    }
    return serialized;
  }
  
  const rootNode = nodes.find((node: any) => node.role?.value === 'RootWebArea') || nodes[0];
  if (!rootNode) return null;
  return serializeNode(rootNode);
}
