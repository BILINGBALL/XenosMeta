/**
 * 功能测试：System Admin vs Tenant Admin 权限边界
 *
 * 1. System Admin: tenant CRUD + permission CRUD（完全控制权）
 * 2. Tenant Admin: tenant 名下所有功能，但除了：
 *    - tenant 的增删改查（完全不能操作）
 *    - permission 的增删改（只允许 view）
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:3001/api';
const prisma = new PrismaClient();

interface TestResult {
    name: string;
    endpoint: string;
    expected: 'SUCCESS' | 'FORBIDDEN';
    actual: 'PASS' | 'FAIL';
    status: number;
    message: string;
}

const results: TestResult[] = [];
let systemAdminToken = '';
let tenantAdminToken = '';
let testTenantId = '';
let testPermissionId = '';

function record(name: string, endpoint: string, expected: 'SUCCESS' | 'FORBIDDEN', res: any, error?: any): void {
    const status = error?.response?.status || res?.status || 500;
    const body = error?.response?.data || res?.data || {};
    const actualCode = status;

    let actual: 'PASS' | 'FAIL';
    if (expected === 'SUCCESS') {
        actual = (actualCode >= 200 && actualCode < 300) ? 'PASS' : 'FAIL';
    } else {
        actual = (actualCode === 403 || actualCode === 401) ? 'PASS' : 'FAIL';
    }

    results.push({
        name,
        endpoint,
        expected,
        actual,
        status: actualCode,
        message: body.message || (error ? error.message : 'ok'),
    });

    const icon = actual === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} [${expected}] ${name} → HTTP ${actualCode} ${body.message || ''}`);
}

// =============================================
// Phase 0: 创建测试租户和租户管理员
// =============================================
async function setupTestTenant() {
    console.log('\n═══ Phase 0: 创建测试数据 ═══\n');

    // 创建 normal 租户（id 由 Prisma @default(uuid()) 自动生成）
    const tenant = await prisma.tenant.upsert({
        where: { tenantCode: 'TEST_TENANT' },
        update: {},
        create: {
            tenantName: '测试租户',
            tenantCode: 'TEST_TENANT',
            type: 'normal',
            status: true,
        },
    });
    testTenantId = tenant.id;

    // 创建根组
    await prisma.group.upsert({
        where: { id: 'TEST_GROUP' },
        update: {},
        create: {
            id: 'TEST_GROUP',
            groupName: '测试根组',
            groupCode: 'ROOT_TEST_TENANT',
            tenantId: tenant.id,
            parentId: null,
            status: true,
        },
    });

    // 创建 tenant_admin 角色
    const hashedPwd = await bcrypt.hash('test123', 10);

    const tenantAdminRole = await prisma.role.upsert({
        where: { roleCode: 'TENANT_ADMIN' },
        update: { scope: 'tenant', tenantId: tenant.id },
        create: {
            roleName: '租户管理员',
            roleCode: 'TENANT_ADMIN',
            scope: 'tenant',
            tenantId: tenant.id,
            status: true,
        },
    });

    // 分配所有租户级权限给 tenant_admin（排除 system scope 的 tenant 和 permission 管理权）
    const tenantPerms = await prisma.permission.findMany({
        where: {
            scope: 'tenant',
        },
    });

    for (const perm of tenantPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: tenantAdminRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: tenantAdminRole.id, permissionId: perm.id },
        });
    }

    console.log(`  ✅ 分配 ${tenantPerms.length} 个租户级权限给 TENANT_ADMIN`);

    // 创建租户管理员用户
    const tenantAdminUser = await prisma.user.upsert({
        where: { username: 'tenant_admin' },
        update: { password: hashedPwd, tenantId: tenant.id },
        create: {
            username: 'tenant_admin',
            password: hashedPwd,
            nickname: '租户管理员',
            tenantId: tenant.id,
            status: true,
        },
    });

    // 分配角色和群组
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: tenantAdminUser.id, roleId: tenantAdminRole.id } },
        update: {},
        create: { userId: tenantAdminUser.id, roleId: tenantAdminRole.id },
    });

    await prisma.userGroup.upsert({
        where: { userId_groupId: { userId: tenantAdminUser.id, groupId: 'TEST_GROUP' } },
        update: {},
        create: { userId: tenantAdminUser.id, groupId: 'TEST_GROUP' },
    });

    console.log(`  ✅ 租户管理员创建完成: tenant_admin / test123 (tenant: ${tenant.id})`);
}

// =============================================
// Phase 1: System Admin 登录
// =============================================
async function phase1_SystemAdminLogin() {
    console.log('\n═══ Phase 1: System Admin 登录 ═══\n');

    const res = await axios.post(`${API_BASE}/user/login`, {
        username: 'system_admin',
        password: 'admin123',
    });

    if (!res.data.success) throw new Error('System admin login failed');
    systemAdminToken = res.data.data.accessToken;
    console.log(`  ✅ System Admin 登录成功`);
    console.log(`     AccessToken: ${systemAdminToken.substring(0, 30)}...`);
    console.log(`     RefreshToken: ${res.data.data.refreshToken.substring(0, 30)}...`);
    console.log(`     User: ${res.data.data.username} (${res.data.data.id})`);
}

// =============================================
// Phase 2: Tenant Admin 登录
// =============================================
async function phase2_TenantAdminLogin() {
    console.log('\n═══ Phase 2: Tenant Admin 登录 ═══\n');

    const res = await axios.post(`${API_BASE}/user/login`, {
        username: 'tenant_admin',
        password: 'test123',
    });

    if (!res.data.success) throw new Error('Tenant admin login failed');
    tenantAdminToken = res.data.data.accessToken;
    console.log(`  ✅ Tenant Admin 登录成功`);
    console.log(`     AccessToken: ${tenantAdminToken.substring(0, 30)}...`);
    console.log(`     User: ${res.data.data.username} (${res.data.data.id})`);
}

// =============================================
// Phase 3: System Admin → Tenant CRUD
// =============================================
async function phase3_SystemAdminTenantCRUD() {
    console.log('\n═══ Phase 3: System Admin → Tenant 增删改查 ═══\n');
    const H = { Authorization: `Bearer ${systemAdminToken}` };

    // 3.1 创建租户
    let crudTenantId = '';
    console.log('--- 3.1 创建租户 ---');
    try {
        const res = await axios.post(`${API_BASE}/tenant/create`, {
            tenantName: 'CRUD测试租户',
            tenantCode: 'TEST_CRUD',
            type: 'normal',
        }, { headers: H });
        crudTenantId = res.data.data?.id || '';
        record('创建租户', 'POST /tenant/create', 'SUCCESS', res);
    } catch (e: any) { record('创建租户', 'POST /tenant/create', 'SUCCESS', null, e); }

    // 3.2 查看租户列表
    console.log('--- 3.2 查看租户列表 ---');
    try {
        const res = await axios.get(`${API_BASE}/tenant`, { headers: H });
        record('查看租户列表', 'GET /tenant', 'SUCCESS', res);
    } catch (e: any) { record('查看租户列表', 'GET /tenant', 'SUCCESS', null, e); }

    // 3.3 查看租户详情
    console.log('--- 3.3 查看租户详情 ---');
    try {
        const res = await axios.get(`${API_BASE}/tenant/${crudTenantId}`, { headers: H });
        record('查看租户详情', 'GET /tenant/:id', 'SUCCESS', res);
    } catch (e: any) { record('查看租户详情', 'GET /tenant/:id', 'SUCCESS', null, e); }

    // 3.4 更新租户
    console.log('--- 3.4 更新租户 ---');
    try {
        const res = await axios.put(`${API_BASE}/tenant/${crudTenantId}`, {
            tenantName: 'CRUD测试租户(已更新)',
        }, { headers: H });
        record('更新租户', 'PUT /tenant/:id', 'SUCCESS', res);
    } catch (e: any) { record('更新租户', 'PUT /tenant/:id', 'SUCCESS', null, e); }

    // 3.5 删除租户
    console.log('--- 3.5 删除租户 ---');
    try {
        const res = await axios.delete(`${API_BASE}/tenant/${crudTenantId}`, { headers: H });
        record('删除租户', 'DELETE /tenant/:id', 'SUCCESS', res);
    } catch (e: any) { record('删除租户', 'DELETE /tenant/:id', 'SUCCESS', null, e); }
}

// =============================================
// Phase 4: System Admin → Permission CRUD
// =============================================
async function phase4_SystemAdminPermissionCRUD() {
    console.log('\n═══ Phase 4: System Admin → Permission 增删改查 ═══\n');
    const H = { Authorization: `Bearer ${systemAdminToken}` };

    // 4.1 创建权限
    console.log('--- 4.1 创建权限 ---');
    try {
        const res = await axios.post(`${API_BASE}/permission`, {
            permName: '测试权限',
            permCode: 'test:crud:perm',
            type: 2,
            sort: 100,
        }, { headers: H });
        if (res.data.data?.id) testPermissionId = res.data.data.id;
        record('创建权限', 'POST /permission', 'SUCCESS', res);
    } catch (e: any) { record('创建权限', 'POST /permission', 'SUCCESS', null, e); }

    // 4.2 查看权限列表
    console.log('--- 4.2 查看权限列表 ---');
    try {
        const res = await axios.get(`${API_BASE}/permission`, { headers: H });
        record('查看权限列表', 'GET /permission', 'SUCCESS', res);
    } catch (e: any) { record('查看权限列表', 'GET /permission', 'SUCCESS', null, e); }

    // 4.3 查看权限详情
    console.log('--- 4.3 查看权限详情 ---');
    try {
        const res = await axios.get(`${API_BASE}/permission/${testPermissionId || 'temp'}`, { headers: H });
        record('查看权限详情', 'GET /permission/:id', 'SUCCESS', res);
    } catch (e: any) { record('查看权限详情', 'GET /permission/:id', 'SUCCESS', null, e); }

    // 4.4 更新权限
    console.log('--- 4.4 更新权限 ---');
    try {
        const res = await axios.put(`${API_BASE}/permission/${testPermissionId || 'temp'}`, {
            permName: '测试权限(已更新)',
        }, { headers: H });
        record('更新权限', 'PUT /permission/:id', 'SUCCESS', res);
    } catch (e: any) { record('更新权限', 'PUT /permission/:id', 'SUCCESS', null, e); }

    // 4.5 删除权限
    console.log('--- 4.5 删除权限 ---');
    try {
        const res = await axios.delete(`${API_BASE}/permission/${testPermissionId || 'temp'}`, { headers: H });
        record('删除权限', 'DELETE /permission/:id', 'SUCCESS', res);
    } catch (e: any) { record('删除权限', 'DELETE /permission/:id', 'SUCCESS', null, e); }
}

// =============================================
// Phase 5: Tenant Admin → 应被拒绝的操作
// =============================================
async function phase5_TenantAdminDenied() {
    console.log('\n═══ Phase 5: Tenant Admin → Tenant CRUD（应全部拒绝） ═══\n');
    const H = { Authorization: `Bearer ${tenantAdminToken}` };

    // 5.1 创建租户 → 应被拒绝
    console.log('--- 5.1 创建租户（应被拒） ---');
    try {
        const res = await axios.post(`${API_BASE}/tenant/create`, {
            id: 'ILLEGAL_TENANT',
            tenantName: '非法租户',
            tenantCode: 'ILLEGAL',
        }, { headers: H });
        record('创建租户', 'POST /tenant/create', 'FORBIDDEN', res);
    } catch (e: any) { record('创建租户', 'POST /tenant/create', 'FORBIDDEN', null, e); }

    // 5.2 查看租户列表 → 应被拒绝
    console.log('--- 5.2 查看租户列表（应被拒） ---');
    try {
        const res = await axios.get(`${API_BASE}/tenant`, { headers: H });
        record('查看租户列表', 'GET /tenant', 'FORBIDDEN', res);
    } catch (e: any) { record('查看租户列表', 'GET /tenant', 'FORBIDDEN', null, e); }

    // 5.3 查看租户详情 → 应被拒绝
    console.log('--- 5.3 查看租户详情（应被拒） ---');
    try {
        const res = await axios.get(`${API_BASE}/tenant/${testTenantId}`, { headers: H });
        record('查看租户详情', 'GET /tenant/:id', 'FORBIDDEN', res);
    } catch (e: any) { record('查看租户详情', 'GET /tenant/:id', 'FORBIDDEN', null, e); }

    // 5.4 更新租户 → 应被拒绝
    console.log('--- 5.4 更新租户（应被拒） ---');
    try {
        const res = await axios.put(`${API_BASE}/tenant/${testTenantId}`, {
            tenantName: 'HACKED',
        }, { headers: H });
        record('更新租户', 'PUT /tenant/:id', 'FORBIDDEN', res);
    } catch (e: any) { record('更新租户', 'PUT /tenant/:id', 'FORBIDDEN', null, e); }

    // 5.5 删除租户 → 应被拒绝
    console.log('--- 5.5 删除租户（应被拒） ---');
    try {
        const res = await axios.delete(`${API_BASE}/tenant/${testTenantId}`, { headers: H });
        record('删除租户', 'DELETE /tenant/:id', 'FORBIDDEN', res);
    } catch (e: any) { record('删除租户', 'DELETE /tenant/:id', 'FORBIDDEN', null, e); }
}

// =============================================
// Phase 6: Tenant Admin → Permission（只允许 view，拒绝 CUD）
// =============================================
async function phase6_TenantAdminPermissions() {
    console.log('\n═══ Phase 6: Tenant Admin → Permission（只允许查看） ═══\n');
    const H = { Authorization: `Bearer ${tenantAdminToken}` };

    // 6.1 查看权限列表 → 应成功
    console.log('--- 6.1 查看权限列表（应允许） ---');
    try {
        const res = await axios.get(`${API_BASE}/permission`, { headers: H });
        record('查看权限列表', 'GET /permission', 'SUCCESS', res);
    } catch (e: any) { record('查看权限列表', 'GET /permission', 'SUCCESS', null, e); }

    // 6.2 创建权限 → 应被拒绝
    console.log('--- 6.2 创建权限（应被拒） ---');
    try {
        const res = await axios.post(`${API_BASE}/permission`, {
            permName: 'HACK_PERM',
            permCode: 'hack:perm',
        }, { headers: H });
        record('创建权限', 'POST /permission', 'FORBIDDEN', res);
    } catch (e: any) { record('创建权限', 'POST /permission', 'FORBIDDEN', null, e); }

    // 6.3 更新权限 → 应被拒绝
    console.log('--- 6.3 更新权限（应被拒） ---');
    try {
        const res = await axios.put(`${API_BASE}/permission/some-id`, {
            permName: 'HACKED',
        }, { headers: H });
        record('更新权限', 'PUT /permission/:id', 'FORBIDDEN', res);
    } catch (e: any) { record('更新权限', 'PUT /permission/:id', 'FORBIDDEN', null, e); }

    // 6.4 删除权限 → 应被拒绝
    console.log('--- 6.4 删除权限（应被拒） ---');
    try {
        const res = await axios.delete(`${API_BASE}/permission/some-id`, { headers: H });
        record('删除权限', 'DELETE /permission/:id', 'FORBIDDEN', res);
    } catch (e: any) { record('删除权限', 'DELETE /permission/:id', 'FORBIDDEN', null, e); }
}

// =============================================
// Phase 7: Tenant Admin → 租户级功能（应全部成功）
// =============================================
async function phase7_TenantAdminCRUD() {
    console.log('\n═══ Phase 7: Tenant Admin → 租户级功能（用户/角色/群组 增删改查） ═══\n');
    const H = { Authorization: `Bearer ${tenantAdminToken}` };
    let testUserId = '';
    let testRoleId = '';
    let testGroupId = '';

    // --- User CRUD ---
    console.log('--- 7.1 用户管理 ---');
    try {
        const res = await axios.post(`${API_BASE}/user/register`, {
            username: `test_user_${Date.now()}`,
            password: 'test1234',
            nickname: '测试用户',
            tenantId: testTenantId,
        }, { headers: H });
        testUserId = res.data.data?.id;
        record('创建用户', 'POST /user/register', 'SUCCESS', res);
    } catch (e: any) { record('创建用户', 'POST /user/register', 'SUCCESS', null, e); }

    try {
        const res = await axios.get(`${API_BASE}/user/list`, { headers: H });
        record('查看用户列表', 'GET /user/list', 'SUCCESS', res);
    } catch (e: any) { record('查看用户列表', 'GET /user/list', 'SUCCESS', null, e); }

    if (testUserId) {
        try {
            const res = await axios.get(`${API_BASE}/user/${testUserId}`, { headers: H });
            record('查看用户详情', 'GET /user/:id', 'SUCCESS', res);
        } catch (e: any) { record('查看用户详情', 'GET /user/:id', 'SUCCESS', null, e); }

        try {
            const res = await axios.put(`${API_BASE}/user/${testUserId}`, {
                nickname: '已更新昵称',
            }, { headers: H });
            record('更新用户', 'PUT /user/:id', 'SUCCESS', res);
        } catch (e: any) { record('更新用户', 'PUT /user/:id', 'SUCCESS', null, e); }

        try {
            const res = await axios.delete(`${API_BASE}/user/${testUserId}`, { headers: H });
            record('删除用户', 'DELETE /user/:id', 'SUCCESS', res);
        } catch (e: any) { record('删除用户', 'DELETE /user/:id', 'SUCCESS', null, e); }
    }

    // --- Role CRUD ---
    console.log('--- 7.2 角色管理 ---');
    try {
        const res = await axios.post(`${API_BASE}/role`, {
            roleName: `测试角色_${Date.now()}`,
            roleCode: `TEST_ROLE_${Date.now()}`,
        }, { headers: H });
        testRoleId = res.data.data?.id;
        record('创建角色', 'POST /role', 'SUCCESS', res);
    } catch (e: any) { record('创建角色', 'POST /role', 'SUCCESS', null, e); }

    try {
        const res = await axios.get(`${API_BASE}/role`, { headers: H });
        record('查看角色列表', 'GET /role', 'SUCCESS', res);
    } catch (e: any) { record('查看角色列表', 'GET /role', 'SUCCESS', null, e); }

    if (testRoleId) {
        try {
            const res = await axios.put(`${API_BASE}/role/${testRoleId}`, {
                roleName: '已更新角色名',
            }, { headers: H });
            record('更新角色', 'PUT /role/:id', 'SUCCESS', res);
        } catch (e: any) { record('更新角色', 'PUT /role/:id', 'SUCCESS', null, e); }

        try {
            const res = await axios.delete(`${API_BASE}/role/${testRoleId}`, { headers: H });
            record('删除角色', 'DELETE /role/:id', 'SUCCESS', res);
        } catch (e: any) { record('删除角色', 'DELETE /role/:id', 'SUCCESS', null, e); }
    }

    // --- Group CRUD ---
    console.log('--- 7.3 群组管理 ---');
    try {
        const res = await axios.post(`${API_BASE}/group`, {
            tenantId: testTenantId,
            groupName: `测试群组_${Date.now()}`,
            groupCode: `TEST_GRP_${Date.now()}`,
        }, { headers: H });
        testGroupId = res.data.data?.id;
        record('创建群组', 'POST /group', 'SUCCESS', res);
    } catch (e: any) { record('创建群组', 'POST /group', 'SUCCESS', null, e); }

    try {
        const res = await axios.get(`${API_BASE}/group/list/${testTenantId}`, { headers: H });
        record('查看群组列表', 'GET /group/list/:id', 'SUCCESS', res);
    } catch (e: any) { record('查看群组列表', 'GET /group/list/:id', 'SUCCESS', null, e); }

    if (testGroupId) {
        try {
            const res = await axios.put(`${API_BASE}/group/${testGroupId}`, {
                groupName: '已更新群组名',
            }, { headers: H });
            record('更新群组', 'PUT /group/:id', 'SUCCESS', res);
        } catch (e: any) { record('更新群组', 'PUT /group/:id', 'SUCCESS', null, e); }

        try {
            const res = await axios.delete(`${API_BASE}/group/${testGroupId}`, { headers: H });
            record('删除群组', 'DELETE /group/:id', 'SUCCESS', res);
        } catch (e: any) { record('删除群组', 'DELETE /group/:id', 'SUCCESS', null, e); }
    }
}

// =============================================
// Phase 8: Refresh Token 测试
// =============================================
async function phase8_RefreshToken() {
    console.log('\n═══ Phase 8: Refresh Token 测试 ═══\n');

    try {
        // 先登录获取 refreshToken
        const loginRes = await axios.post(`${API_BASE}/user/login`, {
            username: 'system_admin',
            password: 'admin123',
        });
        const refreshToken = loginRes.data.data.refreshToken;

        // 用 refresh token 刷新 access token
        const res = await axios.post(`${API_BASE}/user/refresh`, { refreshToken });
        if (res.data.success && res.data.data.accessToken) {
            console.log('  ✅ Refresh Token 测试成功');
            console.log(`     新 AccessToken: ${res.data.data.accessToken.substring(0, 30)}...`);
            results.push({
                name: '刷新 Access Token',
                endpoint: 'POST /user/refresh',
                expected: 'SUCCESS',
                actual: 'PASS',
                status: 200,
                message: 'Token 刷新成功',
            });
        }
    } catch (e: any) {
        console.log('  ❌ Refresh Token 测试失败:', e.message);
        results.push({
            name: '刷新 Access Token',
            endpoint: 'POST /user/refresh',
            expected: 'SUCCESS',
            actual: 'FAIL',
            status: 500,
            message: e.message,
        });
    }
}

// =============================================
// 生成报告
// =============================================
function generateReport() {
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                  功 能 测 试 结 果 报 告');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const byPhase: Record<string, TestResult[]> = {};
    for (const r of results) {
        const phase = r.name.includes('租户') && r.expected === 'FORBIDDEN' ? 'Tenant拒绝' :
                      r.name.includes('权限') && r.expected === 'FORBIDDEN' ? 'Permission拒绝' :
                      r.name.includes('租户') || r.name.includes('Tenant') ? 'Tenant CRUD' :
                      r.name.includes('权限') || r.name.includes('Permission') ? 'Permission CRUD' :
                      r.name.includes('刷新') ? 'Refresh Token' :
                      r.name.includes('用户') || r.name.includes('角色') || r.name.includes('群组') ? '租户级功能' :
                      '其他';
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(r);
    }

    let total = 0, passed = 0;
    for (const [phase, tests] of Object.entries(byPhase)) {
        console.log(`\n📊 ${phase}`);
        console.log('─'.repeat(60));
        for (const t of tests) {
            const icon = t.actual === 'PASS' ? '✅' : '❌';
            const expectedLabel = t.expected === 'SUCCESS' ? '应成功' : '应拒绝';
            console.log(`  ${icon} ${t.name} [${expectedLabel}] → HTTP ${t.status} | ${t.message}`);
            total++;
            if (t.actual === 'PASS') passed++;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`\n📈 总计: ${passed}/${total} 通过 (${((passed/total)*100).toFixed(1)}%)`);

    if (passed === total) {
        console.log('\n🎉 所有测试通过！权限边界正确。');
    } else {
        console.log(`\n⚠️  ${total - passed} 个测试未通过，需要检查。`);
    }
    console.log('═'.repeat(60));
}

// =============================================
// Main
// =============================================
async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   Auth-Core 功能测试                             ║');
    console.log('║   System Admin vs Tenant Admin 权限边界验证      ║');
    console.log('╚══════════════════════════════════════════════════╝');

    try {
        await setupTestTenant();
        await phase1_SystemAdminLogin();
        await phase2_TenantAdminLogin();

        // System Admin 场景
        await phase3_SystemAdminTenantCRUD();
        await phase4_SystemAdminPermissionCRUD();

        // Tenant Admin 拒绝场景
        await phase5_TenantAdminDenied();
        await phase6_TenantAdminPermissions();

        // Tenant Admin 成功场景
        await phase7_TenantAdminCRUD();

        // Refresh Token
        await phase8_RefreshToken();

        generateReport();
    } catch (e: any) {
        console.error('\n❌ 测试异常:', e.message);
        if (e.response) console.error('   Response:', JSON.stringify(e.response.data));
    }

    await prisma.$disconnect();
}

main();
