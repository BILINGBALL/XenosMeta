# Auth-Core 全量 API 综合测试报告

**测试时间**: 2026-07-12T13:56:11.146Z
**Base URL**: `http://localhost:3001/api`
**测试耗时**: 7944ms

## 概览

| 指标 | 值 |
|------|-----|
| 总测试数 | 102 |
| ✅ 通过 | 90 |
| ❌ 失败 | 12 |
| 通过率 | 88.24% |
| 总请求耗时 | 1355ms |
| 平均响应时间 | 13ms |
| 最快响应 | 1ms |
| 最慢响应 | 158ms |

## 各模块统计

| 模块 | 总数 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| Auth | 9 | 9 | 0 | 100.0% |
| Tenant | 12 | 12 | 0 | 100.0% |
| User | 17 | 16 | 1 | 94.1% |
| Permission | 9 | 9 | 0 | 100.0% |
| Role | 12 | 8 | 4 | 66.7% |
| Group | 10 | 8 | 2 | 80.0% |
| Base/Table | 9 | 9 | 0 | 100.0% |
| Base/Field | 6 | 6 | 0 | 100.0% |
| Base/Record | 1 | 1 | 0 | 100.0% |
| Mirror | 6 | 2 | 4 | 33.3% |
| System | 3 | 3 | 0 | 100.0% |
| Developer | 2 | 2 | 0 | 100.0% |
| Security | 6 | 5 | 1 | 83.3% |

## 详细测试结果

