import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';

/**
 * 一次性校验 单条 / 多条 数据是否属于用户群组
 * @param modelName 表名
 * @param ids 要校验的 ID 数组
 * @param user 当前登录用户
 * @returns 全部合法返回 true，否则 false
 */
export async function checkGroupIds(
    modelName: keyof typeof prisma,
    ids: string[],
    user: any
): Promise<boolean> {
    // 1. 超级管理员直接放行
    const userRoles = await prisma.userRole.findMany({
        where: {userId: user.id},
        include: {role: true},
    });
    const isSuperAdmin = userRoles.some((ur: any) => ur.role.roleCode === 'system_admin');
    if (isSuperAdmin) return true;

    // 2. 没有群组等于什么都看不到
    const userGroupIds = user.groupIds || [];
    if (userGroupIds.length === 0) return false;

    // 3. 🔥 只查一次库，拿到所有数据的 groupId
    const records = await (prisma[modelName] as any).findMany({
        where: {id: {in: ids}},
        select: {groupId: true},
    });

    // 4. 只要有一条不属于用户，直接返回 false
    for (const record of records) {
        if (!userGroupIds.includes(record.groupId)) {
            return false;
        }
    }

    // 5. 全部校验通过
    return true;
}


/**
 * 群组列表项基础类型
 * 包含必须的 id 和 parentId，其他字段灵活兼容
 */
type GroupItem = {
    id: string;
    parentId: string | null;
    [key: string]: any;
};

/**
 * 【核心函数】将平铺的群组数组 转换为 无限层级树形结构
 * 适配你的数据结构：parentId = null 为根节点
 * @param list 平铺的群组全量列表（所有层级）
 * @returns 完整的树形结构根节点（无限嵌套）
 */
export function buildGroupTree<T extends GroupItem>(list: T[]): T | null {
    // 用于快速查找节点的 Map（key: 节点id, value: 节点对象）
    const map = new Map<string, any>();
    // 存储根节点（parentId = null）
    const roots: any[] = [];

    // 第一步：遍历所有节点，存入 Map 并初始化 children 数组
    // 作用：给每个节点都加上空的 children，方便后续挂载子节点
    list.forEach((item) => {
        map.set(item.id, {...item, children: []});
    });

    // 第二步：构建父子关联关系
    list.forEach((item) => {
        // 从 Map 中获取当前节点
        const currentNode = map.get(item.id);

        // 判断是否为根节点（parentId === null）
        if (item.parentId === null) {
            // 根节点直接放入 roots 数组
            roots.push(currentNode);
        } else {
            // 非根节点 → 找到它的父节点
            const parentNode = map.get(item.parentId);
            // 如果父节点存在，就把当前节点挂载到父节点的 children 里
            if (parentNode) {
                parentNode.children.push(currentNode);
            }
        }
    });

    // 返回唯一的根节点（租户只有一个根组织），没有则返回 null
    return roots[0] || null;
}


/**
 * 从完整的 groupTree 中，截取指定 id 节点的【子树】
 * 只保留：当前节点 + 所有子孙节点
 * 上级、同级全部剔除
 * @param rootTree 完整的根组织树（你给的那一大棵）
 * @param groupId 要截取的目标 groupId
 * @returns 截取后的子树（当前节点为根），找不到返回 null
 */
export function getSubGroupTree(
    rootTree: any,
    groupId: string
): any | null {
    // 1. 如果当前节点就是目标节点 → 直接返回整棵子树（完美！）
    if (rootTree.id === groupId) {
        return JSON.parse(JSON.stringify(rootTree)); // 深拷贝，避免污染原树
    }

    // 2. 如果当前节点有 children → 递归往下找
    if (rootTree.children && rootTree.children.length > 0) {
        for (const child of rootTree.children) {
            const result = getSubGroupTree(child, groupId);
            // 找到了！直接返回
            if (result) return result;
        }
    }

    // 3. 没找到
    return null;
}


/**
 * 【权限校验】判断 资源的groupId 是否在用户的权限子树内
 * @param userGroupTree 从Redis取出的用户权限子树
 * @param targetGroupId 资源身上的 groupId（要校验的目标）
 * @returns boolean true=有权限 false=无权限
 */
export function hasGroupPermission(userGroupTree: any, targetGroupId: string): boolean {

    if (!userGroupTree || !targetGroupId) return false;

    // 直接复用你已经有的函数！
    const result = getSubGroupTree(userGroupTree, targetGroupId);

    // 能找到 = 有权限
    return result !== null; //true or false
}

/**
 * 从权限树中提取 【根节点 + 所有子孙节点】的 group id 集合
 * @param userGroupTree 权限树（userGroupTree / rootTree）
 * @returns 所有 group id 数组（去重、扁平）
 */
export function extractAllGroupIds(userGroupTree: any): string[] {
    const groupIds = new Set<string>();

    // 递归遍历节点
    function traverse(node: any) {
        if (!node) return;

        // 把当前节点的 groupId 加入集合
        if (node.id) {
            groupIds.add(node.id);
        }

        // 递归遍历 children（如果有）
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child: any) => traverse(child));
        }
    }

    // 开始遍历整棵树
    traverse(userGroupTree);

    // 转成数组返回
    return Array.from(groupIds);
}