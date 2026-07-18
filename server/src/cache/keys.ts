// 所有 Redis 缓存 Key 统一管理
export const CacheKeys = {
    //tenant租户的ROOT组织树（全量）
    rootGroupTree: (tenantId: string) => `user:group:rootTree:${tenantId}`,
    //tenant租户下用户的组织树列表（若干从ROOT截取下来的分支的名称列表）
    userGroupIds: (userId: string, tenantId: string) => `user:group:groupIds:${userId}:${tenantId}`,

    // 动态表字段
    dynamicTableFields: (tenantId: string, tableId: string) => `user:dynamicTable:${tenantId}:${tableId}`,

    // 租户相关
    tenantList: () => `auth:tenant:list`,
    tenant: (id: string) => `auth:tenant:${id}`,

    // 用户相关
    userList: (tenantId: string) => `auth:user:list:${tenantId}`,
    user: (id: string) => `auth:user:${id}`,

    // 角色相关
    roleList: (tenantId: string) => `auth:role:list:${tenantId}`,
    role: (id: string) => `auth:role:${id}`,

    // 权限相关
    permissionList: () => `auth:permission:list`,
    permission: (id: string) => `auth:permission:${id}`,

    // 群组相关
    groupList: (tenantId: string) => `auth:group:list:${tenantId}`,
    group: (id: string) => `auth:group:${id}`,
};

// 过期时间（秒）
export const CacheTTL = {
    GROUP_TREE: 900,
    USER_GROUP: 1800,
    TABLE_FIELDS: 900,
    TENANT: 1800,
    USER: 600,
    ROLE: 1800,
    PERMISSION: 3600,
    GROUP: 1800,
}
