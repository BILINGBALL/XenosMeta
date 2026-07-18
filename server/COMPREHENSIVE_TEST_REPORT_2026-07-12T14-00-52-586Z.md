# Auth-Core 全量 API 综合测试报告

**测试时间**: 2026-07-12T14:01:00.167Z
**Base URL**: `http://localhost:3001/api`
**测试耗时**: 7574ms

## 概览

| 指标 | 值 |
|------|-----|
| 总测试数 | 102 |
| ✅ 通过 | 102 |
| ❌ 失败 | 0 |
| 通过率 | 100.00% |
| 总请求耗时 | 1036ms |
| 平均响应时间 | 10ms |
| 最快响应 | 1ms |
| 最慢响应 | 134ms |

## 各模块统计

| 模块 | 总数 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| Auth | 9 | 9 | 0 | 100.0% |
| Tenant | 12 | 12 | 0 | 100.0% |
| User | 17 | 17 | 0 | 100.0% |
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
| 1 | Auth | POST | `/user/login` | 200 | 102ms | ✅ |
| 2 | Auth | POST | `/user/login` | 401 | 66ms | ✅ |
| 3 | Auth | POST | `/user/login` | 401 | 4ms | ✅ |
| 4 | Auth | POST | `/user/refresh` | 401 | 3ms | ✅ |
| 5 | Tenant | POST | `/tenant/create` | 200 | 134ms | ✅ |
| 6 | Auth | POST | `/user/login` | 200 | 66ms | ✅ |
| 7 | Auth | POST | `/user/logout` | 200 | 16ms | ✅ |
| 8 | Auth | POST | `/user/login` | 200 | 69ms | ✅ |
| 9 | Auth | POST | `/user/refresh` | 200 | 5ms | ✅ |
| 10 | Auth | GET | `/user/permissions` | 200 | 16ms | ✅ |
| 11 | User | POST | `/user/register` | 200 | 69ms | ✅ |
| 12 | User | POST | `/user/register` | 400 | 2ms | ✅ |
| 13 | User | POST | `/user/register` | 400 | 1ms | ✅ |
| 14 | User | POST | `/user/register` | 409 | 4ms | ✅ |
| 15 | User | GET | `/user/list` | 200 | 10ms | ✅ |
| 16 | User | GET | `/user/list?page=1&pageSize=2` | 200 | 11ms | ✅ |
| 17 | User | GET | `/user/list?page=999&pageSize=10` | 200 | 4ms | ✅ |
| 18 | User | GET | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1` | 200 | 4ms | ✅ |
| 19 | User | GET | `/user/nonexistent-id-12345` | 404 | 5ms | ✅ |
| 20 | User | PUT | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1` | 200 | 7ms | ✅ |
| 21 | User | POST | `/user/assign-group` | 200 | 7ms | ✅ |
| 22 | User | PUT | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1/restore` | 404 | 4ms | ✅ |
| 23 | User | DELETE | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1` | 200 | 6ms | ✅ |
| 24 | User | PUT | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1/restore` | 200 | 6ms | ✅ |
| 25 | User | DELETE | `/user/713a5ead-bf6e-46a4-87ca-40caaf8459f1` | 200 | 5ms | ✅ |
| 26 | User | POST | `/user/assign-group` | 400 | 2ms | ✅ |
| 27 | User | GET | `/user/list` | 200 | 9ms | ✅ |
| 28 | Tenant | GET | `/tenant` | 200 | 4ms | ✅ |
| 29 | Tenant | GET | `/tenant?page=1&pageSize=2` | 200 | 4ms | ✅ |
| 30 | Tenant | GET | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa` | 200 | 13ms | ✅ |
| 31 | Tenant | PUT | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa` | 200 | 6ms | ✅ |
| 32 | Tenant | DELETE | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa` | 200 | 5ms | ✅ |
| 33 | Tenant | PUT | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa/restore` | 200 | 6ms | ✅ |
| 34 | Tenant | GET | `/tenant/nonexistent-id` | 404 | 4ms | ✅ |
| 35 | Tenant | GET | `/tenant` | 403 | 2ms | ✅ |
| 36 | Tenant | POST | `/tenant/create` | 403 | 3ms | ✅ |
| 37 | Tenant | PUT | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa` | 403 | 2ms | ✅ |
| 38 | Tenant | DELETE | `/tenant/0913f189-9032-45f2-bd6c-a8fc327f49fa` | 403 | 3ms | ✅ |
| 39 | Permission | GET | `/permission` | 200 | 3ms | ✅ |
| 40 | Permission | GET | `/permission?page=1&pageSize=5` | 200 | 3ms | ✅ |
| 41 | Permission | GET | `/permission/b6fc550d-93c6-4e94-88b4-d3afcb97d13c` | 200 | 4ms | ✅ |
| 42 | Permission | PUT | `/permission/b6fc550d-93c6-4e94-88b4-d3afcb97d13c` | 200 | 6ms | ✅ |
| 43 | Permission | DELETE | `/permission/b6fc550d-93c6-4e94-88b4-d3afcb97d13c` | 200 | 5ms | ✅ |
| 44 | Permission | GET | `/permission` | 200 | 4ms | ✅ |
| 45 | Permission | POST | `/permission` | 403 | 3ms | ✅ |
| 46 | Permission | PUT | `/permission/b6fc550d-93c6-4e94-88b4-d3afcb97d13c` | 403 | 3ms | ✅ |
| 47 | Permission | DELETE | `/permission/b6fc550d-93c6-4e94-88b4-d3afcb97d13c` | 403 | 2ms | ✅ |
| 48 | Role | GET | `/role` | 200 | 17ms | ✅ |
| 49 | Role | GET | `/role?page=1&pageSize=3` | 200 | 7ms | ✅ |
| 50 | Role | GET | `/role/b81f6917-455e-4690-ba76-850752523b24` | 200 | 4ms | ✅ |
| 51 | Role | PUT | `/role/b81f6917-455e-4690-ba76-850752523b24` | 200 | 6ms | ✅ |
| 52 | Role | DELETE | `/role/b81f6917-455e-4690-ba76-850752523b24` | 200 | 6ms | ✅ |
| 53 | Role | PUT | `/role/b81f6917-455e-4690-ba76-850752523b24/restore` | 200 | 5ms | ✅ |
| 54 | Role | POST | `/role/b81f6917-455e-4690-ba76-850752523b24/permissions` | 200 | 10ms | ✅ |
| 55 | Role | POST | `/role/b81f6917-455e-4690-ba76-850752523b24/permissions` | 200 | 6ms | ✅ |
| 56 | Role | GET | `/role` | 200 | 6ms | ✅ |
| 57 | Role | POST | `/role` | 200 | 7ms | ✅ |
| 58 | Role | PUT | `/role/b81f6917-455e-4690-ba76-850752523b24` | 404 | 4ms | ✅ |
| 59 | Role | DELETE | `/role/b81f6917-455e-4690-ba76-850752523b24` | 404 | 3ms | ✅ |
| 60 | Group | GET | `/group/root/d28ee5e0-a1ea-4d1d-ab65-20952aeee089` | 200 | 4ms | ✅ |
| 61 | Group | GET | `/group/list/d28ee5e0-a1ea-4d1d-ab65-20952aeee089` | 200 | 6ms | ✅ |
| 62 | Group | GET | `/group/tree/d28ee5e0-a1ea-4d1d-ab65-20952aeee089` | 200 | 5ms | ✅ |
| 63 | Group | GET | `/group/c08dc479-3a6c-4f45-b803-f470dd0b5132` | 200 | 5ms | ✅ |
| 64 | Group | GET | `/group/tree/d28ee5e0-a1ea-4d1d-ab65-20952aeee089/7aba3f17-c11e-41a8-ba09-3dc29193e2c6` | 200 | 6ms | ✅ |
| 65 | Group | PUT | `/group/c08dc479-3a6c-4f45-b803-f470dd0b5132` | 200 | 5ms | ✅ |
| 66 | Group | DELETE | `/group/c08dc479-3a6c-4f45-b803-f470dd0b5132` | 200 | 5ms | ✅ |
| 67 | Group | PUT | `/group/c08dc479-3a6c-4f45-b803-f470dd0b5132/restore` | 200 | 5ms | ✅ |
| 68 | Group | GET | `/group/tree/d28ee5e0-a1ea-4d1d-ab65-20952aeee089` | 200 | 5ms | ✅ |
| 69 | Group | POST | `/group` | 200 | 6ms | ✅ |
| 70 | Base/Table | GET | `/base/tables` | 200 | 7ms | ✅ |
| 71 | Base/Table | GET | `/base/tables?page=1&pageSize=2` | 200 | 4ms | ✅ |
| 72 | Base/Table | GET | `/base/tables/tblHyYewejg4yPJ` | 200 | 5ms | ✅ |
| 73 | Base/Table | PUT | `/base/tables/tblHyYewejg4yPJ` | 200 | 6ms | ✅ |
| 74 | Base/Table | GET | `/base/tables/nonexistent-table-id` | 404 | 4ms | ✅ |
| 75 | Base/Field | GET | `/base/tables/tblHyYewejg4yPJ/fields` | 200 | 5ms | ✅ |
| 76 | Base/Field | GET | `/base/tables/tblHyYewejg4yPJ/fields/fldHydtAMnceT0s` | 200 | 5ms | ✅ |
| 77 | Base/Field | PUT | `/base/tables/tblHyYewejg4yPJ/fields/fldHydtAMnceT0s` | 200 | 6ms | ✅ |
| 78 | Base/Field | DELETE | `/base/tables/tblHyYewejg4yPJ/fields/fldHydtAMnceT0s` | 200 | 6ms | ✅ |
| 79 | Base/Field | PUT | `/base/tables/tblHyYewejg4yPJ/fields/fldHydtAMnceT0s/restore` | 200 | 6ms | ✅ |
| 80 | Base/Field | POST | `/base/tables/tblHyYewejg4yPJ/fields` | 400 | 3ms | ✅ |
| 81 | Base/Record | POST | `/base/tables/tblHyYewejg4yPJ/records/list` | 200 | 10ms | ✅ |
| 82 | Base/Table | DELETE | `/base/tables/tblHyYewejg4yPJ` | 200 | 6ms | ✅ |
| 83 | Base/Table | PUT | `/base/tables/tblHyYewejg4yPJ/restore` | 200 | 6ms | ✅ |
| 84 | Base/Table | DELETE | `/base/tables/tblHyYewejg4yPJ` | 200 | 5ms | ✅ |
| 85 | Base/Table | PUT | `/base/tables/tblHyYewejg4yPJ/restore` | 200 | 6ms | ✅ |
| 86 | Mirror | GET | `/base/mirrors` | 200 | 9ms | ✅ |
| 87 | Mirror | GET | `/base/tables/tblHyYewejg4yPJ/mirrors` | 200 | 6ms | ✅ |
| 88 | Mirror | GET | `/base/mirrors/miruHiqkObgAjy8` | 200 | 6ms | ✅ |
| 89 | Mirror | PUT | `/base/mirrors/miruHiqkObgAjy8` | 200 | 7ms | ✅ |
| 90 | Mirror | POST | `/base/mirrors/miruHiqkObgAjy8/records/list` | 200 | 9ms | ✅ |
| 91 | Mirror | DELETE | `/base/mirrors/miruHiqkObgAjy8` | 200 | 6ms | ✅ |
| 92 | System | POST | `/system/init-super-admin` | 200 | 1ms | ✅ |
| 93 | System | POST | `/system/seed-permissions` | 200 | 26ms | ✅ |
| 94 | System | POST | `/system/cleanup` | 200 | 9ms | ✅ |
| 95 | Developer | POST | `/developer/ai-generate` | 400 | 3ms | ✅ |
| 96 | Developer | POST | `/developer/ai-generate` | 401 | 1ms | ✅ |
| 97 | Security | GET | `/user/list` | 401 | 1ms | ✅ |
| 98 | Security | GET | `/tenant` | 401 | 1ms | ✅ |
| 99 | Security | GET | `/role` | 401 | 1ms | ✅ |
| 100 | Security | GET | `/permission` | 401 | 1ms | ✅ |
| 101 | Security | GET | `/user/list` | 401 | 2ms | ✅ |
| 102 | Security | POST | `/user/login` | 400 | 2ms | ✅ |

## 失败详情

> 🎉 所有测试全部通过！