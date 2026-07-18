# Auth-Core 全量 API 综合测试报告

**测试时间**: 2026-07-12T13:58:12.257Z
**Base URL**: `http://localhost:3001/api`
**测试耗时**: 7245ms

## 概览

| 指标 | 值 |
|------|-----|
| 总测试数 | 102 |
| ✅ 通过 | 101 |
| ❌ 失败 | 1 |
| 通过率 | 99.02% |
| 总请求耗时 | 894ms |
| 平均响应时间 | 9ms |
| 最快响应 | 0ms |
| 最慢响应 | 113ms |

## 各模块统计

| 模块 | 总数 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| Auth | 9 | 9 | 0 | 100.0% |
| Tenant | 12 | 12 | 0 | 100.0% |
| User | 17 | 16 | 1 | 94.1% |
| Permission | 9 | 9 | 0 | 100.0% |
| Role | 12 | 12 | 0 | 100.0% |
| Group | 10 | 10 | 0 | 100.0% |
| Base/Table | 9 | 9 | 0 | 100.0% |
| Base/Field | 6 | 6 | 0 | 100.0% |
| Base/Record | 1 | 1 | 0 | 100.0% |
| Mirror | 6 | 6 | 0 | 100.0% |
| System | 3 | 3 | 0 | 100.0% |
| Developer | 2 | 2 | 0 | 100.0% |
| Security | 6 | 6 | 0 | 100.0% |

## 详细测试结果

