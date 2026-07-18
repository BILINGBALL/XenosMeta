# Auth Core 系统安全架构设计

## 当前问题分析

### ❌ 存在的安全隐患

1. **权限失控**：每个 tenant 都可以管理自己的 `sys:tenant:*` 和 `sys:permission:*` 权限
2. **数据隔离不足**：tenant 可以随意修改全局权限配置
3. **角色分配混乱**：tenant 管理员可以给用户分配任何角色

### 🔴 核心风险

- 普通 tenant 可以创建/删除其他 tenant
- 普通 tenant 可以修改系统级权限
- 缺少统一的 tenant 管理系统

---

## 解决方案：分层权限架构

### 1. 角色分层

#### 1.1 系统管理员 (System Admin)
- **角色代码**: `system_admin`
- **所属范围**: 不属于任何 tenant（系统级）
- **权限范围**: 
  - ✅ 管理所有 tenant（创建、删除、修改）
  - ✅ 管理所有权限（创建、删除、修改）
  - ✅ 管理所有角色
  - ✅ 管理所有用户
  - ✅ 管理所有群组
  - ✅ 访问所有业务表

#### 1.2 租户管理员 (Tenant Admin)
- **角色代码**: `tenant_admin`
- **所属范围**: 属于特定 tenant
- **权限范围**:
  - ✅ 管理本 tenant 内的用户（user:*）
  - ✅ 管理本 tenant 内的角色（role:*，但不能修改系统权限）
  - ✅ 管理本 tenant 内的群组（group:*）
  - ✅ 访问本 tenant 的业务表（base:*）
  - ❌ **不能**管理其他 tenant
  - ❌ **不能**管理权限定义（permission:*）
  - ❌ **不能**分配系统级角色

#### 1.3 普通用户 (User)
- **角色代码**: `user`
- **所属范围**: 属于特定 tenant
- **权限范围**: 只读或自定义权限

---

### 2. 权限分层设计

#### 2.1 系统级权限（仅 system_admin 可用）

| 权限代码 | 说明 | 所属角色 |
|---------|------|---------|
| `sys:tenant:view` | 查看所有租户 | system_admin |
| `sys:tenant:add` | 创建新租户 | system_admin |
| `sys:tenant:edit` | 编辑租户信息 | system_admin |
| `sys:tenant:delete` | 删除租户 | system_admin |
| `sys:permission:view` | 查看所有权限 | system_admin |
| `sys:permission:add` | 创建新权限 | system_admin |
| `sys:permission:edit` | 编辑权限 | system_admin |
| `sys:permission:delete` | 删除权限 | system_admin |

#### 2.2 租户级权限（tenant_admin 和业务用户可用）

| 权限代码 | 说明 | 所属角色 |
|---------|------|---------|
| `sys:user:view` | 查看用户 | tenant_admin, user |
| `sys:user:add` | 创建用户 | tenant_admin |
| `sys:user:edit` | 编辑用户 | tenant_admin |
| `sys:user:delete` | 删除用户 | tenant_admin |
| `sys:user:assign` | 分配用户到群组 | tenant_admin |
| `sys:role:view` | 查看角色 | tenant_admin, user |
| `sys:role:add` | 创建角色 | tenant_admin |
| `sys:role:edit` | 编辑角色 | tenant_admin |
| `sys:role:delete` | 删除角色 | tenant_admin |
| `sys:role:assign` | 分配角色权限 | tenant_admin |
| `sys:group:view` | 查看群组 | tenant_admin, user |
| `sys:group:add` | 创建群组 | tenant_admin |
| `sys:group:edit` | 编辑群组 | tenant_admin |
| `sys:group:delete` | 删除群组 | tenant_admin |
| `base:*` | 业务表权限 | tenant_admin, user |

---

### 3. 体验租户机制

#### 3.1 体验租户特点
- **自动创建**：用户注册时自动创建体验租户
- **命名规范**：tenantCode 必须以 `exp_` 前缀开头
- **功能限制**：体验租户不能创建子租户
- **防止抢注**：正式租户名称受保护

#### 3.2 体验租户规则
```
用户注册 → 自动创建 exp_xxx 租户 → 分配 tenant_admin 角色
用户体验 → 如果满意 → 申请升级为正式租户（由 system_admin 审批）
```

#### 3.3 体验租户限制
- ❌ 不能创建其他 tenant
- ❌ 不能访问系统管理功能
- ❌ tenantCode 不能修改（防止抢注）
- ❌ 只能属于一个体验租户

