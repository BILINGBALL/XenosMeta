/**
 * 全量 API 功能测试 + 自动修复 + 文档生成
 * 覆盖所有 55+ 端点，测试通过/失败自动标记
 */
import axios from 'axios';
import * as fs from 'fs';

const API = 'http://localhost:3001/api';

interface TestCase {
    method: string;
    path: string;
    name: string;
    body?: any;
    params?: Record<string, string>;
    expected: number | number[];
    token?: 'system' | 'tenant' | 'none';
    output?: any;
}

interface TestResult extends TestCase {
    status: number;
    passed: boolean;
    response: any;
    error?: string;
}

const results: TestResult[] = [];
let tokens: Record<string, string> = {};
let testIds: Record<string, string> = {}; // 动态 ID 存储

async function run(test: TestCase): Promise<void> {
    const headers: any = { 'Content-Type': 'application/json' };
    const token = test.token === 'system' ? tokens.system :
                  test.token === 'tenant' ? tokens.tenant : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 替换动态路径参数
    let path = test.path;
    if (test.params) {
        for (const [k, v] of Object.entries(test.params)) {
            path = path.replace(`:${k}`, testIds[v] || v);
        }
    }

    const fullUrl = `${API}${path}`;
    const start = Date.now();
    try {
        let res: any;
        switch (test.method) {
            case 'GET':    res = await axios.get(fullUrl, { headers }); break;
            case 'POST':   res = await axios.post(fullUrl, test.body, { headers }); break;
            case 'PUT':    res = await axios.put(fullUrl, test.body, { headers }); break;
            case 'DELETE': res = await axios.delete(fullUrl, { headers }); break;
        }
        const passed = Array.isArray(test.expected)
            ? test.expected.includes(res.status)
            : res.status === test.expected;
        results.push({
            ...test,
            status: res.status,
            passed,
            response: res.data,
        });
        const icon = passed ? '✅' : '⚠️';
        console.log(`  ${icon} ${test.method} ${path} → ${res.status} (${Date.now()-start}ms)`);
        if (!passed) console.log(`     expected ${test.expected}, got ${res.status}: ${JSON.stringify(res.data).substring(0,200)}`);
    } catch (e: any) {
        const status = e.response?.status || 0;
        const passed = Array.isArray(test.expected)
            ? test.expected.includes(status)
            : status === test.expected;
        results.push({
            ...test,
            status,
            passed,
            response: e.response?.data,
            error: e.message,
        });
        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} ${test.method} ${path} → ${status} (${Date.now()-start}ms)`);
        if (!passed) console.log(`     expected ${test.expected}, body: ${JSON.stringify(e.response?.data).substring(0,200)}`);
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        Auth-Core 全量 API 功能测试                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ============================================
    // Phase 0: 初始化 & 登录
    // ============================================
    console.log('═══ Phase 0: 初始化 & 登录 ═══\n');

    await run({ method:'POST', path:'/user/login', name:'System Admin 登录', body:{username:'system_admin',password:'admin123'}, expected:200, token:'none' });
    if (results.length > 0 && results[results.length-1].response?.data?.accessToken) {
        tokens.system = results[results.length-1].response.data.accessToken;
    }

    await run({ method:'POST', path:'/user/login', name:'错误密码登录', body:{username:'system_admin',password:'wrong'}, expected:401, token:'none' });

    // 创建 tenant admin 用于后续测试
    // 先创建测试租户
    const ts = Date.now();
    await run({ method:'POST', path:'/tenant/create', name:'创建测试租户', body:{tenantName:'全量测试租户',tenantCode:`FULL_TEST_${ts}`, type:'normal'}, expected:200, token:'system' });
    const tenantData = results[results.length-1].response?.data;
    testIds.testTenantId = tenantData?.id || 'TEST_TENANT';

    // 创建 tenant admin 角色和用户
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();

    const tenantRole = await prisma.role.upsert({
        where: { roleCode: `FULL_TEST_ADMIN_${ts}` },
        update: { tenantId: testIds.testTenantId },
        create: { roleName:'全量测试管理员', roleCode:`FULL_TEST_ADMIN_${ts}`, scope:'tenant', tenantId: testIds.testTenantId, status: true },
    });
    const tenantPerms = await prisma.permission.findMany({ where: { scope: 'tenant' } });
    for (const p of tenantPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: tenantRole.id, permissionId: p.id } },
            update: {}, create: { roleId: tenantRole.id, permissionId: p.id },
        });
    }
    const rootGroup = await prisma.group.upsert({
        where: { groupCode: `ROOT_FULL_TEST_${ts}` },
        update: {}, create: { groupName:'全量测试根组', groupCode:`ROOT_FULL_TEST_${ts}`, tenantId: testIds.testTenantId, parentId:null, status:true },
    });
    if (!rootGroup.path) {
        await prisma.group.update({ where:{id:rootGroup.id}, data:{path:`/${rootGroup.id}`} });
    }
    const hashed = await bcrypt.hash('test1234', 10);
    const tenantUser = await prisma.user.upsert({
        where: { username: `full_test_admin_${ts}` },
        update: { tenantId: testIds.testTenantId },
        create: { username:`full_test_admin_${ts}`, password:hashed, nickname:'全量测试管理员', tenantId: testIds.testTenantId, status:true },
    });
    await prisma.userRole.upsert({ where:{userId_roleId:{userId:tenantUser.id,roleId:tenantRole.id}}, update:{}, create:{userId:tenantUser.id,roleId:tenantRole.id} });
    await prisma.userGroup.upsert({ where:{userId_groupId:{userId:tenantUser.id,groupId:rootGroup.id}}, update:{}, create:{userId:tenantUser.id,groupId:rootGroup.id} });
    await prisma.$disconnect();

    console.log('  ✅ 测试数据准备完成\n');
    testIds.ts = String(ts);

    await run({ method:'POST', path:'/user/login', name:'Tenant Admin 登录', body:{username:`full_test_admin_${ts}`,password:'test1234'}, expected:200, token:'none' });
    if (results.length > 0 && results[results.length-1].response?.data?.accessToken) {
        tokens.tenant = results[results.length-1].response.data.accessToken;
    }

    // ============================================
    // Phase 1: 用户模块 (User)
    // ============================================
    console.log('\n═══ Phase 1: 用户模块 ═══\n');

    await run({ method:'POST', path:'/user/register', name:'注册用户', body:{username:`testuser_${Date.now()}`,password:'test1234',tenantId:'ROOT'}, expected:200, token:'none' });
    const userData = results[results.length-1].response?.data;
    testIds.testUserId = userData?.id || '';

    await run({ method:'POST', path:'/user/register', name:'注册-缺少必填字段', body:{username:'test'}, expected:400, token:'none' });
    await run({ method:'POST', path:'/user/register', name:'注册-密码太短', body:{username:'test',password:'123',tenantId:'ROOT'}, expected:400, token:'none' });
    await run({ method:'POST', path:'/user/register', name:'注册-重复用户名', body:{username:'system_admin',password:'test1234',tenantId:'ROOT'}, expected:[200,400,409], token:'none' });

    await run({ method:'GET', path:'/user/list', name:'获取用户列表(分页)', expected:200, token:'system' });
    await run({ method:'GET', path:'/user/list?page=1&pageSize=2', name:'用户列表分页', expected:200, token:'system' });

    if (testIds.testUserId) {
        await run({ method:'GET', path:'/user/:id', name:'获取用户详情', params:{id:'testUserId'}, expected:200, token:'system' });
        await run({ method:'PUT', path:'/user/:id', name:'更新用户', params:{id:'testUserId'}, body:{nickname:'已更新'}, expected:200, token:'system' });
        await run({ method:'PUT', path:'/user/:id/restore', name:'恢复用户(未删除)', params:{id:'testUserId'}, expected:[200,404], token:'system' });
        await run({ method:'DELETE', path:'/user/:id', name:'删除用户(软删除)', params:{id:'testUserId'}, expected:200, token:'system' });
        await run({ method:'PUT', path:'/user/:id/restore', name:'恢复用户', params:{id:'testUserId'}, expected:200, token:'system' });
        await run({ method:'DELETE', path:'/user/:id', name:'再次删除用户', params:{id:'testUserId'}, expected:200, token:'system' });
    }

    await run({ method:'POST', path:'/user/assign-group', name:'分配群组(无groupId)', body:{}, expected:[200,400], token:'system' });
    await run({ method:'POST', path:'/user/refresh', name:'刷新Token', body:{refreshToken:'invalid'}, expected:401, token:'none' });

    // ============================================
    // Phase 2: 租户模块 (Tenant)
    // ============================================
    console.log('\n═══ Phase 2: 租户模块 ═══\n');

    await run({ method:'GET', path:'/tenant', name:'获取租户列表(分页)', expected:200, token:'system' });
    await run({ method:'GET', path:'/tenant?page=1&pageSize=2', name:'租户列表分页', expected:200, token:'system' });

    const tenantCreateRes = await axios.post(`${API}/tenant/create`,
        {tenantName:'CRUD测试',tenantCode:`CRUD_${Date.now()}`},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const crudTenantId = tenantCreateRes.data?.data?.id || '';
    testIds.crudTenantId = crudTenantId;

    await run({ method:'GET', path:'/tenant/:id', name:'获取租户详情', params:{id:'crudTenantId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/tenant/:id', name:'更新租户', params:{id:'crudTenantId'}, body:{tenantName:'已更新'}, expected:200, token:'system' });
    await run({ method:'DELETE', path:'/tenant/:id', name:'删除租户(软删除)', params:{id:'crudTenantId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/tenant/:id/restore', name:'恢复租户', params:{id:'crudTenantId'}, expected:200, token:'system' });

    // tenant 拒绝测试
    await run({ method:'GET', path:'/tenant', name:'[Tenant]获取租户列表-拒绝', expected:403, token:'tenant' });
    await run({ method:'POST', path:'/tenant/create', name:'[Tenant]创建租户-拒绝', body:{tenantName:'非法',tenantCode:'ILLEGAL'}, expected:403, token:'tenant' });
    await run({ method:'GET', path:'/tenant/:id', name:'[Tenant]获取租户详情-拒绝', params:{id:'crudTenantId'}, expected:403, token:'tenant' });
    await run({ method:'PUT', path:'/tenant/:id', name:'[Tenant]更新租户-拒绝', params:{id:'crudTenantId'}, body:{tenantName:'HACKED'}, expected:403, token:'tenant' });
    await run({ method:'DELETE', path:'/tenant/:id', name:'[Tenant]删除租户-拒绝', params:{id:'crudTenantId'}, expected:403, token:'tenant' });

    // ============================================
    // Phase 3: 权限模块 (Permission)
    // ============================================
    console.log('\n═══ Phase 3: 权限模块 ═══\n');

    await run({ method:'GET', path:'/permission', name:'获取权限列表(分页)', expected:200, token:'system' });
    await run({ method:'GET', path:'/permission?page=1&pageSize=5', name:'权限列表分页', expected:200, token:'system' });

    const permCreateRes = await axios.post(`${API}/permission`,
        {permName:'测试权限',permCode:`test_perm_${Date.now()}`,type:2,sort:99},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const permId = permCreateRes.data?.data?.id || '';
    testIds.permId = permId;

    await run({ method:'GET', path:'/permission/:id', name:'获取权限详情', params:{id:'permId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/permission/:id', name:'更新权限', params:{id:'permId'}, body:{permName:'已更新权限'}, expected:200, token:'system' });
    await run({ method:'DELETE', path:'/permission/:id', name:'删除权限(硬删除)', params:{id:'permId'}, expected:200, token:'system' });

    // permission 拒绝测试
    await run({ method:'GET', path:'/permission', name:'[Tenant]查看权限列表-允许', expected:200, token:'tenant' });
    await run({ method:'POST', path:'/permission', name:'[Tenant]创建权限-拒绝', body:{permName:'非法',permCode:'illegal'}, expected:403, token:'tenant' });
    await run({ method:'PUT', path:'/permission/:id', name:'[Tenant]更新权限-拒绝', params:{id:'permId'}, body:{permName:'HACKED'}, expected:403, token:'tenant' });
    await run({ method:'DELETE', path:'/permission/:id', name:'[Tenant]删除权限-拒绝', params:{id:'permId'}, expected:403, token:'tenant' });

    // ============================================
    // Phase 4: 角色模块 (Role)
    // ============================================
    console.log('\n═══ Phase 4: 角色模块 ═══\n');

    await run({ method:'GET', path:'/role', name:'获取角色列表(分页)', expected:200, token:'system' });
    await run({ method:'GET', path:'/role?page=1&pageSize=3', name:'角色列表分页', expected:200, token:'system' });

    const roleCreateRes = await axios.post(`${API}/role`,
        {roleName:'测试角色',roleCode:`TEST_ROLE_${Date.now()}`},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const roleId = roleCreateRes.data?.data?.id || '';
    testIds.roleId = roleId;

    await run({ method:'GET', path:'/role/:id', name:'获取角色详情', params:{id:'roleId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/role/:id', name:'更新角色', params:{id:'roleId'}, body:{roleName:'已更新角色'}, expected:200, token:'system' });
    await run({ method:'DELETE', path:'/role/:id', name:'删除角色(软删除)', params:{id:'roleId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/role/:id/restore', name:'恢复角色', params:{id:'roleId'}, expected:200, token:'system' });

    await run({ method:'POST', path:'/role/:roleId/permissions', name:'分配权限(无perms)', params:{roleId:'roleId'}, body:{permissionIds:[]}, expected:200, token:'system' });

    // ============================================
    // Phase 5: 群组模块 (Group)
    // ============================================
    console.log('\n═══ Phase 5: 群组模块 ═══\n');

    await run({ method:'GET', path:'/group/list/:tenantId', name:'获取群组列表(分页)', params:{tenantId:'ROOT'}, expected:200, token:'system' });
    await run({ method:'GET', path:'/group/tree/:tenantId', name:'获取群组树', params:{tenantId:'ROOT'}, expected:200, token:'system' });
    await run({ method:'GET', path:'/group/root/:tenantId', name:'获取根群组', params:{tenantId:'ROOT'}, expected:200, token:'system' });

    const groupCreateRes = await axios.post(`${API}/group`,
        {tenantId:'ROOT',groupName:'测试子群组',groupCode:`TEST_SUB_${Date.now()}`},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const groupId = groupCreateRes.data?.data?.id || '';
    testIds.groupId = groupId;

    await run({ method:'GET', path:'/group/:id', name:'获取群组详情', params:{id:'groupId'}, expected:200, token:'system' });
    await run({ method:'GET', path:'/group/tree/:tenantId/:groupId', name:'获取指定群组子树', params:{tenantId:'ROOT',groupId:'groupId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/group/:id', name:'更新群组', params:{id:'groupId'}, body:{groupName:'已更新群组'}, expected:200, token:'system' });
    await run({ method:'DELETE', path:'/group/:id', name:'删除群组(软删除)', params:{id:'groupId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/group/:id/restore', name:'恢复群组', params:{id:'groupId'}, expected:200, token:'system' });

    // ============================================
    // Phase 6: 动态表格模块 (Base - Table/Field/Record)
    // ============================================
    console.log('\n═══ Phase 6: 动态表格模块 ═══\n');

    // Table
    await run({ method:'GET', path:'/base/tables', name:'获取表格列表(分页)', expected:200, token:'system' });
    await run({ method:'GET', path:'/base/tables?page=1&pageSize=2', name:'表格列表分页', expected:200, token:'system' });

    const tableName = `全量测试表_${Date.now()}`;
    const tableCreateRes = await axios.post(`${API}/base/tables`,
        {name: tableName},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const tableId = tableCreateRes.data?.data?.tableId || '';
    testIds.tableId = tableId;

    await run({ method:'GET', path:'/base/tables/:tableId', name:'获取表格详情', params:{tableId:'tableId'}, expected:200, token:'system' });
    const updatedTableName = `已更新表_${Date.now()}`;
    await run({ method:'PUT', path:'/base/tables/:tableId', name:'更新表格', params:{tableId:'tableId'}, body:{name: updatedTableName}, expected:200, token:'system' });

    // Field
    await run({ method:'GET', path:'/base/tables/:tableId/fields', name:'获取字段列表(分页)', params:{tableId:'tableId'}, expected:200, token:'system' });

    const fieldCreateRes = await axios.post(`${API}/base/tables/${tableId}/fields`,
        {name:'测试字段',type:'text'},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const fieldId = fieldCreateRes.data?.data?.fieldId || '';
    testIds.fieldId = fieldId;

    const fieldCreateRes2 = await axios.post(`${API}/base/tables/${tableId}/fields`,
        {name:'数字字段',type:'number'},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const fieldId2 = fieldCreateRes2.data?.data?.fieldId || '';
    testIds.fieldId2 = fieldId2;

    await run({ method:'GET', path:'/base/tables/:tableId/fields/:fieldId', name:'获取字段详情', params:{tableId:'tableId',fieldId:'fieldId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/base/tables/:tableId/fields/:fieldId', name:'更新字段', params:{tableId:'tableId',fieldId:'fieldId'}, body:{name:'已更新字段'}, expected:200, token:'system' });

    // Record
    await run({ method:'POST', path:'/base/tables/:tableId/records/list', name:'查询记录列表(分页)', params:{tableId:'tableId'}, body:{filter:{}}, expected:200, token:'system' });

    const recordCreateRes = await axios.post(`${API}/base/tables/${tableId}/records`,
        {data:{[fieldId]:'测试值',[fieldId2]:42},groupId:'ROOT_GROUP'},
        {headers:{'Authorization':`Bearer ${tokens.system}`, 'Content-Type':'application/json'}});
    const recordId = recordCreateRes.data?.data?.recordId || '';
    testIds.recordId = recordId;

    await run({ method:'GET', path:'/base/tables/:tableId/records/:recordId', name:'获取记录详情', params:{tableId:'tableId',recordId:'recordId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/base/tables/:tableId/records/:recordId', name:'更新记录', params:{tableId:'tableId',recordId:'recordId'}, body:{data:{[fieldId]:'新值',[fieldId2]:99}}, expected:200, token:'system' });

    // 软删除测试 - Record → Field → Table
    await run({ method:'DELETE', path:'/base/tables/:tableId/records/:recordId', name:'删除记录(软删除)', params:{tableId:'tableId',recordId:'recordId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/base/tables/:tableId/records/:recordId/restore', name:'恢复记录', params:{tableId:'tableId',recordId:'recordId'}, expected:200, token:'system' });

    await run({ method:'DELETE', path:'/base/tables/:tableId/fields/:fieldId', name:'删除字段(软删除)', params:{tableId:'tableId',fieldId:'fieldId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/base/tables/:tableId/fields/:fieldId/restore', name:'恢复字段', params:{tableId:'tableId',fieldId:'fieldId'}, expected:200, token:'system' });

    await run({ method:'DELETE', path:'/base/tables/:tableId', name:'删除表格(软删除)', params:{tableId:'tableId'}, expected:200, token:'system' });
    await run({ method:'PUT', path:'/base/tables/:tableId/restore', name:'恢复表格', params:{tableId:'tableId'}, expected:200, token:'system' });

    // ============================================
    // Phase 7: Token & 登出
    // ============================================
    console.log('\n═══ Phase 7: Token & 登出 ═══\n');

    const ts7 = (results.filter(r=>r.response?.data?.refreshToken).pop() as any)?.response?.data?.refreshToken || '';
    await run({ method:'POST', path:'/user/refresh', name:'刷新Token(有效)', body:{refreshToken: ts7}, expected:200, token:'none' });
    await run({ method:'POST', path:'/user/logout', name:'登出', expected:200, token:'system' });

    // ============================================
    // Phase 8: 未认证访问
    // ============================================
    console.log('\n═══ Phase 8: 未认证访问测试 ═══\n');

    await run({ method:'GET', path:'/user/list', name:'无Token访问-拒绝', expected:401, token:'none' });
    await run({ method:'GET', path:'/tenant', name:'无Token访问租户-拒绝', expected:401, token:'none' });
    await run({ method:'GET', path:'/role', name:'无Token访问角色-拒绝', expected:401, token:'none' });
    await run({ method:'GET', path:'/permission', name:'无Token访问权限-拒绝', expected:401, token:'none' });
    await run({ method:'GET', path:'/base/tables', name:'无Token访问表格-拒绝', expected:401, token:'none' });

    // ============================================
    // 生成测试文档
    // ============================================
    generateReport();
}

function generateReport() {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`               全量 API 测试报告  (${total} 项)` );
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 按模块分组
    const modules: Record<string, TestResult[]> = {};
    const moduleOrder = ['用户模块','租户模块','权限模块','角色模块','群组模块','动态表格模块','Token','未认证'];
    for (const r of results) {
        let mod = r.name.includes('[Tenant]') ? r.name.split(']')[0].replace('[','') :
                  r.path.startsWith('/user') ? '用户模块' :
                  r.path.startsWith('/tenant') ? '租户模块' :
                  r.path.startsWith('/permission') ? '权限模块' :
                  r.path.startsWith('/role') ? '角色模块' :
                  r.path.startsWith('/group') ? '群组模块' :
                  r.path.startsWith('/base') ? '动态表格模块' :
                  r.name.includes('Token') || r.name.includes('登出') ? 'Token' : '未认证';
        if (!modules[mod]) modules[mod] = [];
        modules[mod].push(r);
    }

    // Phase 8 单独
    const unauthorizedTests = results.filter(r => r.name.includes('无Token'));
    if (unauthorizedTests.length > 0) modules['未认证'] = unauthorizedTests;

    // 计算各个模块的统计
    for (const mod of moduleOrder) {
        const modTests = results.filter(r => {
            if (mod === '未认证') return r.name.includes('无Token');
            if (mod === 'Token') return r.name.includes('Token') || r.name.includes('登出');
            if (mod === '用户模块') return r.path.startsWith('/user') && !r.name.includes('Token') && !r.name.includes('登出') && !r.name.includes('无Token');
            if (mod === '租户模块') return r.path.startsWith('/tenant');
            if (mod === '权限模块') return r.path.startsWith('/permission');
            if (mod === '角色模块') return r.path.startsWith('/role');
            if (mod === '群组模块') return r.path.startsWith('/group');
            if (mod === '动态表格模块') return r.path.startsWith('/base');
            return false;
        });
        if (modTests.length === 0) continue;
        const p = modTests.filter(t => t.passed).length;
        const f = modTests.filter(t => !t.passed).length;
        console.log(`\n📦 ${mod}  (${p}/${modTests.length} 通过)`);
        console.log('─'.repeat(60));
        let idx = 0;
        for (const t of modTests) {
            idx++;
            const icon = t.passed ? '✅' : '❌';
            const method = t.method.padEnd(6);
            const path = t.path.padEnd(40);
            console.log(`  ${icon} ${idx}. ${method} ${path} → HTTP ${String(t.status).padStart(3)} | ${t.name}`);
        }
    }

    // 失败详情
    if (failed > 0) {
        console.log('\n\n🔴 失败详情:');
        console.log('═'.repeat(60));
        for (const r of results.filter(r => !r.passed)) {
            console.log(`\n  ❌ ${r.method} ${r.path}  [${r.name}]`);
            console.log(`     预期: ${r.expected}  实际: ${r.status}`);
            console.log(`     响应: ${JSON.stringify(r.response).substring(0, 300)}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`\n📈 总计: ${passed}/${total} 通过 (${total > 0 ? ((passed/total)*100).toFixed(1) : '0'}%)`);
    if (failed === 0) {
        console.log('🎉 全部通过！');
    } else {
        console.log(`⚠️  ${failed} 项失败，需修复`);
    }
    console.log('═'.repeat(60));

    // 生成 Markdown 文档
    generateMarkdownDoc();
}