| # | 模块 | 方法 | URL | 状态码 | 耗时 | 结果 |
|---|------|------|-----|--------|------|------|
| 1 | Auth | POST | `/user/login` | 200 | 127ms | ✅ |
| 2 | Auth | POST | `/user/login` | 401 | 77ms | ✅ |
| 3 | Auth | POST | `/user/login` | 401 | 6ms | ✅ |
| 4 | Auth | POST | `/user/refresh` | 401 | 3ms | ✅ |
| 5 | Tenant | POST | `/tenant/create` | 200 | 158ms | ✅ |
| 6 | Auth | POST | `/user/login` | 200 | 84ms | ✅ |
| 7 | Auth | POST | `/user/logout` | 200 | 19ms | ✅ |
| 8 | Auth | POST | `/user/login` | 200 | 81ms | ✅ |
| 9 | Auth | POST | `/user/refresh` | 200 | 7ms | ✅ |
| 10 | Auth | GET | `/user/permissions` | 200 | 13ms | ✅ |
| 11 | User | POST | `/user/register` | 200 | 82ms | ✅ |
| 12 | User | POST | `/user/register` | 400 | 3ms | ✅ |
| 13 | User | POST | `/user/register` | 400 | 2ms | ✅ |
| 14 | User | POST | `/user/register` | 409 | 4ms | ✅ |
| 15 | User | GET | `/user/list` | 200 | 8ms | ✅ |
| 16 | User | GET | `/user/list?page=1&pageSize=2` | 200 | 10ms | ✅ |
| 17 | User | GET | `/user/list?page=999&pageSize=10` | 200 | 5ms | ✅ |
| 18 | User | GET | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7` | 200 | 7ms | ✅ |
| 19 | User | GET | `/user/nonexistent-id-12345` | 404 | 5ms | ✅ |
| 20 | User | PUT | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7` | 200 | 9ms | ✅ |
| 21 | User | PUT | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7/restore` | 404 | 5ms | ✅ |
| 22 | User | DELETE | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7` | 200 | 7ms | ✅ |
| 23 | User | PUT | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7/restore` | 200 | 7ms | ✅ |
| 24 | User | DELETE | `/user/116d4870-d652-4e62-95e1-d5efbccb3bf7` | 200 | 8ms | ✅ |
| 25 | User | POST | `/user/assign-group` | 404 | 6ms | ❌ |
| 26 | User | POST | `/user/assign-group` | 400 | 4ms | ✅ |
| 27 | User | GET | `/user/list` | 200 | 12ms | ✅ |
| 28 | Tenant | GET | `/tenant` | 200 | 5ms | ✅ |
| 29 | Tenant | GET | `/tenant?page=1&pageSize=2` | 200 | 5ms | ✅ |
| 30 | Tenant | GET | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d` | 200 | 17ms | ✅ |
| 31 | Tenant | PUT | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d` | 200 | 9ms | ✅ |
| 32 | Tenant | DELETE | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d` | 200 | 6ms | ✅ |
| 33 | Tenant | PUT | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d/restore` | 200 | 8ms | ✅ |
| 34 | Tenant | GET | `/tenant/nonexistent-id` | 404 | 4ms | ✅ |
| 35 | Tenant | GET | `/tenant` | 403 | 3ms | ✅ |
| 36 | Tenant | POST | `/tenant/create` | 403 | 3ms | ✅ |
| 37 | Tenant | PUT | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d` | 403 | 4ms | ✅ |
| 38 | Tenant | DELETE | `/tenant/453f5393-00d5-45dc-b183-1682c52c1e0d` | 403 | 4ms | ✅ |
| 39 | Permission | GET | `/permission` | 200 | 5ms | ✅ |
| 40 | Permission | GET | `/permission?page=1&pageSize=5` | 200 | 5ms | ✅ |
| 41 | Permission | GET | `/permission/9c39cc47-03b6-4b2a-824d-b80674b32377` | 200 | 5ms | ✅ |
| 42 | Permission | PUT | `/permission/9c39cc47-03b6-4b2a-824d-b80674b32377` | 200 | 7ms | ✅ |
| 43 | Permission | DELETE | `/permission/9c39cc47-03b6-4b2a-824d-b80674b32377` | 200 | 6ms | ✅ |
| 44 | Permission | GET | `/permission` | 200 | 6ms | ✅ |
| 45 | Permission | POST | `/permission` | 403 | 3ms | ✅ |
| 46 | Permission | PUT | `/permission/9c39cc47-03b6-4b2a-824d-b80674b32377` | 403 | 4ms | ✅ |
| 47 | Permission | DELETE | `/permission/9c39cc47-03b6-4b2a-824d-b80674b32377` | 403 | 3ms | ✅ |
| 48 | Role | GET | `/role` | 200 | 38ms | ✅ |
| 49 | Role | GET | `/role?page=1&pageSize=3` | 200 | 9ms | ✅ |
| 50 | Role | GET | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` | 200 | 6ms | ✅ |
| 51 | Role | PUT | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` | 200 | 7ms | ✅ |
| 52 | Role | DELETE | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` | 200 | 7ms | ✅ |
| 53 | Role | PUT | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9/restore` | 200 | 6ms | ✅ |
| 54 | Role | POST | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9/permissions` | 200 | 13ms | ✅ |
| 55 | Role | POST | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9/permissions` | 200 | 11ms | ✅ |
| 56 | Role | GET | `/role` | 200 | 8ms | ❌ |
| 57 | Role | POST | `/role` | 409 | 28ms | ❌ |
| 58 | Role | PUT | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` | 404 | 5ms | ❌ |
| 59 | Role | DELETE | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` | 404 | 4ms | ❌ |
| 60 | Group | GET | `/group/root/ROOT` | 200 | 5ms | ✅ |
| 61 | Group | GET | `/group/list/ROOT` | 200 | 7ms | ✅ |
| 62 | Group | GET | `/group/tree/ROOT` | 200 | 23ms | ✅ |
| 63 | Group | GET | `/group/a8fdf681-51bd-465b-b37f-a38bda25a15c` | 200 | 6ms | ✅ |
| 64 | Group | GET | `/group/tree/ROOT/ROOT_GROUP` | 200 | 9ms | ✅ |
| 65 | Group | PUT | `/group/a8fdf681-51bd-465b-b37f-a38bda25a15c` | 200 | 8ms | ✅ |
| 66 | Group | DELETE | `/group/a8fdf681-51bd-465b-b37f-a38bda25a15c` | 200 | 8ms | ✅ |
| 67 | Group | PUT | `/group/a8fdf681-51bd-465b-b37f-a38bda25a15c/restore` | 200 | 8ms | ✅ |
| 68 | Group | GET | `/group/tree/ROOT` | 200 | 8ms | ❌ |
| 69 | Group | POST | `/group` | 409 | 14ms | ❌ |
| 70 | Base/Table | GET | `/base/tables` | 200 | 6ms | ✅ |
| 71 | Base/Table | GET | `/base/tables?page=1&pageSize=2` | 200 | 5ms | ✅ |
| 72 | Base/Table | GET | `/base/tables/tblezn1wcWfeCAX` | 200 | 6ms | ✅ |
| 73 | Base/Table | PUT | `/base/tables/tblezn1wcWfeCAX` | 200 | 8ms | ✅ |
| 74 | Base/Table | GET | `/base/tables/nonexistent-table-id` | 404 | 10ms | ✅ |
| 75 | Base/Field | GET | `/base/tables/tblezn1wcWfeCAX/fields` | 200 | 10ms | ✅ |
| 76 | Base/Field | GET | `/base/tables/tblezn1wcWfeCAX/fields/fldzruI2Y5Y8PVO` | 200 | 6ms | ✅ |
| 77 | Base/Field | PUT | `/base/tables/tblezn1wcWfeCAX/fields/fldzruI2Y5Y8PVO` | 200 | 9ms | ✅ |
| 78 | Base/Field | DELETE | `/base/tables/tblezn1wcWfeCAX/fields/fldzruI2Y5Y8PVO` | 200 | 9ms | ✅ |
| 79 | Base/Field | PUT | `/base/tables/tblezn1wcWfeCAX/fields/fldzruI2Y5Y8PVO/restore` | 200 | 7ms | ✅ |
| 80 | Base/Field | POST | `/base/tables/tblezn1wcWfeCAX/fields` | 400 | 4ms | ✅ |
| 81 | Base/Record | POST | `/base/tables/tblezn1wcWfeCAX/records/list` | 200 | 10ms | ✅ |
| 82 | Base/Table | DELETE | `/base/tables/tblezn1wcWfeCAX` | 200 | 7ms | ✅ |
| 83 | Base/Table | PUT | `/base/tables/tblezn1wcWfeCAX/restore` | 200 | 7ms | ✅ |
| 84 | Base/Table | DELETE | `/base/tables/tblezn1wcWfeCAX` | 200 | 6ms | ✅ |
| 85 | Base/Table | PUT | `/base/tables/tblezn1wcWfeCAX/restore` | 200 | 6ms | ✅ |
| 86 | Mirror | GET | `/base/mirrors` | 200 | 18ms | ✅ |
| 87 | Mirror | GET | `/base/tables/tblezn1wcWfeCAX/mirrors` | 200 | 8ms | ✅ |
| 88 | Mirror | GET | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` | 404 | 7ms | ❌ |
| 89 | Mirror | PUT | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` | 404 | 7ms | ❌ |
| 90 | Mirror | POST | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b/records/list` | 404 | 6ms | ❌ |
| 91 | Mirror | DELETE | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` | 404 | 11ms | ❌ |
| 92 | System | POST | `/system/init-super-admin` | 200 | 4ms | ✅ |
| 93 | System | POST | `/system/seed-permissions` | 200 | 40ms | ✅ |
| 94 | System | POST | `/system/cleanup` | 200 | 13ms | ✅ |
| 95 | Developer | POST | `/developer/ai-generate` | 400 | 4ms | ✅ |
| 96 | Developer | POST | `/developer/ai-generate` | 401 | 2ms | ✅ |
| 97 | Security | GET | `/user/list` | 401 | 2ms | ✅ |
| 98 | Security | GET | `/tenant` | 401 | 1ms | ✅ |
| 99 | Security | GET | `/role` | 401 | 1ms | ✅ |
| 100 | Security | GET | `/permission` | 401 | 2ms | ✅ |
| 101 | Security | GET | `/user/list` | 401 | 1ms | ✅ |
| 102 | Security | POST | `/user/login` | 429 | 3ms | ❌ |

