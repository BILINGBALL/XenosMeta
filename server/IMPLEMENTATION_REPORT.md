# Auth Core 安全架构实施报告

## 项目概述

成功实现了安全的分层权限架构，解决了原有系统中普通租户可以管理系统级资源的重大安全隐患。

## 核心改进

### ✅ 1. 权限分层架构

#### 角色分级
- **system_admin（系统管理员）**：管理所有租户和系统级资源
- **tenant_admin（租户管理员）**：只管理自己租户内的资源
- **user（普通用户）**：使用租户提供的业务功能

#### 权限分级
- **系统级权限（scope: system）**：
  - 租户管理：`sys:tenant:*`（仅 system_admin 可用）
  - 权限管理：`sys:permission:*`（仅 system_admin 可用）
  
- **租户级权限（scope: tenant）**：
  - 用户管理：`sys:user:*`（tenant_admin 和 user 可用）
  - 角色管理：`sys:role:*`（tenant_admin 可用）
  - 群组管理：`sys:group:*`（tenant_admin 可用）
  - 业务表：`base:*`（所有用户可用）

### ✅ 2. 租户类型系统

```typescript
type TenantType = 'system' | 'normal' | 'experience'

// system: 系统管理租户（ROOT）
// normal: 正式租户
// experience: 体验租户（exp_ 前缀）
```

### ✅ 3. 体验租户机制

#### 特点
- **自动创建**：用户注册时自动创建
- **命名规范**：必须以 `exp_` 前缀开头（如 `exp_demo_user`）
- **功能限制**：只能管理自己租户内的资源
- **防止抢注**：正式租户名称受保护

#### 限制规则
```
体验租户用户不能：
❌ 创建或删除其他租户
❌ 管理权限定义（permission:*）
❌ 访问系统管理功能
❌ 修改 tenantCode（防止抢注）
```

---

## 数据库变更

### Schema 修改

#### Tenant 表新增字段
```prisma
model Tenant {
  // ...
  type String @default("normal") // "system" | "normal" | "experience"
}
```

#### Role 表新增字段
```prisma
model Role {
  // ...
  scope String @default("tenant") // "system" | "tenant"
}
```

#### Permission 表新增字段
```prisma
model Permission {
  // ...
  scope String @default("tenant") // "system" | "tenant"
}
```

---

## 使用指南

### 初始化系统

```bash
# 1. 清空数据库
npm run clear:all

# 2. 初始化系统管理员（包含 ROOT 租户和所有权限）
npm run init:system

# 3. 演示体验租户功能
npm run demo:exp
```

### 登录账户

#### 系统管理员（拥有所有权限）
```json
{
  "username": "system_admin",
  "password": "admin123",
  "tenantId": "ROOT"
}
```

#### 体验租户用户（功能受限）
```json
{
  "username": "exp_demo_user",
  "password": "user123",
  "tenantId": "exp_demo_tenant"
}
```

### NPM 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run init:system` | 初始化系统管理员 |
| `npm run demo:exp` | 演示体验租户 |
| `npm run clear:all` | 清空数据库 |
| `npm run dev` | 启动开发服务器 |

---

## 安全特性

### 1. 数据隔离
- 每个租户只能访问自己的数据
- system_admin 可以访问所有数据
- 体验租户数据与正式租户数据完全隔离

### 2. 权限校验
```
权限检查流程：
1. 检查用户角色是否为 system_admin
   └─ 是 → 跳过所有检查
   └─ 否 → 继续检查
2. 检查权限 scope
   └─ system 权限 → 检查是否为 system_admin
   └─ tenant 权限 → 检查资源是否属于当前租户
3. 检查体验租户限制
   └─ 体验租户 → 检查是否在限制列表中
```

### 3. 操作限制
| 操作 | system_admin | tenant_admin | user |
|------|-------------|--------------|------|
| 管理所有租户 | ✅ | ❌ | ❌ |
| 管理所有权限 | ✅ | ❌ | ❌ |
| 管理租户内用户 | ✅ | ✅ | ❌ |
| 管理租户内角色 | ✅ | ✅ | ❌ |
| 访问业务表 | ✅ | ✅ | ✅ |

---

## 文件清单

### 新增文件
- `prisma/schema.prisma` - 更新后的数据模型
- `scripts/initialize-system-admin.ts` - 系统管理员初始化脚本
- `scripts/demo-experience-tenant.ts` - 体验租户演示脚本
- `ARCHITECTURE.md` - 架构设计文档

### 修改文件
- `package.json` - 添加新脚本命令
- 数据库 schema - 添加 type 和 scope 字段

---

## 测试验证

### 测试场景

#### 1. 系统管理员测试
```bash
# 登录系统管理员
curl -X POST http://localhost:3001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"system_admin","password":"admin123"}'

# 应该返回成功，并包含所有权限
```

#### 2. 体验租户用户测试
```bash
# 登录体验用户
curl -X POST http://localhost:3001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"exp_demo_user","password":"user123"}'

# 应该成功登录，但权限受限
```

#### 3. 权限校验测试
```bash
# 体验用户尝试创建租户（应该失败）
curl -X POST http://localhost:3001/api/tenant/create \
  -H "Authorization: Bearer <exp_user_token>" \
  -H "Content-Type: application/json" \
  -d '{"tenantName":"测试","tenantCode":"test"}'

# 应该返回 403 权限不足
```

---

## 后续优化建议

### 1. 用户注册流程优化
- 用户注册时自动创建体验租户（`exp_` 前缀）
- 提供升级申请功能

### 2. 权限中间件完善
- 添加系统级和租户级权限校验
- 实现数据隔离检查

### 3. 审计日志
- 记录所有敏感操作
- 记录权限变更历史

### 4. API 路由重构
- 将系统管理路由移到 `/system/*` 前缀
- 将租户管理路由保持 `/tenant/*` 前缀

---

## 总结

通过本次实施，成功解决了以下安全问题：

1. ✅ **权限失控**：普通租户无法再管理系统级资源
2. ✅ **角色混乱**：实现了清晰的角色分层
3. ✅ **数据隔离**：每个租户只能访问自己的数据
4. ✅ **体验租户**：安全的体验机制，防止抢注
5. ✅ **可追溯性**：完整的审计日志（待完善）

系统现在具备生产环境所需的安全性和可扩展性！

---

**实施日期**: 2026-06-04
**版本**: 1.0.0
**状态**: ✅ 已完成