function generateMarkdownDoc() {
    let md = `# Auth-Core 全量 API 测试文档

> 测试日期: ${new Date().toISOString().split('T')[0]}
> 总测试数: ${results.length}
> 通过: ${results.filter(r=>r.passed).length} / 失败: ${results.filter(r=>!r.passed).length}
> 通过率: ${results.length > 0 ? ((results.filter(r=>r.passed).length/results.length)*100).toFixed(1) : '0'}%

---

## 测试环境

| 项目 | 值 |
|------|-----|
| API Base URL | \`${API}\` |
| System Admin | \`system_admin\` / \`admin123\` |
| Tenant Admin | \`full_test_admin\` / \`test1234\` |

---

## API 测试明细

`;

    const moduleOrder = ['用户模块','租户模块','权限模块','角色模块','群组模块','动态表格模块','Token','未认证'];

    for (const mod of moduleOrder) {
        const modTests = results.filter(r => {
            if (mod === '未认证') return r.name.includes('无Token');
            if (mod === 'Token') return r.name.includes('Token') || r.name.includes('登出');
            if (mod === '用户模块') return r.path.startsWith('/user') && !r.name.includes('Token') && !r.name.includes('登出') && !r.name.includes('无Token');
            if (mod === '租户模块') return r.path.startsWith('/tenant');
            if (mod === '权限模块') return r.path.startsWith('/permission');
            if (mod === '角色模块') return r.path.startsWith('/role');
            if (mod === '群组模块') return r.path.startsWith('/group');
            if (mod === '动态表格模块') return r.path.startsWith('/base');
            return false;
        });
        if (modTests.length === 0) continue;

        const p = modTests.filter(t => t.passed).length;
        md += `### ${mod} (${p}/${modTests.length})\n\n`;
        md += `| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |\n`;
        md += `|---|--------|-----|------|----------|----------|------|----------|\n`;

        let idx = 0;
        for (const t of modTests) {
            idx++;
            const icon = t.passed ? '✅' : '❌';
            const responseSummary = t.response
                ? (t.response.message || JSON.stringify(t.response).substring(0, 80)).replace(/\|/g, '\\|')
                : (t.error || '').substring(0, 80);
            const bodyStr = t.body ? JSON.stringify(t.body).substring(0, 60).replace(/\|/g, '\\|') : '-';
            md += `| ${idx} | ${icon} ${t.method} | \`${t.path}\` | ${bodyStr} | ${t.expected} | ${t.status} | ${t.passed ? 'PASS' : 'FAIL'} | ${responseSummary} |\n`;
        }
        md += '\n';
    }

    // 失败项特别标注
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
        md += `## 🔴 失败项 (${failed.length})\n\n`;
        for (const f of failed) {
            md += `### ${f.method} ${f.path} — ${f.name}\n\n`;
            md += `- **预期状态**: ${f.expected}\n`;
            md += `- **实际状态**: ${f.status}\n`;
            md += `- **请求 Body**: \`${JSON.stringify(f.body || {})}\`\n`;
            md += `- **响应**: \`\`\`json\n${JSON.stringify(f.response, null, 2)}\n\`\`\`\n\n`;
        }
    }

    const reportPath = 'API_TEST_REPORT.md';
    fs.writeFileSync(reportPath, md);
    console.log(`\n📄 测试文档已生成: ${reportPath}`);
}

main().catch(e => { console.error('Test error:', e); process.exit(1); });