---

### 4. 实施步骤

#### Phase 1: 创建系统管理员 (已完成)
- ✅ 创建 system_admin 角色
- ✅ 创建系统管理员用户
- ✅ 分配所有权限给 system_admin

#### Phase 2: 实现体验租户机制 (进行中)
- ⏳ 修改用户注册逻辑
- ⏳ 自动创建体验租户（exp_ 前缀）
- ⏳ 限制体验租户权限

#### Phase 3: 权限重构 (待完成)
- ⏳ 从 tenant_admin 移除 sys:tenant:* 和 sys:permission:*
- ⏳ 更新权限中间件
- ⏳ 添加权限校验逻辑

#### Phase 4: 测试和文档 (待完成)
- ⏳ 完整 API 测试
- ⏳ 更新文档

---

### 5. 数据库模型

#### 5.1 新增字段
```prisma
model Tenant {
  // 现有字段...
  type: String  @default("normal")  // "system" | "normal" | "experience"
  createdBy: String?  // system_admin 的用户ID
}
```

#### 5.2 角色关联
```prisma
model Role {
  scope: String  @default("tenant")  // "system" | "tenant"
  // 现有字段...
}
```

---

### 6. API 路由重构

#### 6.1 系统管理路由（仅 system_admin 可访问）
```
POST   /system/tenants              # 创建租户
GET    /system/tenants              # 获取所有租户
GET    /system/tenants/:id          # 获取租户详情
PUT    /system/tenants/:id          # 更新租户
DELETE /system/tenants/:id          # 删除租户

POST   /system/permissions          # 创建权限
GET    /system/permissions          # 获取所有权限
PUT    /system/permissions/:id      # 更新权限
DELETE /system/permissions/:id       # 删除权限
```

#### 6.2 租户管理路由（tenant_admin 可访问）
```
POST   /user/register                # 注册（自动创建体验租户）
GET    /user/list                    # 获取用户列表
POST   /user/assign-group            # 分配用户到群组

GET    /role                         # 获取角色列表
POST   /role                         # 创建角色
PUT    /role/:id                     # 更新角色
DELETE /role/:id                     # 删除角色

GET    /group                        # 获取群组列表
POST   /group                         # 创建群组
PUT    /group/:id                    # 更新群组
DELETE /group/:id                   # 删除群组

GET    /base/tables                  # 获取业务表
POST   /base/tables                  # 创建业务表
# ... 其他业务表操作
```

---

### 7. 权限校验逻辑

#### 7.1 中间件检查顺序
```typescript
// 1. 超级管理员跳过所有检查
if (user.roleCode === 'system_admin') {
  return next();
}

// 2. 检查权限作用域
if (permission.scope === 'system' && user.roleCode !== 'system_admin') {
  return res.status(403).json({
    code: 403,
    message: '需要系统管理员权限',
    success: false
  });
}

// 3. 检查数据隔离
if (permission.scope === 'tenant') {
  // 验证资源是否属于当前用户的 tenant
  if (resource.tenantId !== user.tenantId) {
    return res.status(403).json({
      code: 403,
      message: '无权访问该资源',
      success: false
    });
  }
}
```

#### 7.2 体验租户限制
```typescript
// 体验租户不能执行的操作
const restrictedActions = [
  'sys:tenant:add',      // 不能创建租户
  'sys:permission:add',   // 不能创建权限
  'sys:permission:edit',  // 不能修改权限
];

if (user.tenant.type === 'experience' && 
    restrictedActions.includes(permission.code)) {
  return res.status(403).json({
    code: 403,
    message: '体验租户无此权限',
    success: false
  });
}
```

---

## 总结

### 核心改进
1. ✅ **权限分层**：系统级 vs 租户级权限分离
2. ✅ **角色分级**：system_admin vs tenant_admin vs user
3. ✅ **体验租户**：安全的体验机制（exp_ 前缀）
4. ✅ **数据隔离**：严格的 tenant 数据隔离
5. ✅ **安全校验**：多层权限检查

### 安全保证
- 只有 system_admin 可以管理系统级资源
- tenant 管理员只能管理自己 tenant 内的资源
- 体验租户功能受限，防止滥用
- 完整的权限审计日志

---

## 下一步
1. 实现 system_admin 用户创建脚本
2. 修改注册逻辑，自动创建体验租户
3. 更新权限中间件，添加作用域检查
4. 测试完整流程
5. 更新文档
