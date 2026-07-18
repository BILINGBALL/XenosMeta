# Auth Core — Code Wiki

> 多租户 RBAC（基于角色的访问控制）平台，提供完整的认证、授权、租户隔离、组织架构、动态多维表格与跨群组数据镜像能力。
>
> 仓库采用 Monorepo 结构，包含 Node.js/Express 后端（`server/`）与 Next.js 前端（`web/`）。

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术栈](#2-技术栈)
- [3. 整体架构](#3-整体架构)
- [4. 数据模型（Prisma Schema）](#4-数据模型prisma-schema)
- [5. 后端架构详解](#5-后端架构详解)
  - [5.1 入口与全局中间件](#51-入口与全局中间件)
  - [5.2 中间件层](#52-中间件层)
  - [5.3 路由层](#53-路由层)
  - [5.4 业务模块](#54-业务模块)
  - [5.5 服务层关键函数](#55-服务层关键函数)
  - [5.6 工具层](#56-工具层)
  - [5.7 配置与公共设施](#57-配置与公共设施)
  - [5.8 校验器](#58-校验器)
  - [5.9 脚本](#59-脚本)
- [6. 前端架构详解](#6-前端架构详解)
  - [6.1 应用结构与路由](#61-应用结构与路由)
  - [6.2 API 客户端](#62-api-客户端)
  - [6.3 类型定义](#63-类型定义)
  - [6.4 状态管理（Zustand Stores）](#64-状态管理zustand-stores)
  - [6.5 组件层](#65-组件层)
  - [6.6 配置](#66-配置)
- [7. 关键业务流程](#7-关键业务流程)
- [8. 依赖关系](#8-依赖关系)
- [9. 项目运行方式](#9-项目运行方式)
- [10. API 接口总览](#10-api-接口总览)

---

## 1. 项目概述

**Auth Core** 是一套多租户 RBAC 权限中台，核心能力包括：

| 能力域 | 说明 |
|--------|------|
| 认证 | 用户名/密码登录，JWT 双 Token（Access 15m + Refresh 7d），Refresh Token 存 Redis 支持吊销 |
| 授权 | 权限码 RBAC，`hasPermission(code)` 纯内存校验，超级管理员旁路 |
| 租户隔离 | 系统/普通/体验三类租户，所有业务数据按 `tenantId` 隔离 |
| 角色分层 | `system_admin`（系统级）/ `tenant_admin`（租户级）/ `user`（普通用户），角色与权限均带 `scope` 标记 |
| 组织架构 | 树形 Group（物化路径 `path`），用户-群组多对多，支持子树权限隔离 |
| 动态多维表格 | 飞书/Airtable 风格的 Table → Field → Record，Record 数据存 JSONB |
| 表镜像 | 跨群组数据共享视图，仅暴露 `visibleFields`，不复制数据 |
| 软删除 | `deletedAt` 时间戳，`notDeleted` / `onlyDeleted` 统一过滤，定时清理回收站 |
| 缓存 | Redis `@Cacheable` / `@CacheEvict` 装饰器，集中式 CacheKeys |
| 审计日志 | `@Audited(resource)` 装饰器，异步非阻塞记录操作流水 |
| AI 蓝图生成 | 关键词模板匹配引擎，为未来 LLM 集成预留 |

### 角色与权限分层

```
system_admin  — 不属于任何租户（系统级），拥有全部权限，可管理所有租户/权限/角色/用户/群组/业务表
tenant_admin  — 属于特定租户，可管理本租户内的用户/角色/群组/业务表，不能管理其他租户与系统级权限
user          — 属于特定租户，只读或自定义权限
```

权限码采用 `模块:资源:动作` 格式，例如 `sys:user:view`、`base:record:add`。系统级权限 `scope='system'`，租户级权限 `scope='tenant'`。

---

## 2. 技术栈

### 后端（`server/`）

| 分类 | 技术 |
|------|------|
| 运行时 | Node.js + TypeScript 5 |
| Web 框架 | Express 4 |
| ORM | Prisma 5（PostgreSQL provider） |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7（ioredis 客户端） |
| 认证 | jsonwebtoken（JWT）+ bcryptjs（密码哈希） |
| 校验 | Zod |
| 日志 | Pino + pino-pretty |
| 限流 | express-rate-limit |
| 测试 | Jest + ts-jest |
| 开发工具 | ts-node-dev、tsc-alias、tsconfig-paths |

### 前端（`web/`）

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router、Turbopack） |
| UI 库 | React 19 |
| 语言 | TypeScript 5 |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 4 + tw-animate-css |
| 组件库 | shadcn/ui（style: `base-nova`，baseColor: `neutral`）+ Radix UI 原语 |
| 图标 | lucide-react |
| HTTP | axios |
| 通知 | sonner |
| 主题 | next-themes |
| 工具 | class-variance-authority、clsx、tailwind-merge |

### 基础设施

- **Docker Compose**：编排 PostgreSQL、Redis、App 三个服务
- **Monorepo**：根 `package.json` 通过 `concurrently` 并行启动前后端

---

## 3. 整体架构

### 目录结构

```
auth-core-2/
├── package.json              # Monorepo 根配置（dev/build/test 聚合脚本）
├── docker-compose.yml        # PostgreSQL + Redis + App 编排
├── pgvector.zip
├── server/                   # 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env / .env.example
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma     # 数据模型定义（11 个 model）
│   ├── src/
│   │   ├── app.ts            # Express 应用入口
│   │   ├── routes/           # 路由定义（10 个路由文件）
│   │   ├── modules/          # 业务模块
│   │   │   ├── auth-core/    # 认证与 RBAC 核心
│   │   │   │   ├── controller/
│   │   │   │   └── service/
│   │   │   ├── base/         # 动态多维表格 + 镜像
│   │   │   │   ├── controller/
│   │   │   │   └── service/
│   │   │   └── developer/    # AI 蓝图生成
│   │   │       ├── controller/
│   │   │       └── service/
│   │   ├── middleware/       # 中间件（auth/permission/error/validate/rate-limit/groupAuth）
│   │   ├── config/           # 配置（db/jwt/soft-delete）
│   │   ├── common/           # 公共设施（logger/redis/audit/cleanup）
│   │   ├── cache/            # 缓存装饰器与 Key 定义
│   │   ├── utils/            # 工具函数（async-handler/id-generator/pagination/...）
│   │   ├── validators/       # Zod 校验 schema
│   │   └── types/            # 类型声明扩展（express.d.ts）
│   ├── scripts/              # 运维脚本（初始化/清理/生成数据/测试）
│   └── tests/                # 测试（unit + 集成）
├── web/                      # 前端
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── components.json       # shadcn/ui 配置
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # 根布局
│   │   ├── globals.css       # 全局样式 + 主题 token
│   │   ├── (public)/         # 公开落地页（登录/注册）
│   │   ├── app/              # DataMaximizer 业务应用（auth-gated）
│   │   └── dashboard/        # RBAC 管理控制台（8 个面板）
│   ├── lib/                  # api-client + utils
│   ├── stores/               # Zustand 状态管理（7 个 store）
│   ├── types/                # TypeScript 类型定义
│   └── components/           # 组件
│       ├── ui/               # shadcn/ui 原语
│       ├── shared/           # 通用组件（ActionButton/FormField/...）
│       ├── auth/             # 认证面板
│       ├── tenant/           # 租户面板
│       ├── user/             # 用户面板
│       ├── group/            # 群组面板
│       ├── role/             # 角色面板
│       ├── permission/       # 权限面板
│       ├── base/             # 动态表面板
│       └── system/           # 系统面板
└── .idea/                    # WebStorm 配置
```

### 架构分层图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Next.js :3000)                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ 公开落地页 │  │ 业务应用/app │  │  RBAC 控制台/dashboard  │  │
│  └─────┬────┘  └──────┬───────┘  └───────────┬────────────┘  │
│        │              │                       │               │
│        └──────────────┴───────────────────────┘               │
│                       │ axios (Bearer Token + 401 自动刷新)    │
└───────────────────────┼─────────────────────────────────────┬─┘
                        │                                     │
┌───────────────────────▼─────────────────────────────────────▼─┐
│                    后端 (Express :3001/api)                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  中间件: CORS → JSON → authMiddleware → hasPermission     │  │
│  │           → validate(Zod) → rateLimit → controller        │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ auth-core 模块 │ │  base 模块   │ │   developer 模块       │ │
│  │ user/role/    │ │ 动态表/字段/  │ │   AI 蓝图生成          │ │
│  │ perm/tenant/  │ │ 记录 + 镜像   │ │                       │ │
│  │ group/system  │ │              │ │                       │ │
│  └──────┬────────┘ └──────┬───────┘ └───────────┬───────────┘ │
│         │                 │                     │             │
│  ┌──────▼─────────────────▼─────────────────────▼───────────┐ │
│  │  工具层: pagination / id-generator / permission.util /     │ │
│  │         group.util / dynamic.util / response / asyncHandler│ │
│  │  缓存层: @Cacheable / @CacheEvict / CacheKeys             │ │
│  │  公共层: logger / redis / audit / cleanup                 │ │
│  └──────────────────────────┬───────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │PostgreSQL│   │  Redis   │   │  (AuditLog   │
        │  :5432   │   │  :6379   │   │   在 PG 内)  │
        └──────────┘   └──────────┘   └──────────────┘
```

---

## 4. 数据模型（Prisma Schema）

数据模型定义于 [server/prisma/schema.prisma](file:///e:/PROJECTS/WebStorm/auth-core-2/server/prisma/schema.prisma)，共 11 个 model，分为三大域：

### 4.1 RBAC 域

| Model | 说明 | 关键字段 |
|-------|------|---------|
| `Tenant` | 租户 | `tenantCode`(unique)、`scope`(`system`/`tenant`/`experience`)、`adminId`、`deletedAt` |
| `User` | 用户 | `username`(unique)、`password`(bcrypt)、`tenantId`、`profile`(JSON)、`deletedAt` |
| `Role` | 角色 | `roleCode`(unique)、`scope`(`system`/`shared`/`tenant`)、`tenantId`、`deletedAt` |
| `Permission` | 权限菜单 | `permCode`(unique)、`parentId`、`type`(1=菜单 2=按钮)、`scope`(`system`/`tenant`) |
| `Group` | 群组（树形） | `groupCode`(unique)、`tenantId`、`parentId`、`path`(物化路径)、`deletedAt` |
| `UserRole` | 用户-角色关联 | `userId`+`roleId`（联合唯一） |
| `RolePermission` | 角色-权限关联 | `roleId`+`permissionId`（联合唯一） |
| `UserGroup` | 用户-群组关联 | `userId`+`groupId`（联合唯一） |

### 4.2 动态表格域

| Model | 说明 | 关键字段 |
|-------|------|---------|
| `DynamicTable` | 动态表 | `tableId`(`tbl_xxx`，unique)、`tenantId`、`groupId`、`deletedAt`；联合唯一 `[groupId, name]` |
| `DynamicField` | 动态字段（列） | `fieldId`(`fld_xxx`，unique)、`type`(text/number/date/select/checkbox/user/attachment)、`options`(JSON)、`deletedAt`；联合唯一 `[tableId, name]` |
| `DynamicRecord` | 动态记录（行） | `recordId`(`rec_xxx`，unique)、`data`(JSONB，存储所有字段值)、`deletedAt` |
| `TableMirror` | 表镜像（视图投影） | `mirrorId`(`mir_xxx`)、`sourceTableId`、`groupId`、`visibleFields`(JSONB)；联合唯一 `[sourceTableId, groupId]` 与 `[groupId, name]`；**无软删除** |

### 4.3 审计域

| Model | 说明 | 关键字段 |
|-------|------|---------|
| `AuditLog` | 审计日志 | `userId`、`action`(CREATE/UPDATE/DELETE/RESTORE/AUTH)、`resource`、`resourceId`、`oldValue`/`newValue`(JSONB)；索引 `[tenantId, resource]`、`[resource, resourceId]`、`[createdAt]` |

### 关系总览

```
Tenant ──< User >── UserGroup ──< Group（自引用树形）
       ──< Role >── RolePermission ──< Permission
       ──< DynamicTable >── DynamicField
                          >── DynamicRecord
                          >── TableMirror（投影到目标 Group）
       ──< AuditLog
```

---

## 5. 后端架构详解

### 5.1 入口与全局中间件

**文件**：[server/src/app.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/app.ts)

```typescript
dotenv.config()
const app = express()
// 1. CORS（白名单：localhost:3000, 192.168.1.23:3000, CORS_ORIGIN）
app.use(cors({ origin, credentials, methods, allowedHeaders }))
// 2. JSON body 解析
app.use(express.json())
// 3. 全局路由前缀 /api
app.use('/api', router)
// 4. 全局错误处理（必须在路由之后）
app.use(errorHandler)
// 5. 监听端口（默认 3000，docker 配置 3001）
app.listen(PORT, ...)
```

定时清理软删除数据的 `scheduleCleanup()` 已定义但在 `app.listen` 中被注释，目前仅通过手动 API 触发。

### 5.2 中间件层

**目录**：`server/src/middleware/`

| 文件 | 导出 | 职责 |
|------|------|------|
| [auth.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/auth.ts) | `authMiddleware` | 验证 `Authorization: Bearer <token>`，解码 JWT，通过 `getUserPermissions(userId)` 加载用户权限（Redis 缓存 10min），挂载到 `req.user`、`req.userId`、`req.tenantId`、`req.username`、`req.userPermissions`、`req.user.isSuperAdmin` |
| [permission.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/permission.ts) | `hasPermission(permCode)` | 路由级权限守卫工厂函数。超级管理员旁路；否则纯内存检查 `req.userPermissions.includes(permCode)`，不命中返回 403 |
| [groupAuth.middleware.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/groupAuth.middleware.ts) | `loadUserGroups` | 按需加载用户群组数据。查询 `UserGroup` 设置 `req.user.groupIds`，调用 `groupService.getUserGroupTrees` 设置 `req.userGroupTrees` |
| [error.middleware.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/error.middleware.ts) | `AppError`、`errorHandler` | `AppError` 业务异常类（含 statusCode/code/message）；全局错误中间件处理 `AppError`、Prisma `P2002`(唯一约束→409)/`P2025`(未找到→404)、其他 Error→500 |
| [validate.middleware.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/validate.middleware.ts) | `validate(schema)` | Zod body 校验，失败返回 400；成功用解析后的数据**替换 `req.body`** |
| [rate-limit.middleware.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/rate-limit.middleware.ts) | `loginLimiter`、`globalLimiter` | `loginLimiter`：15 分钟内最多 10 次登录尝试；`globalLimiter`：100 req/min（已定义但未全局应用） |

**中间件执行顺序**：`cors` → `express.json()` → `authMiddleware` → `hasPermission(code)` → `validate(schema)` → `loginLimiter`(仅登录) → controller → `errorHandler`

### 5.3 路由层

**目录**：`server/src/routes/`

[路由根 index.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/index.ts) 将所有子路由挂载到 `/api` 下：

| 挂载路径 | 路由文件 | 说明 |
|---------|---------|------|
| `/api/tenant` | [tenant.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/tenant.routes.ts) | 租户 CRUD（逐路由鉴权） |
| `/api/user` | [user.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/user.routes.ts) | 认证（register/login/refresh/logout）+ 用户管理（逐路由鉴权） |
| `/api/system` | [system.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/system.routes.ts) | 系统管理（初始化超管/权限/预设角色/清理） |
| `/api/group` | [group.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/group.routes.ts) | 群组树形管理 |
| `/api/base` | [base.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/base.routes.ts) | 动态表/字段/记录 CRUD（`router.use(authMiddleware)`） |
| `/api/base` | [mirror.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/mirror.routes.ts) | 表镜像管理（同前缀，`router.use(authMiddleware)`） |
| `/api/role` | [role.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/role.routes.ts) | 角色 CRUD + 分配权限（`router.use(authMiddleware)`） |
| `/api/permission` | [permission.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/permission.routes.ts) | 权限 CRUD（`router.use(authMiddleware)`） |
| `/api/developer` | [developer.routes.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/routes/developer.routes.ts) | AI 蓝图生成（`authMiddleware`） |

> 完整 API 端点清单见 [第 10 节](#10-api-接口总览)。

### 5.4 业务模块

#### 5.4.1 auth-core 模块（认证与 RBAC 核心）

**目录**：`server/src/modules/auth-core/`

**控制器**（`controller/`）— 每个变更方法均带 `@Audited(resource)` 装饰器：

| 控制器 | 文件 | 关键端点逻辑 |
|--------|------|-------------|
| `userController` | [user.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/user.controller.ts) | register / login / refresh / logout / myPermissions / list / detail / update / delete(软) / restore / assignGroup |
| `roleController` | [role.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/role.controller.ts) | 角色 CRUD + `assignPermissions`；含 `getTenantFilter`/`getTenantForWrite` 辅助函数处理超管与租户过滤；`scope='shared'` 仅系统租户可建，`scope='system'` 仅超管可建 |
| `permissionController` | [permission.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/permission.controller.ts) | 权限 CRUD（全局，无租户隔离，无分页） |
| `tenantController` | [tenant.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/tenant.controller.ts) | 租户 CRUD；`scope='system'` 仅超管可建；创建时自动设置 `adminId=req.userId` 触发 `ensureTenantAdmin` |
| `groupController` | [group.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/group.controller.ts) | 群组树管理：createRoot / getRoot / create / list / tree / subTree / detail / update / delete(软) / restore |
| `systemController` | [system.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/controller/system.controller.ts) | `initSuperAdmin`（无需鉴权的引导端点）/ `seedPermissions` / `seedPresetRoles` / `cleanup`；内含 `ALL_PERMISSIONS` 常量（38 条：7 system + 31 tenant） |

**服务**（`service/`）：

| 服务 | 文件 | 关键方法 |
|------|------|---------|
| `userService` | [user.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/user.service.ts) | `registerUser`（bcrypt 哈希）、`loginUser`（发 Token + Redis 存 refresh）、`refreshAccessToken`（校验 Redis 一致性）、`logoutUser`（删 Redis key + 清权限缓存）、`getUserListByTenant`（分页）、`getUserById`、`updateUser`、`deleteUser`(软)、`restoreUser`、`assignGroupToUser` |
| `roleService` | [role.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/role.service.ts) | `getRoles`（超管看全部，租户看自己 + shared）、`getRole`、`createRole`、`updateRole`、`deleteRole`(软)、`restoreRole`、`assignPermissionsToRole`（**scope 兼容校验**：system 角色可分配任意权限；shared/tenant 角色只能分配 tenant scope 权限） |
| `permissionService` | [permission.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/permission.service.ts) | `getPermissions`（全量，按 sort 排序）、`getPermission`、CRUD（硬删除，无 `deletedAt`） |
| `tenantService` | [tenant.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/tenant.service.ts) | `ensureTenantAdmin`（私有：自动为租户管理员创建 `tenant_admin` 角色并分配 34 条租户级权限）、`getTenants`、`getTenant`、`createTenant`（创建后自动建根 Group + 若有 adminId 则 ensureTenantAdmin）、`updateTenant`、`deleteTenant`(软)、`restoreTenant` |
| `groupService` | [group.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/group.service.ts) | `createRootGroup`（幂等：`ROOT_<tenantCode>`）、`createGroup`（计算物化 `path = parent.path + '/' + id`）、`getDescendantGroupIds`（path startsWith 快速子树查询）、`getRootGroupTree`、`getUserGroupIdList`、`getAllGroupIds`、`getGroupTree`、`getUserGroupTrees`、`getGroupById`、`updateGroup`、`deleteGroup`(软)、`restoreGroup` |
| `systemService` | [system.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/auth-core/service/system.service.ts) | 空文件，系统逻辑均在 `system.controller.ts` |

#### 5.4.2 base 模块（动态多维表格 + 镜像）

**目录**：`server/src/modules/base/`

**动态表格**（[dynamic.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/base/service/dynamic.service.ts) + [dynamic.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/base/controller/dynamic.controller.ts)）：

三层嵌套资源 **Table → Field → Record**，Record 数据存于 JSONB `data` 列（key 为 `fieldId`）。

- **Tables**：`getTables`（按 tenantId + groupId 过滤分页）、`getTable`（含字段）、`createTable`（生成 `tbl_xxx`）、`updateTable`（重名校验）、`deleteTable`/`restoreTable`（软删除）
- **Fields**：`getFields`/`getField`/`createField`/`updateField`/`deleteField`/`restoreField`；变更操作 `@CacheEvict dynamicTableFields`
- **Records**：`getRecords`（使用 `buildDynamicWhere` 将前端筛选翻译为 JSONB 谓词）、`createRecord`（**强制群组归属校验**：非超管必须拥有目标 groupId；将字段名翻译为 fieldId）、`updateRecord`/`deleteRecord`(软)/`restoreRecord`

控制器辅助函数：`requireTenantId(req)`、`resolveGroupIds(req, tenantId)`（超管返回全部群组 id，普通用户返回自己的群组 id）

**表镜像**（[mirror.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/base/service/mirror.service.ts) + [mirror.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/base/controller/mirror.controller.ts)）：

`TableMirror` 是源表的只读视图，仅暴露 `visibleFields` 给目标 `groupId`，实现跨群组数据共享而不复制数据。

- `createMirror`（校验源表存在 + visibleFields 均属于源表）
- `getMirrorsByTable` / `getMirrorsByGroups`（空群组列表→空结果）
- `getRecords`（查询源表 Record，逐行用 `filterDataFields` 过滤 JSON 仅保留 visibleFields，再转换 fieldId→name）
- `deleteMirror`（**硬删除**，无软删除）

#### 5.4.3 developer 模块（AI 蓝图生成）

**目录**：`server/src/modules/developer/`

[ai-generate.service.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/developer/service/ai-generate.service.ts) + [ai-generate.controller.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/modules/developer/controller/ai-generate.controller.ts)

当前为**关键词模板匹配引擎**（非真实 LLM 调用，为未来 Claude/GPT 集成预留）：

- 7 个硬编码 `BlueprintTemplate`：OCR、表单审批、数据查询、数据可视化、文件上传、通知、费用报销
- 评分逻辑：对每个模板累加命中关键词的长度（长关键词权重高），选最高分；0 分返回 null（404）
- 生成蓝图 JSON：`nd_ai_xxx`（节点）/`e_ai_xxx`（边）/`bp_ai_xxx`（蓝图）ID，含 `metadata.generatedBy='ai_template'`

### 5.5 服务层关键函数

#### 认证流程核心函数

| 函数 | 位置 | 说明 |
|------|------|------|
| `loginUser({username, password})` | `userService` | bcrypt 校验 → 生成 access(15m)+refresh(7d) → refresh 存 Redis(`refresh_token:<userId>`) → 返回 token + 用户信息 |
| `refreshAccessToken(refreshToken)` | `userService` | 验证签名 + 校验 Redis 中 token 一致性 → 发新 access token |
| `logoutUser(userId)` | `userService` | 删 Redis refresh key + `clearUserPermissionsCache` |
| `getUserPermissions(userId)` | [permission.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/permission.util.ts) | 返回 `{permissions, isSuperAdmin}`，**Redis 缓存** `user:permissions:<userId>`（TTL 600s）；单次深连接查询 user→roles→role→permissions→permCode |
| `checkIsSuperAdmin(userId)` | `permission.util.ts` | 检查用户是否有 `roleCode === 'system_admin'` 的角色 |
| `clearUserPermissionsCache(userId)` | `permission.util.ts` | 删除权限缓存，在 logout 和租户管理员任命时调用 |

#### 权限与群组工具

| 函数 | 位置 | 说明 |
|------|------|------|
| `hasPermission(permCode)` | [permission.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/middleware/permission.ts) | 路由级权限中间件工厂，内存校验 |
| `buildGroupTree(list)` | [group.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/group.util.ts) | O(n) 扁平数组→树（Map 辅助），`parentId===null` 为根 |
| `getSubGroupTree(rootTree, groupId)` | `group.util.ts` | 递归提取子树（深拷贝避免 mutation） |
| `hasGroupPermission(userGroupTree, targetGroupId)` | `group.util.ts` | 判断目标 groupId 是否在用户权限子树内 |
| `extractAllGroupIds(userGroupTree)` | `group.util.ts` | 将子树展平为去重 groupId 数组 |
| `checkGroupIds(modelName, ids, user)` | `group.util.ts` | 批量校验 ids 是否属于用户群组（超管旁路） |

#### 动态表格工具

| 函数 | 位置 | 说明 |
|------|------|------|
| `getFieldNameMap(tableId, tenantId)` | [dynamic.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/dynamic.util.ts) | 返回 `{fieldName: fieldId}`，用于前端字段名→内部 id 翻译 |
| `convertIdToName(nameMap, records)` | `dynamic.util.ts` | 反向映射 `fieldId→name`，响应中使用可读列名 |
| `buildDynamicWhere(tableId, tenantId, frontFilter)` | `dynamic.util.ts` | 将前端筛选 `{conditions:{字段名:值}, conjunction:'AND'\|'OR'\|'NOT'}` 翻译为 Prisma JSONB 谓词；NOT 仅支持单条件 |

#### 通用工具

| 函数 | 位置 | 说明 |
|------|------|------|
| `asyncHandler(fn)` | [async-handler.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/async-handler.ts) | 包装 async controller，reject 自动走 `next`→全局 errorHandler |
| `paginate(model, {where,include,orderBy,select}, page, pageSize)` | [pagination.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/pagination.ts) | `findMany`+`count` 并行执行，返回 `{items, total, page, pageSize, totalPages}` |
| `generateTableId()` / `generateFieldId()` / `generateRecordId()` / `generateMirrorId()` | [id-generator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/id-generator.ts) | `crypto.randomBytes` + 62 字符表，飞书风格前缀 `tbl_`/`fld_`/`rec_`/`mir_`，默认 12 位随机字符 |
| `success/fail/created/noContent/unauthorized/forbidden/notFound` | [response.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/response.ts) | 统一响应封装 `{code, message, data, success}` |

### 5.6 工具层

**目录**：`server/src/utils/`

| 文件 | 导出 | 说明 |
|------|------|------|
| [async-handler.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/async-handler.ts) | `asyncHandler` | async controller 错误捕获包装器 |
| [id-generator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/id-generator.ts) | `generateTableId` 等 | 加密随机 ID 生成器（飞书风格前缀） |
| [pagination.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/pagination.ts) | `paginate` | 通用分页（findMany+count 并行） |
| [permission.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/permission.util.ts) | `getUserPermissions`、`fetchUserPermissionsFromDB`、`checkIsSuperAdmin`、`clearUserPermissionsCache` | RBAC 权限加载与缓存核心 |
| [group.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/group.util.ts) | `buildGroupTree`、`getSubGroupTree`、`hasGroupPermission`、`extractAllGroupIds`、`checkGroupIds` | 群组树操作 |
| [dynamic.util.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/dynamic.util.ts) | `getFieldNameMap`、`convertIdToName`、`buildDynamicWhere` | 动态表字段映射与 JSONB 查询构建 |
| [response.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/response.ts) | `success`/`fail`/`created`/`noContent`/`unauthorized`/`forbidden`/`notFound` | 统一 API 响应 |
| [utils.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/utils/utils.ts) | `buildGroupTree`（旧版重复） | 遗留代码，未使用 |
| [types/express.d.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/types/express.d.ts) | 类型声明扩展 | 扩展 `Express.Request` 添加 `user`、`tenantId`、`groupIds` |

### 5.7 配置与公共设施

**目录**：`server/src/config/`、`server/src/common/`、`server/src/cache/`

#### 配置层（`config/`）

| 文件 | 说明 |
|------|------|
| [db.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/config/db.ts) | PrismaClient 单例，dev 记录 `['warn','error']`，其他仅 `['error']` |
| [jwt.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/config/jwt.ts) | JWT 配置：`generateAccessToken`/`generateRefreshToken`/`verifyAccessToken`/`verifyRefreshToken`/`verifyToken`(别名)/`generateToken`(旧版兼容)。密钥来自 `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`，过期 15m/7d |
| [soft-delete.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/config/soft-delete.ts) | `notDeleted = { deletedAt: null }` 与 `onlyDeleted = { deletedAt: { not: null } }` 常量，spread 到每个 where 中。放弃 Prisma `$extends` 因 TS strict 模式 WhereInput 冲突 |

#### 公共设施（`common/`）

| 文件 | 说明 |
|------|------|
| [logger.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/common/logger.ts) | Pino 日志，dev 用 pino-pretty 彩色，level debug(dev)/info(其他) |
| [redis.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/common/redis.ts) | ioredis 单例，`keyPrefix: 'auth-core:'`，`retryStrategy`，`maxRetriesPerRequest: 3` |
| [audit.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/common/audit.ts) | `AuditService.log`（异步 fire-and-forget 写 AuditLog，sanitize 去除 password）、`detectAction`（从方法名推断动作）、`@Audited(resource)` 装饰器（2xx 后记录，resourceId 取自 `req.params.id/tableId/mirrorId`） |
| [cleanup.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/common/cleanup.ts) | `cleanupExpiredDeleted(retentionDays=90)`，硬删除 `deletedAt < cutoff` 的 7 个软删除模型数据，返回 `{model: count}` |

#### 缓存层（`cache/`）

| 文件 | 说明 |
|------|------|
| [decorators.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/cache/decorators.ts) | `@Cacheable({key, ttl})`（先查 Redis，miss 则执行并 set EX ttl）、`@CacheEvict({keys})`（先执行原方法，再解析 keys 删除）。Stage-3 装饰器语法 |
| [keys.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/cache/keys.ts) | `CacheKeys` 集中式 key 构建器（`tenantList`/`tenant(id)`/`userList(tenantId)`/`user(id)`/`roleList(tenantId)`/`role(id)`/`permissionList`/`permission(id)`/`groupList(tenantId)`/`group(id)`/`rootGroupTree(tenantId)`/`userGroupIds(userId,tenantId)`/`dynamicTableFields(tenantId,tableId)`）+ `CacheTTL`（GROUP_TREE=900, USER_GROUP=1800, TABLE_FIELDS=900, TENANT=1800, USER=600, ROLE=1800, PERMISSION=3600, GROUP=1800 秒） |

### 5.8 校验器

**目录**：`server/src/validators/`（全部 Zod schema）

| 文件 | 导出 | 校验规则 |
|------|------|---------|
| [common.validator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/validators/common.validator.ts) | `paginationSchema` | `page`(int≥1,默认1)、`pageSize`(int 1-100,默认20)，coerce |
| [user.validator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/validators/user.validator.ts) | `registerSchema`/`loginSchema`/`updateUserSchema`/`assignGroupSchema`/`refreshTokenSchema` | 注册：username 3-50, password≥8；更新：全可选 |
| [role.validator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/validators/role.validator.ts) | `createRoleSchema`/`updateRoleSchema`/`assignPermissionsSchema` | scope 枚举 `system`/`shared`/`tenant`；permissionIds 数组 |
| [tenant.validator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/validators/tenant.validator.ts) | `createTenantSchema`/`updateTenantSchema` | scope 枚举 `system`/`tenant`/`experience` |
| [field.validator.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/src/validators/field.validator.ts) | `createFieldSchema`/`updateFieldSchema` | `FIELD_TYPES=['text','number','date','select','checkbox','user','attachment']` |

> 群组、权限、镜像、记录 body 无独立校验器，控制器直接消费 `req.body`。

### 5.9 脚本

**目录**：`server/scripts/`

| 脚本 | npm 命令 | 说明 |
|------|---------|------|
| [initialize-system-admin.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/initialize-system-admin.ts) | `npm run init:system` | **主引导脚本**：创建 ROOT 系统租户 + 33 权限 + `system_admin` 角色 + `system_admin` 用户（密码 `admin123`）。登录：`system_admin`/`admin123` |
| [initialize-admin.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/initialize-admin.ts) | `npm run init:admin` | 旧版备用引导：创建 32 权限 + `system` 租户 + `admin` 角色 + `default` 租户 + `admin` 用户（`admin123`） |
| [demo-experience-tenant.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/demo-experience-tenant.ts) | `npm run demo:exp` | 演示体验租户：创建 `exp_demo_tenant`(`experience`) + 用户 + 正式租户 |
| [generate-test-data.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/generate-test-data.ts) | `npm run generate:data` | 生成测试公司 + 3 用户 + 3 动态表（各 7 字段） |
| [generate-complete-test-data.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/generate-complete-test-data.ts) | `npm run generate:complete` | 生成更大测试集：创新科技公司 + 4 部门 + 4 用户 + 4 动态表 |
| [system-test.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/system-test.ts) | `npm run test:system` | 端到端集成测试（4 阶段），输出 `TEST_REPORT.json` |
| [clear-database.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/clear-database.ts) | `npm run clear:db` | 仅删除动态业务数据（Record/Field/Table），保留 RBAC 配置 |
| [clear-all-database.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/clear-all-database.ts) | `npm run clear:all` | 清空全部数据（11 表，按依赖顺序） |
| [check-id-format.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/server/scripts/check-id-format.ts) | — | 诊断：抽样检查 ID 格式 `^tbl/fld/rec[a-zA-Z0-9]+$` |

---

## 6. 前端架构详解

### 6.1 应用结构与路由

**目录**：`web/app/`（Next.js App Router）

前端有三个独立界面，共享同一个 auth store：

#### 根布局 [app/layout.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/layout.tsx)
- `<html lang="zh-CN">`，Geist + Geist_Mono 字体
- 全局 `<Toaster richColors position="top-right" />`（sonner）
- metadata：title "Auth Core"

#### 路由组 1：公开落地页 `/`
- [app/(public)/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/page.tsx)：营销首页，功能列表，登录/注册 Dialog
- 登录调用 `useAuthStore.login()`，成功后 `router.push('/app')`
- 注册调用 `apiClient.post('/user/register')`

#### 路由组 2：DataMaximizer 业务应用 `/app/*`
- [app/app/layout.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/layout.tsx)：**Auth Guard** — 未登录重定向 `/app/login`；224px 侧边栏（品牌 DataMaximizer + Shield 图标 + 导航 + 用户信息 + 登出）
- [app/app/sidebar-nav.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/sidebar-nav.tsx)：10 项导航（仪表板、智能仪表板、智能搜索、客户/产品/订单/项目管理、智能录入、数据优化、优化中心）
- [app/app/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/page.tsx)：欢迎面板（问候 + 业务卡片 + 统计）
- [app/app/login/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/login/page.tsx)：登录页（默认提示 `admin`/`admin123`）
- [app/app/register/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/register/page.tsx)：注册页（注册后自动登录跳转）
- [app/app/projects/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/projects/page.tsx)、[app/app/search/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/app/search/page.tsx)：**Mock 数据演示页**（无真实 API 调用）

#### 路由组 3：RBAC 管理控制台 `/dashboard/*`
- [app/dashboard/layout.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/dashboard/layout.tsx)：头部（Auth Core 标题 + 服务器指示 + 连接状态徽章），**无 auth guard**（面板自检 `if (!isLoggedIn) return null`）
- [app/dashboard/page.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/dashboard/page.tsx)：主控制台，`<Tabs>` 8 个面板：
  - 🔑 认证 → `<AuthPanel />`
  - 🏢 租户 → `<TenantPanel />`
  - 👤 用户 → `<UserPanel />`
  - 🌳 群组 → `<GroupPanel />`
  - 🛡️ 角色 → `<RolePanel />`
  - 🔒 权限 → `<PermissionPanel />`
  - 📊 动态表 → `<TablePanel />`
  - ⚙️ 系统 → `<SystemPanel />`

#### 全局样式 [app/globals.css](file:///e:/PROJECTS/WebStorm/auth-core-2/web/app/globals.css)
- 导入 `tailwindcss`、`tw-animate-css`、`shadcn/tailwind.css`
- `@theme inline` token 映射 + `:root`/`.dark` OKLCH 颜色变量（完整暗色模式）

### 6.2 API 客户端

**文件**：[web/lib/api-client.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/lib/api-client.ts)

- **Base URL**：`http://192.168.1.23:3001/api`（硬编码常量）
- axios 实例：`timeout: 15000`，`Content-Type: application/json`
- **请求拦截器**：从 `useAuthStore.getState().accessToken` 注入 `Authorization: Bearer <token>`
- **响应拦截器**：
  - 成功：直接返回 `response.data`（调用方拿到 parsed body）
  - 401 错误处理（**单例刷新队列**）：
    - `/user/login` 或 `/user/refresh` 端点 401 → 直接拒绝 "认证失败"
    - 无 refresh token → `logout()` + 拒绝 "登录已过期"
    - 有 refresh token → 用原生 `axios.post` 调 `/user/refresh`（绕过拦截器），成功则 `setTokens` + 重试队列中的请求；失败则 `logout()`
    - 并发请求通过 `isRefreshing` 标志 + `pendingQueue` 数组去重
- **通用 CRUD 辅助**：`fetchList<T>`/`fetchOne<T>`/`createItem<T>`/`updateItem<T>`/`deleteItem<T>`/`postAction<T>`

**[web/lib/utils.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/lib/utils.ts)**：仅导出 `cn()` = `twMerge(clsx(inputs))`

### 6.3 类型定义

**文件**：[web/types/index.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/types/index.ts)

| 分类 | 类型 |
|------|------|
| 通用 | `ApiResponse<T>` = `{code, message, data, success}`、`PaginatedData<T>` = `{items, total, page, pageSize}`、`unwrapList<T>(data)` 规范化数组 |
| 认证 | `LoginRequest`、`LoginResponse`、`RegisterRequest` |
| 用户 | `User`、`UpdateUserRequest`、`AssignGroupRequest` |
| 租户 | `Tenant`、`CreateTenantRequest`、`UpdateTenantRequest` |
| 群组 | `Group`（树形）、`GroupMember`、`CreateGroupRequest`、`CreateRootGroupRequest`、`UpdateGroupRequest` |
| 角色 | `Role`、`CreateRoleRequest`、`UpdateRoleRequest`、`AssignPermissionsRequest` |
| 权限 | `Permission`、`CreatePermissionRequest`、`UpdatePermissionRequest` |
| 动态表 | `DynamicTable`、`DynamicField`、`DynamicRecord`、`FieldType`、各 CRUD Request |
| 系统 | `InitSuperAdminRequest` |

### 6.4 状态管理（Zustand Stores）

**目录**：`web/stores/`

所有 store 遵循**统一模式**：state 持有 `list` + `current*` + `loading`/`error`/`message`；async action 设置 `loading:true`，成功设 `message`，失败设 `error`，变更操作返回 `boolean`；`clearMessage()` 重置。列表响应通过 `unwrapList()` 规范化。除 auth-store 外均无持久化。

| Store | 文件 | 状态 | 关键 Action |
|-------|------|------|------------|
| `useAuthStore` | [auth-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/auth-store.ts) | `accessToken`/`refreshToken`/`user`/`isLoggedIn` | **唯一持久化 store**（key `auth-core-auth`，SSR-safe storage）；`login`/`logout`/`setTokens`/`clearError`/`clearMessage` |
| `useTenantStore` | [tenant-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/tenant-store.ts) | `tenants`/`currentTenant` | `fetchTenants`/`fetchTenant`/`createTenant`/`updateTenant`/`deleteTenant`/`restoreTenant` |
| `useUserStore` | [user-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/user-store.ts) | `users`/`currentUser` | `fetchUsers`/`fetchUser`/`updateUser`/`deleteUser`/`restoreUser`/`assignGroup`（无 createUser，创建走 register） |
| `useGroupStore` | [group-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/group-store.ts) | `groups`/`currentGroup`/`groupTree` | `fetchGroups(tenantId)`/`fetchRootGroup`/`fetchGroupTree(tenantId,groupId?)`/`createRootGroup`/`createGroup`/`updateGroup`/`deleteGroup`/`restoreGroup` |
| `useRoleStore` | [role-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/role-store.ts) | `roles`/`currentRole` | `fetchRoles`/`fetchRole`/`createRole`/`updateRole`/`deleteRole`/`restoreRole`/`assignPermissions(roleId,{permissionIds})` |
| `usePermissionStore` | [permission-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/permission-store.ts) | `permissions`/`currentPermission` | `fetchPermissions`/`fetchPermission`/`createPermission`/`updatePermission`/`deletePermission`（无 restore） |
| `useBaseStore` | [base-store.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/stores/base-store.ts) | `tables`/`currentTable`/`fields`/`currentField`/`records`/`currentRecord` | 最复杂 store，三级资源：Table actions + Field actions + Record actions（`fetchRecords` 用 POST `/base/tables/:tableId/records/list`） |

### 6.5 组件层

**目录**：`web/components/`

#### 通用共享组件（`shared/`）

| 组件 | 文件 | 说明 |
|------|------|------|
| `SectionWrapper` | [section-wrapper.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/shared/section-wrapper.tsx) | 面板外框：Card + CardHeader(title + Badge + description) + CardContent |
| `ActionButton` | [action-button.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/shared/action-button.tsx) | 包装 shadcn Button，支持 async onClick + loading（Loader2 旋转）+ variant/size |
| `FormField` | [form-field.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/shared/form-field.tsx) | 受控 label+Input 对，onChange 传 string（非 event），required 显示红色 `*` |
| `ToastListener` | [toast-listener.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/shared/toast-listener.tsx) | **跨切面通知机制**：接收 store，用 vanilla `store.subscribe`（非 hook selector）监听 error/message 变化，避免重渲染循环；变化时 `toast.error/success` 后 `setTimeout` 调 `clearMessage` |

#### 业务面板组件

所有面板 `'use client'`，结构统一：`<SectionWrapper>` + `<ToastListener store>` + `<Tabs>`（列表/创建/查询）+ `<Table>` + `<Dialog>`。除 AuthPanel 和 SystemPanel 外均自检 `if (!isLoggedIn) return null`。

| 面板 | 文件 | Store | 说明 |
|------|------|-------|------|
| `AuthPanel` | [auth-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/auth/auth-panel.tsx) | `useAuthStore` | 登录态：显示 token + 刷新/登出；未登录：登录/注册 Tabs |
| `TenantPanel` | [tenant-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/tenant/tenant-panel.tsx) | `useTenantStore` | 租户列表/创建/查询，scope 徽章 |
| `UserPanel` | [user-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/user/user-panel.tsx) | `useUserStore` | 用户列表/注册/工具（查权限/分配群组） |
| `GroupPanel` | [group-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/group/group-panel.tsx) | `useGroupStore` + `useTenantStore` | 租户选择器 + 群组列表/创建/树/查找/分配用户 |
| `RolePanel` | [role-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/role/role-panel.tsx) | `useRoleStore` + `usePermissionStore` | 角色列表/创建/查找 + 分配权限 Dialog（全选/清空 + checkbox 列表） |
| `PermissionPanel` | [permission-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/permission/permission-panel.tsx) | `usePermissionStore` | 权限列表/创建/查找，type 徽章（1=菜单 2=按钮） |
| `TablePanel` | [table-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/base/table-panel.tsx) | `useBaseStore` | 最大面板，三级 Tabs（表管理/字段/记录）；记录创建自动从字段定义生成 JSON 模板 |
| `SystemPanel` | [system-panel.tsx](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components/system/system-panel.tsx) | 直接调 `apiClient` | 4 个系统操作：初始化超管/同步权限码/初始化预设角色/软删除清理 |

#### UI 原语（`ui/`）

shadcn/ui 组件（style `base-nova`，RSC-capable）：`accordion`、`alert`、`badge`、`button`、`card`、`dialog`、`input`、`label`、`progress`、`select`、`separator`、`sonner`、`table`、`tabs`、`textarea`

### 6.6 配置

| 文件 | 说明 |
|------|------|
| [components.json](file:///e:/PROJECTS/WebStorm/auth-core-2/web/components.json) | shadcn 配置：style `base-nova`、rsc true、baseColor `neutral`、cssVariables true、iconLibrary `lucide`、路径别名 `@/components`、`@/lib/utils` 等 |
| [tsconfig.json](file:///e:/PROJECTS/WebStorm/auth-core-2/web/tsconfig.json) | strict、moduleResolution bundler、jsx react-jsx；路径别名 `@/* → ./*` |
| [next.config.ts](file:///e:/PROJECTS/WebStorm/auth-core-2/web/next.config.ts) | 空 NextConfig，默认行为 |
| [postcss.config.mjs](file:///e:/PROJECTS/WebStorm/auth-core-2/web/postcss.config.mjs) | 仅 `@tailwindcss/postcss`（Tailwind v4） |
| [eslint.config.mjs](file:///e:/PROJECTS/WebStorm/auth-core-2/web/eslint.config.mjs) | Flat config，extends next/core-web-vitals + typescript |

---

## 7. 关键业务流程

### 7.1 认证流程

```
登录:
  POST /api/user/login {username, password}
    → userService.loginUser
    → bcrypt.compare(password, user.password)
    → generateAccessToken({id, username, tenantId})  // 15m
    → generateRefreshToken(...)                        // 7d
    → redis.set(`refresh_token:<userId>`, refreshToken, EX 7d)
    → update user.lastLoginAt
    → return {accessToken, refreshToken, user}

请求鉴权:
  Authorization: Bearer <accessToken>
    → authMiddleware: verifyAccessToken
    → getUserPermissions(userId)  // Redis 缓存 user:permissions:<userId> 10min
    → req.userPermissions = [...], req.user.isSuperAdmin = bool

刷新 Token:
  POST /api/user/refresh {refreshToken}
    → verifyRefreshToken
    → redis.get(`refresh_token:<userId>`) === refreshToken  // 吊销检查
    → generateAccessToken (新)

登出:
  POST /api/user/logout
    → redis.del(`refresh_token:<userId>`)
    → clearUserPermissionsCache(userId)
```

### 7.2 权限校验流程

```
两层校验:
  1. 路由级 — hasPermission(permCode) 中间件
     - if (req.user.isSuperAdmin) next()  // 超管旁路
     - if (!req.userPermissions.includes(permCode)) 403
  
  2. 分配时 — assignPermissionsToRole
     - system 角色可分配任意权限
     - shared/tenant 角色只能分配 scope='tenant' 的权限
     - 否则 400 "权限作用域不兼容"
```

### 7.3 多租户隔离

```
数据隔离:
  - 所有业务模型带 tenantId
  - 列表查询: 普通用户按 req.tenantId 过滤；超管 tenantId=undefined 看全部
  - 写操作: getTenantForWrite/requireTenantId 辅助
  - 所有权复检: 服务层内部校验 resource.tenantId === tenantId（防猜测 ID 跨租户访问）

群组隔离（动态数据）:
  - Tables/Fields/Records 带 groupId
  - 列表查询: groupId IN <用户 groupIds>（超管看全部租户群组）
  - createRecord: 非超管必须拥有目标 groupId
  - 镜像: 跨群组共享，仅暴露 visibleFields
```

### 7.4 软删除机制

```
软删除:
  - 删除: deletedAt = new Date()
  - 恢复: deletedAt = null
  - 查询: spread ...notDeleted ({deletedAt: null})
  - 回收站: ...onlyDeleted ({deletedAt: {not: null}})
  
  软删除模型: Tenant, User, Role, Group, DynamicTable, DynamicField, DynamicRecord
  硬删除模型: Permission, TableMirror, AuditLog

定时清理:
  - cleanupExpiredDeleted(retentionDays=90)
  - 硬删除 deletedAt < cutoff 的数据
  - 调度器已定义但注释（app.listen），当前仅手动 POST /api/system/cleanup
```

### 7.5 缓存策略

```
@Cacheable({key, ttl}):
  - redis.get(key) → hit: JSON.parse 返回
  - miss: 执行原方法 → redis.set(key, JSON, 'EX', ttl) → 返回

@CacheEvict({keys}):
  - 先执行原方法
  - 解析 keys(...args) → redis.del(keysToDelete)
  - 变更操作同时清除 detail key + list key（常需重查实体获取 tenantId 构造 list key）

权限缓存（独立）:
  - user:permissions:<userId>  TTL 600s
  - logout / 角色变更时 clearUserPermissionsCache
```

### 7.6 审计日志

```
@Audited(resource) 装饰器:
  - 包装 controller 方法
  - 原方法执行后，若 res.statusCode 为 2xx:
    - action = detectAction(methodName)  // create→CREATE, update→UPDATE, ...
    - resourceId = req.params.id | tableId | mirrorId
    - AuditService.log({userId, tenantId, action, resource, resourceId, oldValue, newValue})
  - 异步 fire-and-forget，失败仅 log，不阻塞响应
  - sanitize() 去除 password
```

### 7.7 前端 Token 自动刷新

```
请求返回 401:
  - /user/login 或 /user/refresh → 直接拒绝
  - 无 refreshToken → logout() + 拒绝
  - 有 refreshToken:
    - isRefreshing=true → 加入 pendingQueue
    - isRefreshing=false → axios.post(/user/refresh) (绕过拦截器)
      - 成功: setTokens → 处理队列 → 重试原请求
      - 失败: logout() → 拒绝队列
```

---

## 8. 依赖关系

### 8.1 后端依赖图

```
express
  ├── cors                     # 跨域
  ├── express-rate-limit       # 限流
  └── /api 路由
        └── controller
              ├── @Audited → common/audit.ts → prisma.auditLog
              ├── service
              │     ├── @Cacheable/@CacheEvict → cache/decorators.ts → redis
              │     ├── prisma (config/db.ts)
              │     ├── redis (common/redis.ts)
              │     └── utils (pagination/permission.util/group.util/...)
              └── middleware (auth/permission/validate)

@prisma/client + prisma        # ORM → PostgreSQL
ioredis                        # Redis 客户端
jsonwebtoken                   # JWT 签发/验证
bcryptjs                       # 密码哈希
zod                            # 请求校验
pino + pino-pretty             # 日志
dotenv                         # 环境变量
axios                          # HTTP（测试脚本用）
```

### 8.2 前端依赖图

```
next (App Router)
  ├── react / react-dom 19
  ├── tailwindcss 4 + @tailwindcss/postcss
  ├── shadcn/ui (style: base-nova)
  │     ├── @radix-ui/react-* (dialog/select/tabs/label/accordion/progress/toast)
  │     ├── class-variance-authority + clsx + tailwind-merge
  │     └── lucide-react (图标)
  ├── zustand                  # 状态管理（7 stores）
  ├── axios                    # HTTP 客户端（api-client.ts）
  ├── sonner                   # Toast 通知
  └── next-themes              # 主题切换
```

### 8.3 前后端数据流

```
组件 (useEffect) → store.fetchX() → apiClient.get/post/put/delete
  → 请求拦截器注入 Bearer Token
  → Express /api 路由
  → middleware 链 (auth → permission → validate)
  → controller (@Audited) → service (@Cacheable/@CacheEvict)
  → prisma → PostgreSQL / redis
  → 响应 {code, message, data, success}
  → 响应拦截器 unwrap response.data
  → store.setState(list/current + message)
  → ToastListener 监听 store.error/message → sonner toast
```

---

## 9. 项目运行方式

### 9.1 环境准备

**必需服务**：PostgreSQL 16 + Redis 7

**方式 A：Docker Compose（推荐）**

```bash
# 启动 PostgreSQL + Redis（仅基础设施）
docker-compose up -d postgres redis

# 或启动全部（含 App）
docker-compose up -d
```

[docker-compose.yml](file:///e:/PROJECTS/WebStorm/auth-core-2/docker-compose.yml) 配置：
- PostgreSQL：`localhost:5432`，用户 `postgres`，密码 `123456`，数据库 `auth_core`
- Redis：`localhost:6379`
- App：`localhost:3001`（生产模式，自动 `prisma migrate deploy`）

**方式 B：本地安装**

```bash
# 安装 PostgreSQL 16 和 Redis 7
# 或使用 pgvector.zip 中的 PostgreSQL（带 pgvector 扩展）
```

### 9.2 环境变量配置

复制 [server/.env.example](file:///e:/PROJECTS/WebStorm/auth-core-2/server/.env.example) 为 `server/.env` 并修改：

```bash
# 数据库
DATABASE_URL="postgresql://postgres:123456@localhost:5432/auth_core?schema=public"

# JWT 密钥（生产环境用 openssl rand -hex 64 生成）
JWT_ACCESS_SECRET="change-me-access-secret"
JWT_REFRESH_SECRET="change-me-refresh-secret"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_PREFIX=auth-core:

# CORS
CORS_ORIGIN=http://localhost:3000

# 其他
PORT=3001
NODE_ENV=development
```

### 9.3 数据库初始化

```bash
cd server

# 生成 Prisma Client
npm run prisma:gen

# 执行数据库迁移
npm run prisma:migrate

# 初始化系统管理员（创建 system_admin 用户，密码 admin123）
npm run init:system

# 可选：生成测试数据
npm run generate:complete
```

### 9.4 本地开发

```bash
# 在项目根目录

# 安装所有依赖（postinstall 自动安装 server 依赖）
npm install

# 同时启动前后端（concurrent）
npm run dev

# 或分别启动
npm run dev:server    # 后端 http://localhost:3001
npm run dev:web       # 前端 http://localhost:3000（绑定 0.0.0.0）
```

**默认登录凭证**：
- 系统管理员：`system_admin` / `admin123`
- 旧版管理员：`admin` / `admin123`

### 9.5 构建

```bash
# 构建后端（tsc + tsc-alias）
npm run build:server

# 构建前端（next build）
npm run build:web

# 全部构建
npm run build
```

### 9.6 测试

```bash
cd server

# 单元测试（Jest）
npm test

# 监听模式
npm run test:watch

# 覆盖率
npm run test:coverage

# 端到端集成测试
npm run test:system
```

单元测试位于 [server/tests/unit/](file:///e:/PROJECTS/WebStorm/auth-core-2/server/tests/unit/)：`group.util.test.ts`、`pagination.test.ts`、`async-handler.test.ts`、`id-generator.test.ts`、`response.test.ts`

### 9.7 常用运维脚本

```bash
cd server

npm run clear:db         # 清空动态业务数据（保留 RBAC 配置）
npm run clear:all        # 清空全部数据
npm run generate:data    # 生成基础测试数据
npm run generate:complete # 生成完整测试数据
npm run demo:exp         # 演示体验租户
```

### 9.8 Docker 部署

```bash
# 一键部署（构建 + 启动全部服务）
docker-compose up -d --build

# App 容器启动命令:
# sh -c "npx prisma migrate deploy && node -r tsconfig-paths/register dist/app.js"
```

服务端口：
- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:3001/api`
- PostgreSQL：`localhost:5432`
- Redis：`localhost:6379`

---

## 10. API 接口总览

所有 API 以 `/api` 为全局前缀，统一响应格式 `{code, message, data, success}`。

### 认证与用户（`/api/user`）

| 方法 | 路径 | 鉴权 | 权限 | 说明 |
|------|------|------|------|------|
| POST | `/user/register` | - | - | 注册（Zod 校验） |
| POST | `/user/login` | - | - | 登录（限流 10次/15min） |
| POST | `/user/refresh` | - | - | 刷新 Token |
| POST | `/user/logout` | ✅ | - | 登出 |
| GET | `/user/permissions` | ✅ | - | 获取当前用户权限 |
| GET | `/user/list` | ✅ | `sys:user:view` | 用户列表（分页） |
| GET | `/user/:id` | ✅ | `sys:user:view` | 用户详情 |
| PUT | `/user/:id` | ✅ | `sys:user:edit` | 更新用户 |
| PUT | `/user/:id/restore` | ✅ | `sys:user:edit` | 恢复用户 |
| DELETE | `/user/:id` | ✅ | `sys:user:delete` | 删除用户（软） |
| POST | `/user/assign-group` | ✅ | `sys:user:assign` | 分配用户到群组 |

### 租户（`/api/tenant`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/tenant` | `sys:tenant:view` | 租户列表 |
| POST | `/tenant/create` | `sys:tenant:add` | 创建租户 |
| GET | `/tenant/:id` | `sys:tenant:view` | 租户详情 |
| PUT | `/tenant/:id` | `sys:tenant:edit` | 更新租户 |
| DELETE | `/tenant/:id` | `sys:tenant:delete` | 删除租户（软） |
| PUT | `/tenant/:id/restore` | `sys:tenant:edit` | 恢复租户 |

### 角色（`/api/role`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/role` | `sys:role:view` | 角色列表 |
| GET | `/role/:id` | `sys:role:view` | 角色详情 |
| POST | `/role` | `sys:role:add` | 创建角色 |
| PUT | `/role/:id` | `sys:role:edit` | 更新角色 |
| PUT | `/role/:id/restore` | `sys:role:edit` | 恢复角色 |
| DELETE | `/role/:id` | `sys:role:delete` | 删除角色（软） |
| POST | `/role/:roleId/permissions` | `sys:role:assign` | 分配权限给角色 |

### 权限（`/api/permission`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/permission` | `sys:permission:view` | 权限列表（全量） |
| GET | `/permission/:id` | `sys:permission:view` | 权限详情 |
| POST | `/permission` | `sys:permission:add` | 创建权限 |
| PUT | `/permission/:id` | `sys:permission:edit` | 更新权限 |
| DELETE | `/permission/:id` | `sys:permission:delete` | 删除权限（硬） |

### 群组（`/api/group`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/group/root` | `sys:group:add` | 创建根群组 |
| GET | `/group/root/:tenantId` | `sys:group:view` | 获取根群组 |
| POST | `/group` | `sys:group:add` | 创建子群组 |
| GET | `/group/list/:tenantId` | `sys:group:view` | 群组列表 |
| GET | `/group/tree/:tenantId` | `sys:group:view` | 群组树 |
| GET | `/group/tree/:tenantId/:groupId` | `sys:group:view` | 子树 |
| GET | `/group/:id` | `sys:group:view` | 群组详情 |
| PUT | `/group/:id` | `sys:group:edit` | 更新群组 |
| DELETE | `/group/:id` | `sys:group:delete` | 删除群组（软） |
| PUT | `/group/:id/restore` | `sys:group:edit` | 恢复群组 |

### 动态表（`/api/base/tables`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/tables` | `base:table:view` | 表列表 |
| POST | `/tables` | `base:table:add` | 创建表 |
| GET | `/tables/:tableId` | `base:table:view` | 表详情（含字段） |
| PUT | `/tables/:tableId` | `base:table:edit` | 更新表 |
| DELETE | `/tables/:tableId` | `base:table:delete` | 删除表（软） |
| PUT | `/tables/:tableId/restore` | `base:table:edit` | 恢复表 |
| GET | `/tables/:tableId/fields` | `base:field:view` | 字段列表 |
| POST | `/tables/:tableId/fields` | `base:field:add` | 创建字段 |
| GET | `/tables/:tableId/fields/:fieldId` | `base:field:view` | 字段详情 |
| PUT | `/tables/:tableId/fields/:fieldId` | `base:field:edit` | 更新字段 |
| DELETE | `/tables/:tableId/fields/:fieldId` | `base:field:delete` | 删除字段（软） |
| PUT | `/tables/:tableId/fields/:fieldId/restore` | `base:field:edit` | 恢复字段 |
| POST | `/tables/:tableId/records/list` | `base:record:view` | 记录列表（body 传筛选） |
| POST | `/tables/:tableId/records` | `base:record:add` | 创建记录 |
| GET | `/tables/:tableId/records/:recordId` | `base:record:view` | 记录详情 |
| PUT | `/tables/:tableId/records/:recordId` | `base:record:edit` | 更新记录 |
| DELETE | `/tables/:tableId/records/:recordId` | `base:record:delete` | 删除记录（软） |
| PUT | `/tables/:tableId/records/:recordId/restore` | `base:record:edit` | 恢复记录 |

### 表镜像（`/api/base`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/mirrors` | `base:table:view` | 我的镜像列表 |
| POST | `/tables/:tableId/mirrors` | `base:table:add` | 创建镜像 |
| GET | `/tables/:tableId/mirrors` | `base:table:view` | 表的镜像列表 |
| GET | `/mirrors/:mirrorId` | `base:table:view` | 镜像详情 |
| PUT | `/mirrors/:mirrorId` | `base:table:edit` | 更新镜像 |
| DELETE | `/mirrors/:mirrorId` | `base:table:delete` | 删除镜像（硬） |
| POST | `/mirrors/:mirrorId/records/list` | `base:record:view` | 镜像记录列表 |
| GET | `/mirrors/:mirrorId/records/:recordId` | `base:record:view` | 镜像记录详情 |

### 系统管理（`/api/system`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/system/init-super-admin` | - | 初始化超级管理员（引导） |
| POST | `/system/seed-permissions` | ✅ | 同步权限码 |
| POST | `/system/seed-preset-roles` | ✅ | 初始化预设角色 |
| POST | `/system/cleanup` | ✅ | 清理过期软删除数据 |

### 开发者（`/api/developer`）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/developer/ai-generate` | ✅ | AI 蓝图生成（关键词模板匹配） |

---

*文档生成时间：2026-07-14*