## 失败详情

| # | 模块 | 测试名称 | 预期 | 实际 | URL |
|---|------|----------|------|------|-----|
| 1 | User | 分配群组 | 200 | 404 | `/user/assign-group` |
| 2 | Role | [Tenant]查看角色列表-拒绝 | [401,403] | 200 | `/role` |
| 3 | Role | [Tenant]创建角色-拒绝 | [401,403] | 409 | `/role` |
| 4 | Role | [Tenant]更新角色-拒绝 | [401,403] | 404 | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` |
| 5 | Role | [Tenant]删除角色-拒绝 | [401,403] | 404 | `/role/73f96fb7-fc9f-4358-9f68-f726a12c3ab9` |
| 6 | Group | [Tenant]查看群组树-拒绝 | [401,403] | 200 | `/group/tree/ROOT` |
| 7 | Group | [Tenant]创建群组-拒绝 | [401,403] | 409 | `/group` |
| 8 | Mirror | 获取镜像详情 | 200 | 404 | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` |
| 9 | Mirror | 更新镜像 | 200 | 404 | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` |
| 10 | Mirror | 通过镜像获取记录列表 | 200 | 404 | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b/records/list` |
| 11 | Mirror | 删除镜像 | 200 | 404 | `/base/mirrors/fe5a5338-c255-4b4c-b86e-581e126acb9b` |
| 12 | Security | 格式错误JSON | [400,401,500] | 429 | `/user/login` |