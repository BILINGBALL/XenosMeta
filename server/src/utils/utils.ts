type GroupItem = {
    id: string;
    parentId: string | null;
    [key: string]: any;
};

export function buildGroupTree<T extends GroupItem>(list: T[]): T | null {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // 1. 先把所有节点放入 map，并初始化 children
    list.forEach(item => {
        map.set(item.id, { ...item, children: [] });
    });

    // 2. 组装父子关系
    list.forEach(item => {
        const current = map.get(item.id);
        if (item.parentId === null) {
            roots.push(current);
        } else {
            const parent = map.get(item.parentId);
            if (parent) {
                parent.children.push(current);
            }
        }
    });

    return roots[0] || null;
}