| # | 模块 | 方法 | URL | 状态码 | 耗时 | 结果 |
|---|------|------|-----|--------|------|------|
| 1 | Auth | POST | `/user/login` | 200 | 107ms | ✅ |
| 2 | Auth | POST | `/user/login` | 401 | 70ms | ✅ |
| 3 | Auth | POST | `/user/login` | 401 | 5ms | ✅ |
| 4 | Auth | POST | `/user/refresh` | 401 | 2ms | ✅ |
| 5 | Tenant | POST | `/tenant/create` | 200 | 113ms | ✅ |
| 6 | Auth | POST | `/user/login` | 200 | 64ms | ✅ |
| 7 | Auth | POST | `/user/logout` | 200 | 11ms | ✅ |
| 8 | Auth | POST | `/user/login` | 200 | 67ms | ✅ |
| 9 | Auth | POST | `/user/refresh` | 200 | 4ms | ✅ |
| 10 | Auth | GET | `/user/permissions` | 200 | 9ms | ✅ |
| 11 | User | POST | `/user/register` | 200 | 67ms | ✅ |
| 12 | User | POST | `/user/register` | 400 | 3ms | ✅ |
| 13 | User | POST | `/user/register` | 400 | 1ms | ✅ |
| 14 | User | POST | `/user/register` | 409 | 3ms | ✅ |
| 15 | User | GET | `/user/list` | 200 | 11ms | ✅ |
| 16 | User | GET | `/user/list?page=1&pageSize=2` | 200 | 9ms | ✅ |
| 17 | User | GET | `/user/list?page=999&pageSize=10` | 200 | 4ms | ✅ |
| 18 | User | GET | `/user/0086b449-bda8-4198-8773-670742c47f86` | 200 | 6ms | ✅ |
| 19 | User | GET | `/user/nonexistent-id-12345` | 404 | 4ms | ✅ |
| 20 | User | PUT | `/user/0086b449-bda8-4198-8773-670742c47f86` | 200 | 6ms | ✅ |
| 21 | User | POST | `/user/assign-group` | 404 | 4ms | ❌ |
| 22 | User | PUT | `/user/0086b449-bda8-4198-8773-670742c47f86/restore` | 404 | 3ms | ✅ |
| 23 | User | DELETE | `/user/0086b449-bda8-4198-8773-670742c47f86` | 200 | 5ms | ✅ |
| 24 | User | PUT | `/user/0086b449-bda8-4198-8773-670742c47f86/restore` | 200 | 5ms | ✅ |
| 25 | User | DELETE | `/user/0086b449-bda8-4198-8773-670742c47f86` | 200 | 4ms | ✅ |
| 26 | User | POST | `/user/assign-group` | 400 | 1ms | ✅ |
| 27 | User | GET | `/user/list` | 200 | 9ms | ✅ |
| 28 | Tenant | GET | `/tenant` | 200 | 5ms | ✅ |
| 29 | Tenant | GET | `/tenant?page=1&pageSize=2` | 200 | 3ms | ✅ |
| 30 | Tenant | GET | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35` | 200 | 11ms | ✅ |
| 31 | Tenant | PUT | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35` | 200 | 5ms | ✅ |
| 32 | Tenant | DELETE | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35` | 200 | 4ms | ✅ |
| 33 | Tenant | PUT | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35/restore` | 200 | 4ms | ✅ |
| 34 | Tenant | GET | `/tenant/nonexistent-id` | 404 | 3ms | ✅ |
| 35 | Tenant | GET | `/tenant` | 403 | 1ms | ✅ |
| 36 | Tenant | POST | `/tenant/create` | 403 | 2ms | ✅ |
| 37 | Tenant | PUT | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35` | 403 | 1ms | ✅ |
| 38 | Tenant | DELETE | `/tenant/0f21e48f-99d7-4af1-8463-7ddbb3871d35` | 403 | 2ms | ✅ |
| 39 | Permission | GET | `/permission` | 200 | 3ms | ✅ |
| 40 | Permission | GET | `/permission?page=1&pageSize=5` | 200 | 2ms | ✅ |
| 41 | Permission | GET | `/permission/3a8f55bb-653e-489f-86f6-1e6da33a6eae` | 200 | 2ms | ✅ |
| 42 | Permission | PUT | `/permission/3a8f55bb-653e-489f-86f6-1e6da33a6eae` | 200 | 5ms | ✅ |
| 43 | Permission | DELETE | `/permission/3a8f55bb-653e-489f-86f6-1e6da33a6eae` | 200 | 4ms | ✅ |
| 44 | Permission | GET | `/permission` | 200 | 3ms | ✅ |
| 45 | Permission | POST | `/permission` | 403 | 2ms | ✅ |
| 46 | Permission | PUT | `/permission/3a8f55bb-653e-489f-86f6-1e6da33a6eae` | 403 | 2ms | ✅ |
| 47 | Permission | DELETE | `/permission/3a8f55bb-653e-489f-86f6-1e6da33a6eae` | 403 | 2ms | ✅ |
| 48 | Role | GET | `/role` | 200 | 13ms | ✅ |
| 49 | Role | GET | `/role?page=1&pageSize=3` | 200 | 6ms | ✅ |
| 50 | Role | GET | `/role/455604f2-a548-47cc-be8e-e83cdce9b549` | 200 | 3ms | ✅ |
| 51 | Role | PUT | `/role/455604f2-a548-47cc-be8e-e83cdce9b549` | 200 | 5ms | ✅ |
| 52 | Role | DELETE | `/role/455604f2-a548-47cc-be8e-e83cdce9b549` | 200 | 5ms | ✅ |
| 53 | Role | PUT | `/role/455604f2-a548-47cc-be8e-e83cdce9b549/restore` | 200 | 3ms | ✅ |
| 54 | Role | POST | `/role/455604f2-a548-47cc-be8e-e83cdce9b549/permissions` | 200 | 8ms | ✅ |
| 55 | Role | POST | `/role/455604f2-a548-47cc-be8e-e83cdce9b549/permissions` | 200 | 4ms | ✅ |
| 56 | Role | GET | `/role` | 200 | 5ms | ✅ |
| 57 | Role | POST | `/role` | 200 | 4ms | ✅ |
| 58 | Role | PUT | `/role/455604f2-a548-47cc-be8e-e83cdce9b549` | 404 | 2ms | ✅ |
| 59 | Role | DELETE | `/role/455604f2-a548-47cc-be8e-e83cdce9b549` | 404 | 3ms | ✅ |
| 60 | Group | GET | `/group/root/ROOT` | 200 | 3ms | ✅ |
| 61 | Group | GET | `/group/list/ROOT` | 200 | 4ms | ✅ |
| 62 | Group | GET | `/group/tree/ROOT` | 200 | 2ms | ✅ |
| 63 | Group | GET | `/group/5c1c0fd2-a602-44d8-836a-4b25029b16c8` | 200 | 3ms | ✅ |
| 64 | Group | GET | `/group/tree/ROOT/ROOT_GROUP` | 200 | 8ms | ✅ |
| 65 | Group | PUT | `/group/5c1c0fd2-a602-44d8-836a-4b25029b16c8` | 200 | 5ms | ✅ |
| 66 | Group | DELETE | `/group/5c1c0fd2-a602-44d8-836a-4b25029b16c8` | 200 | 4ms | ✅ |
| 67 | Group | PUT | `/group/5c1c0fd2-a602-44d8-836a-4b25029b16c8/restore` | 200 | 4ms | ✅ |
| 68 | Group | GET | `/group/tree/ROOT` | 200 | 5ms | ✅ |
| 69 | Group | POST | `/group` | 200 | 5ms | ✅ |
| 70 | Base/Table | GET | `/base/tables` | 200 | 6ms | ✅ |
| 71 | Base/Table | GET | `/base/tables?page=1&pageSize=2` | 200 | 4ms | ✅ |
| 72 | Base/Table | GET | `/base/tables/tblIeUzvwK5ntTH` | 200 | 5ms | ✅ |
| 73 | Base/Table | PUT | `/base/tables/tblIeUzvwK5ntTH` | 200 | 5ms | ✅ |
| 74 | Base/Table | GET | `/base/tables/nonexistent-table-id` | 404 | 3ms | ✅ |
| 75 | Base/Field | GET | `/base/tables/tblIeUzvwK5ntTH/fields` | 200 | 4ms | ✅ |
| 76 | Base/Field | GET | `/base/tables/tblIeUzvwK5ntTH/fields/fldvWuVB8tsr4P5` | 200 | 3ms | ✅ |
| 77 | Base/Field | PUT | `/base/tables/tblIeUzvwK5ntTH/fields/fldvWuVB8tsr4P5` | 200 | 4ms | ✅ |
| 78 | Base/Field | DELETE | `/base/tables/tblIeUzvwK5ntTH/fields/fldvWuVB8tsr4P5` | 200 | 4ms | ✅ |
| 79 | Base/Field | PUT | `/base/tables/tblIeUzvwK5ntTH/fields/fldvWuVB8tsr4P5/restore` | 200 | 4ms | ✅ |
| 80 | Base/Field | POST | `/base/tables/tblIeUzvwK5ntTH/fields` | 400 | 2ms | ✅ |
| 81 | Base/Record | POST | `/base/tables/tblIeUzvwK5ntTH/records/list` | 200 | 6ms | ✅ |
| 82 | Base/Table | DELETE | `/base/tables/tblIeUzvwK5ntTH` | 200 | 4ms | ✅ |
| 83 | Base/Table | PUT | `/base/tables/tblIeUzvwK5ntTH/restore` | 200 | 3ms | ✅ |
| 84 | Base/Table | DELETE | `/base/tables/tblIeUzvwK5ntTH` | 200 | 3ms | ✅ |
| 85 | Base/Table | PUT | `/base/tables/tblIeUzvwK5ntTH/restore` | 200 | 3ms | ✅ |
| 86 | Mirror | GET | `/base/mirrors` | 200 | 7ms | ✅ |
| 87 | Mirror | GET | `/base/tables/tblIeUzvwK5ntTH/mirrors` | 200 | 4ms | ✅ |
| 88 | Mirror | GET | `/base/mirrors/mirqLPMeyIb0CuR` | 200 | 3ms | ✅ |
| 89 | Mirror | PUT | `/base/mirrors/mirqLPMeyIb0CuR` | 200 | 5ms | ✅ |
| 90 | Mirror | POST | `/base/mirrors/mirqLPMeyIb0CuR/records/list` | 200 | 7ms | ✅ |
| 91 | Mirror | DELETE | `/base/mirrors/mirqLPMeyIb0CuR` | 200 | 4ms | ✅ |
| 92 | System | POST | `/system/init-super-admin` | 200 | 2ms | ✅ |
| 93 | System | POST | `/system/seed-permissions` | 200 | 17ms | ✅ |
| 94 | System | POST | `/system/cleanup` | 200 | 7ms | ✅ |
| 95 | Developer | POST | `/developer/ai-generate` | 400 | 2ms | ✅ |
| 96 | Developer | POST | `/developer/ai-generate` | 401 | 1ms | ✅ |
| 97 | Security | GET | `/user/list` | 401 | 1ms | ✅ |
| 98 | Security | GET | `/tenant` | 401 | 1ms | ✅ |
| 99 | Security | GET | `/role` | 401 | 0ms | ✅ |
| 100 | Security | GET | `/permission` | 401 | 1ms | ✅ |
| 101 | Security | GET | `/user/list` | 401 | 1ms | ✅ |
| 102 | Security | POST | `/user/login` | 400 | 1ms | ✅ |

## 失败详情

| # | 模块 | 测试名称 | 预期 | 实际 | URL |
|---|------|----------|------|------|-----|
| 1 | User | 分配群组 | 200 | 404 | `/user/assign-group` |