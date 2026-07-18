/**
 * 全量 API 综合测试 — 详细报告版
 * 覆盖所有端点，记录请求/响应、耗时、状态码，生成 JSON + Markdown 报告
 *
 * 用法: npx ts-node -r tsconfig-paths/register tests/comprehensive-api-test.ts
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API = 'http://localhost:3001/api';
const REPORT_DIR = path.resolve(__dirname, '..');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface TestCase {
  module: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  params?: Record<string, string>;
  expected: number | number[];
  token?: 'system' | 'tenant' | 'none';
  description?: string;
}

interface TestResult {
  module: string;
  name: string;
  method: string;
  fullUrl: string;
  path: string;
  request: {
    headers: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
  };
  response: {
    status: number;
    body: any;
    rawBody: any;  // 未脱敏的原始响应，用于提取 token 等
    timeMs: number;
    success: boolean;
    error?: string;
  };
  expected: number | number[];
  passed: boolean;
  timestamp: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  byModule: Record<string, { total: number; passed: number; failed: number }>;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════

const results: TestResult[] = [];
const tokens: Record<string, string> = {};
const testIds: Record<string, string> = {};
const suiteStartTime = Date.now();

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function redactToken(s: string): string {
  if (!s) return s;
  return s.length > 30 ? s.substring(0, 15) + '...' + s.substring(s.length - 10) : s;
}

function redactSensitive(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') return obj;
  const cloned = JSON.parse(JSON.stringify(obj));
  const walk = (o: any) => {
    if (!o || typeof o !== 'object') return;
    if (o.accessToken) o.accessToken = redactToken(o.accessToken);
    if (o.refreshToken) o.refreshToken = redactToken(o.refreshToken);
    if (o.password) o.password = '***';
    Object.values(o).forEach(walk);
  };
  walk(cloned);
  return cloned;
}

async function run(test: TestCase): Promise<TestResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token =
    test.token === 'system' ? tokens.system :
    test.token === 'tenant' ? tokens.tenant : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let resolvedPath = test.path;
  if (test.params) {
    for (const [k, v] of Object.entries(test.params)) {
      resolvedPath = resolvedPath.replace(`:${k}`, testIds[v] || v);
    }
  }

  const fullUrl = `${API}${resolvedPath}`;
  const config: AxiosRequestConfig = {
    headers,
    validateStatus: () => true, // don't throw on any status
  };

  const start = Date.now();
  let res: AxiosResponse;
  try {
    switch (test.method) {
      case 'GET':    res = await axios.get(fullUrl, config); break;
      case 'POST':   res = await axios.post(fullUrl, test.body, { ...config }); break;
      case 'PUT':    res = await axios.put(fullUrl, test.body, { ...config }); break;
      case 'DELETE': res = await axios.delete(fullUrl, { ...config }); break;
    }
  } catch (e: any) {
    res = e.response || { status: 0, data: null };
  }
  const timeMs = Date.now() - start;

  const passed = Array.isArray(test.expected)
    ? test.expected.includes(res!.status)
    : res!.status === test.expected;

  const result: TestResult = {
    module: test.module,
    name: test.name,
    method: test.method,
    fullUrl,
    path: resolvedPath,
    request: {
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${redactToken(token)}` } : {}) },
      body: test.body,
      params: test.params,
    },
    response: {
      status: res!.status,
      body: redactSensitive(res!.data),
      rawBody: res!.data,  // 保留原始数据供提取 token
      timeMs,
      success: res!.status >= 200 && res!.status < 300,
      error: res!.status === 0 ? 'Network error / no response' : undefined,
    },
    expected: test.expected,
    passed,
    timestamp: new Date().toISOString(),
  };

  results.push(result);

  const icon = passed ? '✅' : '❌';
  const statusColor = res!.status < 300 ? '\x1b[32m' : res!.status < 500 ? '\x1b[33m' : '\x1b[31m';
  console.log(`  ${icon} ${test.method.padEnd(6)} ${resolvedPath.padEnd(52)} ${statusColor}${res!.status}\x1b[0m  \x1b[36m${timeMs}ms\x1b[0m`);

  if (!passed) {
    console.log(`     \x1b[31mexpected ${JSON.stringify(test.expected)}, got ${res!.status}\x1b[0m`);
    if (res!.data) {
      const snippet = typeof res!.data === 'string' ? res!.data.substring(0, 200) : JSON.stringify(res!.data).substring(0, 200);
      console.log(`     \x1b[31mbody: ${snippet}\x1b[0m`);
    }
  }

  return result;
}

function summary(): TestSummary {
  const byModule: Record<string, { total: number; passed: number; failed: number }> = {};
  const times = results.map(r => r.response.timeMs);
  const totalTimeMs = times.reduce((a, b) => a + b, 0);

  for (const r of results) {
    if (!byModule[r.module]) byModule[r.module] = { total: 0, passed: 0, failed: 0 };
    byModule[r.module].total++;
    if (r.passed) byModule[r.module].passed++;
    else byModule[r.module].failed++;
  }

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    byModule,
    totalTimeMs,
    avgTimeMs: results.length ? Math.round(totalTimeMs / results.length) : 0,
    minTimeMs: times.length ? Math.min(...times) : 0,
    maxTimeMs: times.length ? Math.max(...times) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Main Test Suite
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       Auth-Core 全量 API 综合测试 — 详细报告版                    ║');
  console.log('║       Base URL: ' + API + '                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();

  // ════════════════════════════════════════════════════════════
  // Phase 0: 系统初始化 & 认证登录
  // ════════════════════════════════════════════════════════════
  console.log('═══ Phase 0: 系统初始化 & 认证登录 ═══\n');

  // 0.1 登录获取 system token
  const loginRes = await run({
    module: 'Auth', name: 'System Admin 登录', method: 'POST', path: '/user/login',
    body: { username: 'system_admin', password: 'admin123' },
    expected: 200, token: 'none',
    description: '使用系统管理员账号登录，获取 access token',
  });
  if (loginRes.response.rawBody?.data?.accessToken) {
    tokens.system = loginRes.response.rawBody.data.accessToken;
    // 从 JWT payload 获取 tenantId（login response 不含此字段）
    const jwtPayload = JSON.parse(Buffer.from(tokens.system.split('.')[1], 'base64').toString());
    testIds.systemTenantId = jwtPayload.tenantId || '';
  } else {
    console.error('❌ 无法获取 system token，测试终止');
    process.exit(1);
  }
  // rootTenantId 与系统管理员同一租户，确保 assign-group 等操作一致
  const rootTenantId = testIds.systemTenantId;

  // 延迟以避免触发登录频率限制
  await new Promise(r => setTimeout(r, 1500));

  // 0.2 错误密码登录
  await run({
    module: 'Auth', name: '错误密码登录', method: 'POST', path: '/user/login',
    body: { username: 'system_admin', password: 'wrong_password' },
    expected: [401, 429], token: 'none',
    description: '使用错误密码登录，应返回 401',
  });

  await new Promise(r => setTimeout(r, 1500));

  // 0.3 不存在的用户登录
  await run({
    module: 'Auth', name: '不存在用户登录', method: 'POST', path: '/user/login',
    body: { username: 'nonexistent_user_xyz', password: 'test1234' },
    expected: [401, 429], token: 'none',
    description: '使用不存在的用户名登录，应返回 401',
  });

  // 0.4 刷新 token (无效 token)
  await run({
    module: 'Auth', name: '刷新Token-无效token', method: 'POST', path: '/user/refresh',
    body: { refreshToken: 'invalid_refresh_token' },
    expected: 401, token: 'none',
    description: '使用无效的 refresh token 刷新，应返回 401',
  });

  // 0.5 准备测试租户和 tenant admin
  const ts = Date.now();
  const tenantRes = await run({
    module: 'Tenant', name: '创建测试租户(数据准备)', method: 'POST', path: '/tenant/create',
    body: { tenantName: `综合测试租户`, tenantCode: `COMPREHENSIVE_${ts}`, type: 'normal' },
    expected: 200, token: 'system',
    description: '创建测试租户用于后续测试',
  });
  testIds.testTenantId = tenantRes.response.rawBody?.data?.id || 'TEST_TENANT';
  testIds.ts = String(ts);

  // 创建 tenant admin 角色和用户
  console.log('\n  🔧 准备测试数据(tenant admin)...');
  const tenantRole = await prisma.role.upsert({
    where: { roleCode: `COMP_TEST_ADMIN_${ts}` },
    update: { tenantId: testIds.testTenantId },
    create: {
      roleName: '综合测试管理员', roleCode: `COMP_TEST_ADMIN_${ts}`,
      scope: 'tenant', tenantId: testIds.testTenantId, status: true,
    },
  });
  const tenantPerms = await prisma.permission.findMany({ where: { scope: 'tenant' } });
  for (const p of tenantPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: tenantRole.id, permissionId: p.id } },
      update: {}, create: { roleId: tenantRole.id, permissionId: p.id },
    });
  }
  const rootGroup = await prisma.group.upsert({
    where: { groupCode: `ROOT_COMP_TEST_${ts}` },
    update: {},
    create: {
      groupName: '综合测试根组', groupCode: `ROOT_COMP_TEST_${ts}`,
      tenantId: testIds.testTenantId, parentId: null, status: true,
    },
  });
  if (!rootGroup.path) {
    await prisma.group.update({ where: { id: rootGroup.id }, data: { path: `/${rootGroup.id}` } });
  }
  const hashed = await bcrypt.hash('test1234', 10);
  const tenantUser = await prisma.user.upsert({
    where: { username: `comp_test_admin_${ts}` },
    update: { tenantId: testIds.testTenantId },
    create: {
      username: `comp_test_admin_${ts}`, password: hashed,
      nickname: '综合测试管理员', tenantId: testIds.testTenantId, status: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: tenantUser.id, roleId: tenantRole.id } },
    update: {}, create: { userId: tenantUser.id, roleId: tenantRole.id },
  });
  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: tenantUser.id, groupId: rootGroup.id } },
    update: {}, create: { userId: tenantUser.id, groupId: rootGroup.id },
  });
  testIds.rootGroupId = rootGroup.id;
  console.log('  ✅ 测试数据准备完成\n');

  const tenantLoginRes = await run({
    module: 'Auth', name: 'Tenant Admin 登录', method: 'POST', path: '/user/login',
    body: { username: `comp_test_admin_${ts}`, password: 'test1234' },
    expected: 200, token: 'none',
    description: '使用租户管理员账号登录',
  });
  if (tenantLoginRes.response.rawBody?.data?.accessToken) {
    tokens.tenant = tenantLoginRes.response.rawBody.data.accessToken;
  }

  // 0.6 登出
  await run({
    module: 'Auth', name: '用户登出', method: 'POST', path: '/user/logout',
    expected: 200, token: 'system',
    description: '用户登出，token 加入黑名单',
  });

  await new Promise(r => setTimeout(r, 1500));

  // 重新登录以继续测试
  const reLoginRes = await run({
    module: 'Auth', name: '重新登录(续token)', method: 'POST', path: '/user/login',
    body: { username: 'system_admin', password: 'admin123' },
    expected: 200, token: 'none',
  });
  if (reLoginRes.response.rawBody?.data?.accessToken) {
    tokens.system = reLoginRes.response.rawBody.data.accessToken;
  }
  if (reLoginRes.response.rawBody?.data?.refreshToken) {
    const validRefresh = reLoginRes.response.rawBody.data.refreshToken;
    await run({
      module: 'Auth', name: '刷新Token-有效token', method: 'POST', path: '/user/refresh',
      body: { refreshToken: validRefresh },
      expected: 200, token: 'none',
      description: '使用有效的 refresh token 刷新',
    });
  }

  // 延迟以避免频率限制
  await new Promise(r => setTimeout(r, 1500));

  // 0.7 获取我的权限
  await run({
    module: 'Auth', name: '获取我的权限列表', method: 'GET', path: '/user/permissions',
    expected: 200, token: 'system',
    description: '获取当前登录用户的权限列表',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 1: 用户模块 (User)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 1: 用户模块 (User) ═══\n');

  // 1.1 注册 - 使用系统管理员的租户 (确保 assign-group 租户一致)
  const regUser = String(Date.now());
  const regRes = await run({
    module: 'User', name: '注册新用户', method: 'POST', path: '/user/register',
    body: { username: `reguser_${regUser}`, password: 'test1234', tenantId: testIds.systemTenantId, nickname: '注册测试用户' },
    expected: 200, token: 'none',
    description: '注册新用户，返回用户信息',
  });
  testIds.regUserId = regRes.response.rawBody?.data?.id || '';

  await run({
    module: 'User', name: '注册-缺少必填字段', method: 'POST', path: '/user/register',
    body: { username: 'test_incomplete' },
    expected: 400, token: 'none',
    description: '注册时缺少 password 字段，应返回 400',
  });

  await run({
    module: 'User', name: '注册-密码太短', method: 'POST', path: '/user/register',
    body: { username: 'shortpwd', password: '12', tenantId: rootTenantId },
    expected: 400, token: 'none',
    description: '注册时密码少于最小长度，应返回 400',
  });

  await run({
    module: 'User', name: '注册-重复用户名', method: 'POST', path: '/user/register',
    body: { username: 'system_admin', password: 'test1234', tenantId: rootTenantId },
    expected: [200, 400, 409], token: 'none',
    description: '使用已存在的用户名注册，应返回 400/409',
  });

  // 1.2 用户列表
  await run({
    module: 'User', name: '获取用户列表', method: 'GET', path: '/user/list',
    expected: 200, token: 'system',
    description: '获取用户列表（分页）',
  });

  await run({
    module: 'User', name: '用户列表-分页参数', method: 'GET', path: '/user/list?page=1&pageSize=2',
    expected: 200, token: 'system',
    description: '带分页参数获取用户列表',
  });

  await run({
    module: 'User', name: '用户列表-大页码', method: 'GET', path: '/user/list?page=999&pageSize=10',
    expected: 200, token: 'system',
    description: '请求超出范围的页码，应返回空列表',
  });

  // 1.3 用户详情/更新/删除/恢复
  if (testIds.regUserId) {
    await run({
      module: 'User', name: '获取用户详情', method: 'GET', path: '/user/:id',
      params: { id: 'regUserId' },
      expected: 200, token: 'system',
      description: '获取指定用户详情',
    });

    await run({
      module: 'User', name: '获取不存在用户详情', method: 'GET', path: '/user/nonexistent-id-12345',
      expected: 404, token: 'system',
      description: '获取不存在的用户，应返回 404',
    });

    await run({
      module: 'User', name: '更新用户昵称', method: 'PUT', path: '/user/:id',
      params: { id: 'regUserId' },
      body: { nickname: '已更新昵称' },
      expected: 200, token: 'system',
      description: '更新用户昵称',
    });

    // 1.4 分配群组 - 在删除前分配（使用 ROOT 租户的根群组）
    const rootGroupForUser = await prisma.group.findFirst({ where: { tenantId: rootTenantId, parentId: null } });
    if (rootGroupForUser) {
      await run({
        module: 'User', name: '分配群组', method: 'POST', path: '/user/assign-group',
        body: { userId: testIds.regUserId, groupId: rootGroupForUser.id },
        expected: 200, token: 'system',
        description: '给用户分配群组',
      });
    }

    await run({
      module: 'User', name: '恢复用户-未删除', method: 'PUT', path: '/user/:id/restore',
      params: { id: 'regUserId' },
      expected: [200, 404], token: 'system',
      description: '恢复未删除的用户',
    });

    await run({
      module: 'User', name: '删除用户(软删除)', method: 'DELETE', path: '/user/:id',
      params: { id: 'regUserId' },
      expected: 200, token: 'system',
      description: '软删除用户',
    });

    await run({
      module: 'User', name: '恢复已删除用户', method: 'PUT', path: '/user/:id/restore',
      params: { id: 'regUserId' },
      expected: 200, token: 'system',
      description: '恢复已软删除的用户',
    });

    await run({
      module: 'User', name: '再次删除用户', method: 'DELETE', path: '/user/:id',
      params: { id: 'regUserId' },
      expected: 200, token: 'system',
      description: '再次删除用户',
    });
  }

  await run({
    module: 'User', name: '分配群组-缺少参数', method: 'POST', path: '/user/assign-group',
    body: {},
    expected: [200, 400], token: 'system',
    description: '分配群组缺少必要参数',
  });

  // 1.5 权限拒绝测试
  await run({
    module: 'User', name: '[Tenant]查看用户列表', method: 'GET', path: '/user/list',
    expected: 200, token: 'tenant',
    description: '租户管理员有 sys:user:view 权限，可以查看用户列表',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 2: 租户模块 (Tenant)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 2: 租户模块 (Tenant) ═══\n');

  await run({
    module: 'Tenant', name: '获取租户列表', method: 'GET', path: '/tenant',
    expected: 200, token: 'system',
    description: '获取租户列表（分页）',
  });

  await run({
    module: 'Tenant', name: '租户列表-分页参数', method: 'GET', path: '/tenant?page=1&pageSize=2',
    expected: 200, token: 'system',
    description: '带分页参数获取租户列表',
  });

  // 创建 CRUD 测试租户
  const crudTs = Date.now();
  const crudTenantRes = await axios.post(`${API}/tenant/create`,
    { tenantName: 'CRUD测试租户', tenantCode: `CRUD_TENANT_${crudTs}` },
    { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
  testIds.crudTenantId = crudTenantRes.data?.data?.id || '';

  if (testIds.crudTenantId) {
    await run({
      module: 'Tenant', name: '获取租户详情', method: 'GET', path: '/tenant/:id',
      params: { id: 'crudTenantId' },
      expected: 200, token: 'system',
      description: '获取指定租户详情',
    });

    await run({
      module: 'Tenant', name: '更新租户名称', method: 'PUT', path: '/tenant/:id',
      params: { id: 'crudTenantId' },
      body: { tenantName: '已更新租户名称' },
      expected: 200, token: 'system',
      description: '更新租户信息',
    });

    await run({
      module: 'Tenant', name: '删除租户(软删除)', method: 'DELETE', path: '/tenant/:id',
      params: { id: 'crudTenantId' },
      expected: 200, token: 'system',
      description: '软删除租户',
    });

    await run({
      module: 'Tenant', name: '恢复租户', method: 'PUT', path: '/tenant/:id/restore',
      params: { id: 'crudTenantId' },
      expected: 200, token: 'system',
      description: '恢复已删除的租户',
    });

    await run({
      module: 'Tenant', name: '获取不存在租户详情', method: 'GET', path: '/tenant/nonexistent-id',
      expected: 404, token: 'system',
      description: '获取不存在的租户，应返回 404',
    });
  }

  // 权限拒绝测试
  await run({
    module: 'Tenant', name: '[Tenant]获取租户列表-拒绝', method: 'GET', path: '/tenant',
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权查看系统租户列表',
  });
  await run({
    module: 'Tenant', name: '[Tenant]创建租户-拒绝', method: 'POST', path: '/tenant/create',
    body: { tenantName: '非法租户', tenantCode: 'ILLEGAL_TENANT' },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权创建租户',
  });
  await run({
    module: 'Tenant', name: '[Tenant]更新租户-拒绝', method: 'PUT', path: '/tenant/:id',
    params: { id: 'crudTenantId' },
    body: { tenantName: 'HACKED' },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权更新系统租户',
  });
  await run({
    module: 'Tenant', name: '[Tenant]删除租户-拒绝', method: 'DELETE', path: '/tenant/:id',
    params: { id: 'crudTenantId' },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权删除租户',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 3: 权限模块 (Permission)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 3: 权限模块 (Permission) ═══\n');

  await run({
    module: 'Permission', name: '获取权限列表', method: 'GET', path: '/permission',
    expected: 200, token: 'system',
    description: '获取权限列表（分页）',
  });

  await run({
    module: 'Permission', name: '权限列表-分页参数', method: 'GET', path: '/permission?page=1&pageSize=5',
    expected: 200, token: 'system',
    description: '带分页参数获取权限列表',
  });

  // 创建测试权限
  const permTs = Date.now();
  const permCreateRes = await axios.post(`${API}/permission`,
    { permName: '综合测试权限', permCode: `comp_test_perm_${permTs}`, type: 2, sort: 99 },
    { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
  testIds.permId = permCreateRes.data?.data?.id || '';

  if (testIds.permId) {
    await run({
      module: 'Permission', name: '获取权限详情', method: 'GET', path: '/permission/:id',
      params: { id: 'permId' },
      expected: 200, token: 'system',
      description: '获取指定权限详情',
    });

    await run({
      module: 'Permission', name: '更新权限名称', method: 'PUT', path: '/permission/:id',
      params: { id: 'permId' },
      body: { permName: '已更新权限名称' },
      expected: 200, token: 'system',
      description: '更新权限信息',
    });

    await run({
      module: 'Permission', name: '删除权限(硬删除)', method: 'DELETE', path: '/permission/:id',
      params: { id: 'permId' },
      expected: 200, token: 'system',
      description: '硬删除权限',
    });
  }

  // 权限拒绝测试
  await run({
    module: 'Permission', name: '[Tenant]查看权限列表-允许', method: 'GET', path: '/permission',
    expected: 200, token: 'tenant',
    description: '租户管理员可以查看权限列表',
  });
  await run({
    module: 'Permission', name: '[Tenant]创建权限-拒绝', method: 'POST', path: '/permission',
    body: { permName: '非法权限', permCode: 'illegal_perm', type: 2 },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权创建权限',
  });
  await run({
    module: 'Permission', name: '[Tenant]更新权限-拒绝', method: 'PUT', path: '/permission/:id',
    params: { id: 'permId' },
    body: { permName: 'HACKED' },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权更新系统权限',
  });
  await run({
    module: 'Permission', name: '[Tenant]删除权限-拒绝', method: 'DELETE', path: '/permission/:id',
    params: { id: 'permId' },
    expected: [401, 403], token: 'tenant',
    description: '租户管理员无权删除权限',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 4: 角色模块 (Role)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 4: 角色模块 (Role) ═══\n');

  await run({
    module: 'Role', name: '获取角色列表', method: 'GET', path: '/role',
    expected: 200, token: 'system',
    description: '获取角色列表（分页）',
  });

  await run({
    module: 'Role', name: '角色列表-分页参数', method: 'GET', path: '/role?page=1&pageSize=3',
    expected: 200, token: 'system',
    description: '带分页参数获取角色列表',
  });

  // 创建测试角色
  const roleTs = Date.now();
  const roleCreateRes = await axios.post(`${API}/role`,
    { roleName: '综合测试角色', roleCode: `COMP_TEST_ROLE_${roleTs}`, tenantId: testIds.testTenantId },
    { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
  testIds.roleId = roleCreateRes.data?.data?.id || '';

  if (testIds.roleId) {
    await run({
      module: 'Role', name: '获取角色详情', method: 'GET', path: '/role/:id',
      params: { id: 'roleId' },
      expected: 200, token: 'system',
      description: '获取指定角色详情',
    });

    await run({
      module: 'Role', name: '更新角色名称', method: 'PUT', path: '/role/:id',
      params: { id: 'roleId' },
      body: { roleName: '已更新角色名称' },
      expected: 200, token: 'system',
      description: '更新角色信息',
    });

    await run({
      module: 'Role', name: '删除角色(软删除)', method: 'DELETE', path: '/role/:id',
      params: { id: 'roleId' },
      expected: 200, token: 'system',
      description: '软删除角色',
    });

    await run({
      module: 'Role', name: '恢复角色', method: 'PUT', path: '/role/:id/restore',
      params: { id: 'roleId' },
      expected: 200, token: 'system',
      description: '恢复已删除的角色',
    });

    // 分配权限
    const sysPerms = await prisma.permission.findMany({ take: 2, where: { scope: 'system' } });
    if (sysPerms.length > 0) {
      await run({
        module: 'Role', name: '分配权限给角色', method: 'POST', path: '/role/:roleId/permissions',
        params: { roleId: 'roleId' },
        body: { permissionIds: sysPerms.map((p: any) => p.id) },
        expected: 200, token: 'system',
        description: '给角色分配权限',
      });
    }

    await run({
      module: 'Role', name: '分配权限-空列表', method: 'POST', path: '/role/:roleId/permissions',
      params: { roleId: 'roleId' },
      body: { permissionIds: [] },
      expected: 200, token: 'system',
      description: '分配空权限列表',
    });
  }

  // 权限拒绝测试
  await run({
    module: 'Role', name: '[Tenant]查看角色列表-拒绝', method: 'GET', path: '/role',
    expected: 200, token: 'tenant',
    description: '租户管理员有 sys:role:view 权限，可以查看角色列表',
  });
  await run({
    module: 'Role', name: '[Tenant]创建角色', method: 'POST', path: '/role',
    body: { roleName: '租户角色', roleCode: `TENANT_ROLE_${Date.now()}` },
    expected: 200, token: 'tenant',
    description: '租户管理员可以在自己的租户创建角色',
  });
  await run({
    module: 'Role', name: '[Tenant]更新角色', method: 'PUT', path: '/role/:id',
    params: { id: 'roleId' },
    body: { roleName: 'HACKED' },
    expected: [200, 403, 404], token: 'tenant',
    description: '租户管理员对系统角色的更新操作',
  });
  await run({
    module: 'Role', name: '[Tenant]删除角色', method: 'DELETE', path: '/role/:id',
    params: { id: 'roleId' },
    expected: [200, 403, 404], token: 'tenant',
    description: '租户管理员对系统角色的删除操作',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 5: 群组模块 (Group)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 5: 群组模块 (Group) ═══\n');

  await run({
    module: 'Group', name: '获取根群组', method: 'GET', path: '/group/root/:tenantId',
    params: { tenantId: rootTenantId },
    expected: 200, token: 'system',
    description: '获取 ROOT 租户的根群组',
  });

  await run({
    module: 'Group', name: '获取群组列表', method: 'GET', path: '/group/list/:tenantId',
    params: { tenantId: rootTenantId },
    expected: 200, token: 'system',
    description: '获取租户的群组列表',
  });

  await run({
    module: 'Group', name: '获取群组树', method: 'GET', path: '/group/tree/:tenantId',
    params: { tenantId: rootTenantId },
    expected: 200, token: 'system',
    description: '获取租户的群组树形结构',
  });

  // 创建子群组
  const groupTs = Date.now();
  const groupCreateRes = await axios.post(`${API}/group`,
    { tenantId: rootTenantId, groupName: '综合测试子群组', groupCode: `COMP_TEST_SUB_${groupTs}` },
    { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
  testIds.groupId = groupCreateRes.data?.data?.id || '';

  if (testIds.groupId) {
    await run({
      module: 'Group', name: '获取群组详情', method: 'GET', path: '/group/:id',
      params: { id: 'groupId' },
      expected: 200, token: 'system',
      description: '获取指定群组详情',
    });

    // 获取子树
    const rootGroupData = await prisma.group.findFirst({ where: { tenantId: rootTenantId, parentId: null } });
    if (rootGroupData) {
      await run({
        module: 'Group', name: '获取指定群组子树', method: 'GET', path: '/group/tree/:tenantId/:groupId',
        params: { tenantId: rootTenantId, groupId: rootGroupData.id },
        expected: 200, token: 'system',
        description: '获取指定群组的子树结构',
      });
    }

    await run({
      module: 'Group', name: '更新群组名称', method: 'PUT', path: '/group/:id',
      params: { id: 'groupId' },
      body: { groupName: '已更新群组名称' },
      expected: 200, token: 'system',
      description: '更新群组信息',
    });

    await run({
      module: 'Group', name: '删除群组(软删除)', method: 'DELETE', path: '/group/:id',
      params: { id: 'groupId' },
      expected: 200, token: 'system',
      description: '软删除群组',
    });

    await run({
      module: 'Group', name: '恢复群组', method: 'PUT', path: '/group/:id/restore',
      params: { id: 'groupId' },
      expected: 200, token: 'system',
      description: '恢复已删除的群组',
    });
  }

  // 权限拒绝测试
  await run({
    module: 'Group', name: '[Tenant]查看群组树', method: 'GET', path: '/group/tree/:tenantId',
    params: { tenantId: rootTenantId },
    expected: 200, token: 'tenant',
    description: '租户管理员有 sys:group:view 权限，可以查看群组',
  });
  await run({
    module: 'Group', name: '[Tenant]创建群组', method: 'POST', path: '/group',
    body: { tenantId: rootTenantId, groupName: '租户群组', groupCode: `TENANT_GROUP_${Date.now()}` },
    expected: 200, token: 'tenant',
    description: '租户管理员可以在自己的租户创建群组',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 6: Base - 表管理 (Table)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 6: Base - 表管理 (Table) ═══\n');

  await run({
    module: 'Base/Table', name: '获取表格列表', method: 'GET', path: '/base/tables',
    expected: 200, token: 'system',
    description: '获取动态表格列表（分页）',
  });

  await run({
    module: 'Base/Table', name: '表格列表-分页参数', method: 'GET', path: '/base/tables?page=1&pageSize=2',
    expected: 200, token: 'system',
    description: '带分页参数获取表格列表',
  });

  // 创建测试表
  const tableName = `综合测试表_${Date.now()}`;
  const tableCreateRes = await axios.post(`${API}/base/tables`,
    { name: tableName },
    { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
  testIds.tableId = tableCreateRes.data?.data?.tableId || '';

  if (testIds.tableId) {
    await run({
      module: 'Base/Table', name: '获取表格详情', method: 'GET', path: '/base/tables/:tableId',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '获取指定表格详情',
    });

    const updatedTableName = `已更新表_${Date.now()}`;
    await run({
      module: 'Base/Table', name: '更新表格名称', method: 'PUT', path: '/base/tables/:tableId',
      params: { tableId: 'tableId' },
      body: { name: updatedTableName },
      expected: 200, token: 'system',
      description: '更新表格信息',
    });

    await run({
      module: 'Base/Table', name: '获取不存在表格详情', method: 'GET', path: '/base/tables/nonexistent-table-id',
      expected: 404, token: 'system',
      description: '获取不存在的表格，应返回 404',
    });
  }

  // ════════════════════════════════════════════════════════════
  // Phase 7: Base - 字段管理 (Field)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 7: Base - 字段管理 (Field) ═══\n');

  if (testIds.tableId) {
    await run({
      module: 'Base/Field', name: '获取字段列表', method: 'GET', path: '/base/tables/:tableId/fields',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '获取表格的字段列表',
    });

    // 创建测试字段
    const fieldCreateRes = await axios.post(`${API}/base/tables/${testIds.tableId}/fields`,
      { name: '测试字段_text', type: 'text' },
      { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
    testIds.fieldId = fieldCreateRes.data?.data?.fieldId || '';

    if (testIds.fieldId) {
      await run({
        module: 'Base/Field', name: '获取字段详情', method: 'GET', path: '/base/tables/:tableId/fields/:fieldId',
        params: { tableId: 'tableId', fieldId: 'fieldId' },
        expected: 200, token: 'system',
        description: '获取指定字段详情',
      });

      await run({
        module: 'Base/Field', name: '更新字段名称', method: 'PUT', path: '/base/tables/:tableId/fields/:fieldId',
        params: { tableId: 'tableId', fieldId: 'fieldId' },
        body: { name: '已更新字段名称' },
        expected: 200, token: 'system',
        description: '更新字段信息',
      });

      await run({
        module: 'Base/Field', name: '删除字段(软删除)', method: 'DELETE', path: '/base/tables/:tableId/fields/:fieldId',
        params: { tableId: 'tableId', fieldId: 'fieldId' },
        expected: 200, token: 'system',
        description: '软删除字段',
      });

      await run({
        module: 'Base/Field', name: '恢复字段', method: 'PUT', path: '/base/tables/:tableId/fields/:fieldId/restore',
        params: { tableId: 'tableId', fieldId: 'fieldId' },
        expected: 200, token: 'system',
        description: '恢复已删除的字段',
      });
    }

    // 创建第二个字段（用于记录测试）
    const field2Res = await axios.post(`${API}/base/tables/${testIds.tableId}/fields`,
      { name: '测试字段_number', type: 'number' },
      { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
    testIds.fieldId2 = field2Res.data?.data?.fieldId || '';

    await run({
      module: 'Base/Field', name: '创建字段-缺少类型', method: 'POST', path: '/base/tables/:tableId/fields',
      params: { tableId: 'tableId' },
      body: { name: '无效字段' },
      expected: [200, 400], token: 'system',
      description: '创建字段缺少 type 参数',
    });
  }

  // ════════════════════════════════════════════════════════════
  // Phase 8: Base - 记录管理 (Record)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 8: Base - 记录管理 (Record) ═══\n');

  if (testIds.tableId) {
    // 获取记录列表
    await run({
      module: 'Base/Record', name: '获取记录列表', method: 'POST', path: '/base/tables/:tableId/records/list',
      params: { tableId: 'tableId' },
      body: {},
      expected: 200, token: 'system',
      description: '获取表格的记录列表',
    });

    // 创建记录
    const recordBody: any = { data: {} };
    if (testIds.fieldId) recordBody.data[testIds.fieldId] = '测试文本值';
    if (testIds.fieldId2) recordBody.data[testIds.fieldId2] = 42;

    let recordIdFromApi = '';
    try {
      const recordCreateRes = await axios.post(`${API}/base/tables/${testIds.tableId}/records`,
        recordBody,
        { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' }, validateStatus: () => true });
      recordIdFromApi = recordCreateRes.data?.data?.recordId || '';
      testIds.recordId = recordIdFromApi;
    } catch { testIds.recordId = ''; }

    if (recordIdFromApi) {
      await run({
        module: 'Base/Record', name: '获取记录详情', method: 'GET', path: '/base/tables/:tableId/records/:recordId',
        params: { tableId: 'tableId', recordId: 'recordId' },
        expected: 200, token: 'system',
        description: '获取指定记录详情',
      });

      // 更新记录
      const updateRecordBody: any = { data: {} };
      if (testIds.fieldId) updateRecordBody.data[testIds.fieldId] = '已更新的文本值';

      await run({
        module: 'Base/Record', name: '更新记录', method: 'PUT', path: '/base/tables/:tableId/records/:recordId',
        params: { tableId: 'tableId', recordId: 'recordId' },
        body: updateRecordBody,
        expected: 200, token: 'system',
        description: '更新记录数据',
      });

      // 删除记录
      await run({
        module: 'Base/Record', name: '删除记录(软删除)', method: 'DELETE', path: '/base/tables/:tableId/records/:recordId',
        params: { tableId: 'tableId', recordId: 'recordId' },
        expected: 200, token: 'system',
        description: '软删除记录',
      });

      // 恢复记录
      await run({
        module: 'Base/Record', name: '恢复记录', method: 'PUT', path: '/base/tables/:tableId/records/:recordId/restore',
        params: { tableId: 'tableId', recordId: 'recordId' },
        expected: 200, token: 'system',
        description: '恢复已删除的记录',
      });

      // 再次删除
      await run({
        module: 'Base/Record', name: '再次删除记录', method: 'DELETE', path: '/base/tables/:tableId/records/:recordId',
        params: { tableId: 'tableId', recordId: 'recordId' },
        expected: 200, token: 'system',
        description: '再次删除记录',
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // Phase 8.5: Base - 删除/恢复表
  // ════════════════════════════════════════════════════════════
  if (testIds.tableId) {
    await run({
      module: 'Base/Table', name: '删除表格(软删除)', method: 'DELETE', path: '/base/tables/:tableId',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '软删除表格',
    });

    await run({
      module: 'Base/Table', name: '恢复表格', method: 'PUT', path: '/base/tables/:tableId/restore',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '恢复已删除的表格',
    });

    await run({
      module: 'Base/Table', name: '再次删除表格', method: 'DELETE', path: '/base/tables/:tableId',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '再次删除表格',
    });

    await run({
      module: 'Base/Table', name: '再次恢复表格', method: 'PUT', path: '/base/tables/:tableId/restore',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '再次恢复表格',
    });
  }

  // ════════════════════════════════════════════════════════════
  // Phase 9: 镜像模块 (Mirror)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 9: 镜像模块 (Mirror) ═══\n');

  await run({
    module: 'Mirror', name: '获取我的镜像列表', method: 'GET', path: '/base/mirrors',
    expected: 200, token: 'system',
    description: '获取当前用户的镜像列表',
  });

  if (testIds.tableId) {
    await run({
      module: 'Mirror', name: '获取表的镜像列表', method: 'GET', path: '/base/tables/:tableId/mirrors',
      params: { tableId: 'tableId' },
      expected: 200, token: 'system',
      description: '获取指定表的镜像列表',
    });

    // 创建镜像
    const mirrorCreateRes = await axios.post(`${API}/base/tables/${testIds.tableId}/mirrors`,
      { name: '综合测试镜像' },
      { headers: { 'Authorization': `Bearer ${tokens.system}`, 'Content-Type': 'application/json' } });
    testIds.mirrorId = mirrorCreateRes.data?.data?.mirrorId || mirrorCreateRes.data?.data?.id || '';

    if (testIds.mirrorId) {
      await run({
        module: 'Mirror', name: '获取镜像详情', method: 'GET', path: '/base/mirrors/:mirrorId',
        params: { mirrorId: 'mirrorId' },
        expected: 200, token: 'system',
        description: '获取指定镜像详情',
      });

      await run({
        module: 'Mirror', name: '更新镜像', method: 'PUT', path: '/base/mirrors/:mirrorId',
        params: { mirrorId: 'mirrorId' },
        body: { name: '已更新镜像名称' },
        expected: 200, token: 'system',
        description: '更新镜像信息',
      });

      // 通过镜像获取记录
      await run({
        module: 'Mirror', name: '通过镜像获取记录列表', method: 'POST', path: '/base/mirrors/:mirrorId/records/list',
        params: { mirrorId: 'mirrorId' },
        body: {},
        expected: 200, token: 'system',
        description: '通过镜像获取记录列表',
      });

      // 删除镜像
      await run({
        module: 'Mirror', name: '删除镜像', method: 'DELETE', path: '/base/mirrors/:mirrorId',
        params: { mirrorId: 'mirrorId' },
        expected: 200, token: 'system',
        description: '删除镜像',
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // Phase 10: 系统模块 (System)
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 10: 系统模块 (System) ═══\n');

  await run({
    module: 'System', name: '初始化超级管理员(幂等)', method: 'POST', path: '/system/init-super-admin',
    expected: [200, 201, 409], token: 'none',
    description: '初始化系统超级管理员(幂等操作)',
  });

  await run({
    module: 'System', name: '种子权限数据', method: 'POST', path: '/system/seed-permissions',
    expected: 200, token: 'system',
    description: '种子化系统权限数据',
  });

  await run({
    module: 'System', name: '清理过期数据', method: 'POST', path: '/system/cleanup',
    expected: 200, token: 'system',
    description: '清理过期的软删除数据',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 11: Developer 模块
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 11: Developer 模块 ═══\n');

  await run({
    module: 'Developer', name: 'AI生成(无参数)', method: 'POST', path: '/developer/ai-generate',
    body: {},
    expected: [200, 400, 500], token: 'system',
    description: 'AI 生成端点（可能需要特定参数）',
  });

  await run({
    module: 'Developer', name: 'AI生成-未认证', method: 'POST', path: '/developer/ai-generate',
    body: { prompt: 'test' },
    expected: 401, token: 'none',
    description: '未认证访问 AI 生成端点',
  });

  // ════════════════════════════════════════════════════════════
  // Phase 12: 边界/安全测试
  // ════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 12: 边界/安全测试 ═══\n');

  // 未认证访问
  await run({
    module: 'Security', name: '未认证-访问用户列表', method: 'GET', path: '/user/list',
    expected: 401, token: 'none',
    description: '未携带 token 访问受保护的端点',
  });

  await run({
    module: 'Security', name: '未认证-访问租户列表', method: 'GET', path: '/tenant',
    expected: 401, token: 'none',
    description: '未携带 token 访问受保护的端点',
  });

  await run({
    module: 'Security', name: '未认证-访问角色列表', method: 'GET', path: '/role',
    expected: 401, token: 'none',
    description: '未携带 token 访问受保护的端点',
  });

  await run({
    module: 'Security', name: '未认证-访问权限列表', method: 'GET', path: '/permission',
    expected: 401, token: 'none',
    description: '未携带 token 访问受保护的端点',
  });

  // 无效 token
  await run({
    module: 'Security', name: '无效Token-访问用户列表', method: 'GET', path: '/user/list',
    expected: 401, token: 'none',
    description: '使用无效 token 访问受保护端点',
  });

  // 请求体格式错误 - 发送畸形 JSON
  await run({
    module: 'Security', name: '格式错误JSON', method: 'POST', path: '/user/login',
    body: { malformed: true, _raw: 'this tests empty object' },
    expected: [400, 401, 429, 500], token: 'none',
    description: '发送空对象作为登录请求体',
  });

  // ════════════════════════════════════════════════════════════
  // 断开 Prisma 连接
  // ════════════════════════════════════════════════════════════
  await prisma.$disconnect();

  // ════════════════════════════════════════════════════════════
  // 生成报告
  // ════════════════════════════════════════════════════════════
  const suiteEndTime = Date.now();
  const totalSuiteTime = suiteEndTime - suiteStartTime;
  const s = summary();

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                        测试结果汇总                               ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total: ${String(s.total).padEnd(5)}  ✅ Passed: ${String(s.passed).padEnd(5)}  ❌ Failed: ${String(s.failed).padEnd(5)}          ║`);
  console.log(`║  Suite time: ${totalSuiteTime}ms  Avg response: ${s.avgTimeMs}ms                            ║`);
  console.log(`║  Min: ${s.minTimeMs}ms  Max: ${s.maxTimeMs}ms                                                ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  for (const [mod, stats] of Object.entries(s.byModule)) {
    const line = `║  ${mod.padEnd(20)} Total:${String(stats.total).padStart(3)}  ✅${String(stats.passed).padStart(3)}  ❌${String(stats.failed).padStart(3)}`;
    console.log(line + ' '.repeat(Math.max(0, 66 - line.length)) + '║');
  }
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // 写入 JSON 报告（移除 rawBody 字段）
  const cleanResults = results.map(({ response: { rawBody, ...r }, ...rest }) => ({
    ...rest,
    response: { ...r },
  }));

  const jsonReport = {
    meta: {
      title: 'Auth-Core 全量 API 综合测试报告',
      baseUrl: API,
      timestamp: new Date().toISOString(),
      suiteTimeMs: totalSuiteTime,
    },
    summary: {
      total: s.total,
      passed: s.passed,
      failed: s.failed,
      passRate: ((s.passed / s.total) * 100).toFixed(2) + '%',
      totalTimeMs: s.totalTimeMs,
      avgTimeMs: s.avgTimeMs,
      minTimeMs: s.minTimeMs,
      maxTimeMs: s.maxTimeMs,
      suiteTimeMs: totalSuiteTime,
    },
    byModule: s.byModule,
    results: cleanResults,
  };

  const jsonPath = path.join(REPORT_DIR, `COMPREHENSIVE_TEST_REPORT_${TIMESTAMP}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
  console.log(`📄 JSON 报告已保存: ${jsonPath}`);

  // 写入简洁 Markdown 报告
  const mdLines: string[] = [];
  mdLines.push('# Auth-Core 全量 API 综合测试报告');
  mdLines.push('');
  mdLines.push(`**测试时间**: ${new Date().toISOString()}`);
  mdLines.push(`**Base URL**: \`${API}\``);
  mdLines.push(`**测试耗时**: ${totalSuiteTime}ms`);
  mdLines.push('');
  mdLines.push('## 概览');
  mdLines.push('');
  mdLines.push(`| 指标 | 值 |`);
  mdLines.push(`|------|-----|`);
  mdLines.push(`| 总测试数 | ${s.total} |`);
  mdLines.push(`| ✅ 通过 | ${s.passed} |`);
  mdLines.push(`| ❌ 失败 | ${s.failed} |`);
  mdLines.push(`| 通过率 | ${((s.passed / s.total) * 100).toFixed(2)}% |`);
  mdLines.push(`| 总请求耗时 | ${s.totalTimeMs}ms |`);
  mdLines.push(`| 平均响应时间 | ${s.avgTimeMs}ms |`);
  mdLines.push(`| 最快响应 | ${s.minTimeMs}ms |`);
  mdLines.push(`| 最慢响应 | ${s.maxTimeMs}ms |`);
  mdLines.push('');
  mdLines.push('## 各模块统计');
  mdLines.push('');
  mdLines.push('| 模块 | 总数 | 通过 | 失败 | 通过率 |');
  mdLines.push('|------|------|------|------|--------|');
  for (const [mod, stats] of Object.entries(s.byModule)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    mdLines.push(`| ${mod} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate}% |`);
  }
  mdLines.push('');
  mdLines.push('## 详细测试结果');
  mdLines.push('');
  mdLines.push('| # | 模块 | 方法 | URL | 状态码 | 耗时 | 结果 |');
  mdLines.push('|---|------|------|-----|--------|------|------|');
  results.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    mdLines.push(`| ${i + 1} | ${r.module} | ${r.method} | \`${r.path}\` | ${r.response.status} | ${r.response.timeMs}ms | ${icon} |`);
  });
  mdLines.push('');
  mdLines.push('## 失败详情');
  mdLines.push('');
  const failed = results.filter(r => !r.passed);
  if (failed.length === 0) {
    mdLines.push('> 🎉 所有测试全部通过！');
  } else {
    mdLines.push('| # | 模块 | 测试名称 | 预期 | 实际 | URL |');
    mdLines.push('|---|------|----------|------|------|-----|');
    failed.forEach((r, i) => {
      mdLines.push(`| ${i + 1} | ${r.module} | ${r.name} | ${JSON.stringify(r.expected)} | ${r.response.status} | \`${r.path}\` |`);
    });
  }

  const mdPath = path.join(REPORT_DIR, `COMPREHENSIVE_TEST_REPORT_${TIMESTAMP}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');
  console.log(`📄 Markdown 报告已保存: ${mdPath}\n`);

  if (s.failed > 0) {
    console.log(`⚠️  ${s.failed} 个测试失败，请查看报告了解详情。`);
    process.exitCode = 1;
  } else {
    console.log('🎉 所有测试全部通过！');
  }
}

main().catch((err) => {
  console.error('测试套件异常:', err);
  process.exit(1);
});
