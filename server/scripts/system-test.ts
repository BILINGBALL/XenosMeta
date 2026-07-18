/**
 * 完整系统测试脚本
 * 
 * 功能：
 * 1. 创建 ROOT 租户（system 类型）和 Admin 用户
 * 2. 为所有接口创建 permissions
 * 3. 创建 Sudelan 租户（normal 类型）和 Sudelan-Admin 用户
 * 4. 测试 table、field、record 增删改查
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import axios from 'axios';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';

// 测试结果收集
const testResults: {
    phase: string;
    tests: Array<{
        name: string;
        status: 'PASS' | 'FAIL';
        duration: number;
        details?: string;
    }>;
}[] = [];

async function recordTest(phase: string, name: string, status: 'PASS' | 'FAIL', duration: number, details?: string) {
    const phaseTests = testResults.find(t => t.phase === phase);
    if (phaseTests) {
        phaseTests.tests.push({ name, status, duration, details });
    } else {
        testResults.push({
            phase,
            tests: [{ name, status, duration, details }]
        });
    }
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${name} - ${duration}ms${details ? ': ' + details : ''}`);
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Phase 1: 初始化 ROOT 租户和 Admin 用户
// ========================================
async function setupROOT() {
    console.log('\n=== Phase 1: 初始化 ROOT 租户和 Admin 用户 ===\n');
    const startTime = Date.now();

    try {
        // 1. 创建 ROOT 租户
        const rootTenant = await prisma.tenant.upsert({
            where: { id: 'ROOT' },
            update: {},
            create: {
                id: 'ROOT',
                tenantName: '系统管理租户',
                tenantCode: 'ROOT',
                type: 'system',
                status: true,
            },
        });
        await recordTest('Phase 1', '创建 ROOT 租户', 'PASS', Date.now() - startTime, `ID: ${rootTenant.id}`);

        // 2. 创建 ROOT 根群组
        const rootGroup = await prisma.group.upsert({
            where: { id: 'ROOT_GROUP' },
            update: {},
            create: {
                id: 'ROOT_GROUP',
                groupName: '系统管理组',
                groupCode: 'ROOT_GROUP',
                tenantId: rootTenant.id,
                parentId: null,
                status: true,
            },
        });
        await recordTest('Phase 1', '创建 ROOT_GROUP', 'PASS', 0, `ID: ${rootGroup.id}`);

        // 3. 加密密码
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 4. 创建 Admin 用户
        const adminUser = await prisma.user.upsert({
            where: { username: 'Admin' },
            update: {
                password: hashedPassword,
                tenantId: rootTenant.id,
                nickname: '系统管理员',
            },
            create: {
                username: 'Admin',
                password: hashedPassword,
                nickname: '系统管理员',
                tenantId: rootTenant.id,
                status: true,
            },
        });
        await recordTest('Phase 1', '创建 Admin 用户', 'PASS', 0, `ID: ${adminUser.id}`);

        // 5. 创建 ROOT Admin 角色
        const adminRole = await prisma.role.upsert({
            where: { roleCode: 'ROOT_ADMIN' },
            update: {
                tenantId: rootTenant.id,
                scope: 'system',
            },
            create: {
                roleName: 'ROOT管理员',
                roleCode: 'ROOT_ADMIN',
                scope: 'system',
                tenantId: rootTenant.id,
                status: true,
            },
        });
        await recordTest('Phase 1', '创建 ROOT_ADMIN 角色', 'PASS', 0, `ID: ${adminRole.id}`);

        // 6. 分配 Admin 用户到角色和群组
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
            update: {},
            create: { userId: adminUser.id, roleId: adminRole.id }
        });

        await prisma.userGroup.upsert({
            where: { userId_groupId: { userId: adminUser.id, groupId: rootGroup.id } },
            update: {},
            create: { userId: adminUser.id, groupId: rootGroup.id }
        });
        await recordTest('Phase 1', 'Admin 用户分配角色和群组', 'PASS', 0);

        console.log('\n✅ ROOT 租户和 Admin 用户初始化完成！');
        console.log('   登录信息：');
        console.log('   - 租户ID: ROOT');
        console.log('   - 用户名: Admin');
        console.log('   - 密码: admin123\n');

        return { rootTenant, adminUser, adminRole, rootGroup };
    } catch (error) {
        await recordTest('Phase 1', '初始化 ROOT', 'FAIL', Date.now() - startTime, String(error));
        throw error;
    }
}

// ========================================
// Phase 2: 创建所有 Permissions
// ========================================
async function setupPermissions(adminRoleId: string) {
    console.log('\n=== Phase 2: 创建所有 Permissions ===\n');
    const startTime = Date.now();

    try {
        // 所有权限定义
        const allPermissions = [
            // 租户管理权限（system scope）
            { permName: '租户查看', permCode: 'sys:tenant:view', scope: 'system', sort: 1 },
            { permName: '租户新增', permCode: 'sys:tenant:add', scope: 'system', sort: 2 },
            { permName: '租户编辑', permCode: 'sys:tenant:edit', scope: 'system', sort: 3 },
            { permName: '租户删除', permCode: 'sys:tenant:delete', scope: 'system', sort: 4 },
            
            // 权限管理权限（system scope）
            { permName: '权限查看', permCode: 'sys:permission:view', scope: 'system', sort: 11 },
            { permName: '权限新增', permCode: 'sys:permission:add', scope: 'system', sort: 12 },
            { permName: '权限编辑', permCode: 'sys:permission:edit', scope: 'system', sort: 13 },
            { permName: '权限删除', permCode: 'sys:permission:delete', scope: 'system', sort: 14 },
            
            // 用户管理权限（tenant scope）
            { permName: '用户查看', permCode: 'sys:user:view', scope: 'tenant', sort: 21 },
            { permName: '用户新增', permCode: 'sys:user:add', scope: 'tenant', sort: 22 },
            { permName: '用户编辑', permCode: 'sys:user:edit', scope: 'tenant', sort: 23 },
            { permName: '用户删除', permCode: 'sys:user:delete', scope: 'tenant', sort: 24 },
            { permName: '用户分配', permCode: 'sys:user:assign', scope: 'tenant', sort: 25 },
            
            // 角色管理权限（tenant scope）
            { permName: '角色查看', permCode: 'sys:role:view', scope: 'tenant', sort: 31 },
            { permName: '角色新增', permCode: 'sys:role:add', scope: 'tenant', sort: 32 },
            { permName: '角色编辑', permCode: 'sys:role:edit', scope: 'tenant', sort: 33 },
            { permName: '角色删除', permCode: 'sys:role:delete', scope: 'tenant', sort: 34 },
            { permName: '角色分配', permCode: 'sys:role:assign', scope: 'tenant', sort: 35 },
            
            // 群组管理权限（tenant scope）
            { permName: '群组查看', permCode: 'sys:group:view', scope: 'tenant', sort: 41 },
            { permName: '群组新增', permCode: 'sys:group:add', scope: 'tenant', sort: 42 },
            { permName: '群组编辑', permCode: 'sys:group:edit', scope: 'tenant', sort: 43 },
            { permName: '群组删除', permCode: 'sys:group:delete', scope: 'tenant', sort: 44 },
            
            // 业务表管理权限（tenant scope）
            { permName: '表查看', permCode: 'base:table:view', scope: 'tenant', sort: 51 },
            { permName: '表新增', permCode: 'base:table:add', scope: 'tenant', sort: 52 },
            { permName: '表编辑', permCode: 'base:table:edit', scope: 'tenant', sort: 53 },
            { permName: '表删除', permCode: 'base:table:delete', scope: 'tenant', sort: 54 },
            
            // 字段管理权限（tenant scope）
            { permName: '字段查看', permCode: 'base:field:view', scope: 'tenant', sort: 61 },
            { permName: '字段新增', permCode: 'base:field:add', scope: 'tenant', sort: 62 },
            { permName: '字段编辑', permCode: 'base:field:edit', scope: 'tenant', sort: 63 },
            { permName: '字段删除', permCode: 'base:field:delete', scope: 'tenant', sort: 64 },
            
            // 记录管理权限（tenant scope）
            { permName: '记录查看', permCode: 'base:record:view', scope: 'tenant', sort: 71 },
            { permName: '记录新增', permCode: 'base:record:add', scope: 'tenant', sort: 72 },
            { permName: '记录编辑', permCode: 'base:record:edit', scope: 'tenant', sort: 73 },
            { permName: '记录删除', permCode: 'base:record:delete', scope: 'tenant', sort: 74 },
        ];

        const createdPermissions = [];

        for (const perm of allPermissions) {
            const permission = await prisma.permission.upsert({
                where: { permCode: perm.permCode },
                update: { scope: perm.scope },
                create: {
                    permName: perm.permName,
                    permCode: perm.permCode,
                    type: 2, // 按钮类型
                    sort: perm.sort,
                    scope: perm.scope,
                },
            });
            createdPermissions.push(permission);
        }

        await recordTest('Phase 2', '创建所有权限', 'PASS', Date.now() - startTime, `共 ${createdPermissions.length} 个权限`);

        // 分配所有权限给 ROOT_ADMIN 角色
        console.log('\n分配权限给 ROOT_ADMIN 角色...');
        for (const perm of createdPermissions) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: adminRoleId,
                        permissionId: perm.id,
                    },
                },
                update: {},
                create: {
                    roleId: adminRoleId,
                    permissionId: perm.id,
                },
            });
        }
        await recordTest('Phase 2', 'ROOT_ADMIN 角色分配所有权限', 'PASS', 0, `分配 ${createdPermissions.length} 个权限`);

        console.log('\n✅ 所有 Permissions 创建完成！');
        return createdPermissions;
    } catch (error) {
        await recordTest('Phase 2', '创建 Permissions', 'FAIL', Date.now() - startTime, String(error));
        throw error;
    }
}

// ========================================
// Phase 3: 创建 Sudelan 租户和 Sudelan-Admin 用户
// ========================================
async function setupSudelan() {
    console.log('\n=== Phase 3: 创建 Sudelan 租户和 Sudelan-Admin 用户 ===\n');
    const startTime = Date.now();

    try {
        // 1. 创建 Sudelan 租户
        const sudelanTenant = await prisma.tenant.upsert({
            where: { id: 'Sudelan' },
            update: {},
            create: {
                id: 'Sudelan',
                tenantName: 'Sudelan公司',
                tenantCode: 'Sudelan',
                type: 'normal',
                status: true,
            },
        });
        await recordTest('Phase 3', '创建 Sudelan 租户', 'PASS', Date.now() - startTime, `ID: ${sudelanTenant.id}`);

        // 2. 创建 Sudelan 根组（使用正确的代码格式 ROOT_Sudelan）
        const sudelanGroup = await prisma.group.upsert({
            where: { id: 'Sudelan_ROOT_GROUP' },
            update: {},
            create: {
                id: 'Sudelan_ROOT_GROUP',
                groupName: 'Sudelan总部',
                groupCode: 'ROOT_Sudelan',
                tenantId: sudelanTenant.id,
                parentId: null,
                status: true,
            },
        });
        await recordTest('Phase 3', '创建 ROOT_Sudelan 根组', 'PASS', 0, `ID: ${sudelanGroup.id}`);

        // 3. 加密密码
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 4. 创建 Sudelan-Admin 用户
        const sudelanUser = await prisma.user.upsert({
            where: { username: 'Sudelan-Admin' },
            update: {
                password: hashedPassword,
                tenantId: sudelanTenant.id,
                nickname: 'Sudelan管理员',
            },
            create: {
                username: 'Sudelan-Admin',
                password: hashedPassword,
                nickname: 'Sudelan管理员',
                tenantId: sudelanTenant.id,
                status: true,
            },
        });
        await recordTest('Phase 3', '创建 Sudelan-Admin 用户', 'PASS', 0, `ID: ${sudelanUser.id}`);

        // 5. 创建 Sudelan-Admin 角色（normal 类型，拥有除 tenant 和 permission 管理外的所有权限）
        const sudelanAdminRole = await prisma.role.upsert({
            where: { roleCode: 'Sudelan_ADMIN' },
            update: {
                tenantId: sudelanTenant.id,
                scope: 'tenant',
            },
            create: {
                roleName: 'Sudelan管理员',
                roleCode: 'Sudelan_ADMIN',
                scope: 'tenant',
                tenantId: sudelanTenant.id,
                status: true,
            },
        });
        await recordTest('Phase 3', '创建 Sudelan_ADMIN 角色', 'PASS', 0, `ID: ${sudelanAdminRole.id}`);

        // 6. 获取所有租户级权限（不包括 tenant 和 permission 的管理权限）
        const tenantPermissions = await prisma.permission.findMany({
            where: {
                scope: 'tenant',
                permCode: {
                    notIn: [
                        // 排除的权限
                        'sys:tenant:view',
                        'sys:tenant:add',
                        'sys:tenant:edit',
                        'sys:tenant:delete',
                        'sys:permission:view',
                        'sys:permission:add',
                        'sys:permission:edit',
                        'sys:permission:delete',
                    ]
                }
            }
        });

        // 分配权限给 Sudelan-Admin 角色
        for (const perm of tenantPermissions) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: sudelanAdminRole.id,
                        permissionId: perm.id,
                    },
                },
                update: {},
                create: {
                    roleId: sudelanAdminRole.id,
                    permissionId: perm.id,
                },
            });
        }
        await recordTest('Phase 3', 'Sudelan_ADMIN 角色分配权限', 'PASS', 0, `分配 ${tenantPermissions.length} 个租户级权限`);

        // 7. 分配角色和群组给 Sudelan-Admin 用户
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: sudelanUser.id, roleId: sudelanAdminRole.id } },
            update: {},
            create: { userId: sudelanUser.id, roleId: sudelanAdminRole.id }
        });

        await prisma.userGroup.upsert({
            where: { userId_groupId: { userId: sudelanUser.id, groupId: sudelanGroup.id } },
            update: {},
            create: { userId: sudelanUser.id, groupId: sudelanGroup.id }
        });
        await recordTest('Phase 3', 'Sudelan-Admin 用户分配角色和群组', 'PASS', 0);

        console.log('\n✅ Sudelan 租户和 Sudelan-Admin 用户初始化完成！');
        console.log('   登录信息：');
        console.log('   - 租户ID: Sudelan');
        console.log('   - 用户名: Sudelan-Admin');
        console.log('   - 密码: admin123\n');

        return { sudelanTenant, sudelanUser, sudelanAdminRole, sudelanGroup };
    } catch (error) {
        await recordTest('Phase 3', '初始化 Sudelan', 'FAIL', Date.now() - startTime, String(error));
        throw error;
    }
}

// ========================================
// Phase 4: 测试 Table、Field、Record 增删改查
// ========================================
async function testCRUDOperations(sudelanTenantId: string, sudelanUserId: string) {
    console.log('\n=== Phase 4: 测试 Table、Field、Record 增删改查 ===\n');

    let adminToken = '';
    let sudelanToken = '';

    try {
        // 1. Admin 登录
        console.log('1. Admin 登录...');
        let startTime = Date.now();
        const adminLoginRes = await axios.post(`${API_BASE}/user/login`, {
            username: 'Admin',
            password: 'admin123',
            tenantId: 'ROOT'
        });
        adminToken = adminLoginRes.data.data.token;
        await recordTest('Phase 4', 'Admin 登录', 'PASS', Date.now() - startTime);

        // 2. Sudelan-Admin 登录
        console.log('2. Sudelan-Admin 登录...');
        startTime = Date.now();
        const sudelanLoginRes = await axios.post(`${API_BASE}/user/login`, {
            username: 'Sudelan-Admin',
            password: 'admin123',
            tenantId: 'Sudelan'
        });
        sudelanToken = sudelanLoginRes.data.data.token;
        await recordTest('Phase 4', 'Sudelan-Admin 登录', 'PASS', Date.now() - startTime, `Token: ${sudelanToken.substring(0, 20)}...`);

        // 使用 Admin token 测试 CRUD（Admin 拥有所有权限）
        const headers = { 'Authorization': `Bearer ${adminToken}` };
        const testTenantId = 'ROOT';
        const testGroupId = 'ROOT_GROUP';

        // 3. 创建动态表
        console.log('3. 创建动态表...');
        startTime = Date.now();
        const createTableRes = await axios.post(
            `${API_BASE}/base/tables`,
            {
                name: '客户管理表',
                tenantId: testTenantId,
                groupId: testGroupId
            },
            { headers }
        );
        console.log('   API 响应:', JSON.stringify(createTableRes.data, null, 2));

        if (!createTableRes.data.success) {
            throw new Error(createTableRes.data.message || '创建表失败');
        }

        const tableId = createTableRes.data.data?.tableId;
        if (!tableId) {
            throw new Error('响应中没有 tableId');
        }

        await recordTest('Phase 4', '创建客户管理表', 'PASS', Date.now() - startTime, `TableID: ${tableId}`);

        // 4. 查询动态表列表
        console.log('4. 查询动态表列表...');
        startTime = Date.now();
        const getTableRes = await axios.get(`${API_BASE}/base/tables?tenantId=${testTenantId}`, { headers });
        await recordTest('Phase 4', '查询客户管理表', 'PASS', Date.now() - startTime, `找到 ${getTableRes.data.data?.length || 0} 张表`);

        // 5. 创建字段（多种类型）
        console.log('5. 创建多个字段...');
        const fieldTypes = [
            { name: '客户姓名', type: 'text' },
            { name: '联系电话', type: 'text' },
            { name: '年龄', type: 'number' },
            { name: '生日', type: 'date' },
            { name: 'VIP会员', type: 'checkbox' },
            { name: '客户类型', type: 'select', options: ['个人', '企业', 'VIP'] },
            { name: '备注', type: 'text' },
        ];

        const fieldIds: string[] = [];
        for (const fieldType of fieldTypes) {
            startTime = Date.now();
            const createFieldRes = await axios.post(
                `${API_BASE}/base/tables/${tableId}/fields`,
                {
                    tenantId: testTenantId,
                    name: fieldType.name,
                    type: fieldType.type,
                    options: fieldType.options || null,
                    groupId: testGroupId
                },
                { headers }
            );

            if (!createFieldRes.data.success) {
                throw new Error(`创建字段 ${fieldType.name} 失败: ${createFieldRes.data.message}`);
            }

            fieldIds.push(createFieldRes.data.data.fieldId);
            await recordTest('Phase 4', `创建字段: ${fieldType.name}`, 'PASS', Date.now() - startTime, `FieldID: ${createFieldRes.data.data.fieldId}`);
        }

        // 6. 查询字段列表
        console.log('6. 查询字段列表...');
        startTime = Date.now();
        const getFieldsRes = await axios.get(`${API_BASE}/base/tables/${tableId}/fields?tenantId=${testTenantId}`, { headers });
        await recordTest('Phase 4', '查询字段列表', 'PASS', Date.now() - startTime, `找到 ${getFieldsRes.data.data?.length || 0} 个字段`);

        // 7. 创建记录
        console.log('7. 创建记录...');
        startTime = Date.now();
        const recordData: Record<string, any> = {
            [fieldIds[0]]: '张三', // 客户姓名
            [fieldIds[1]]: '13800138000', // 联系电话
            [fieldIds[2]]: 30, // 年龄
            [fieldIds[3]]: '1994-05-20', // 生日
            [fieldIds[4]]: true, // VIP会员
            [fieldIds[5]]: '个人', // 客户类型
            [fieldIds[6]]: '重要客户', // 备注
        };
        const createRecordRes = await axios.post(
            `${API_BASE}/base/tables/${tableId}/records`,
            {
                tenantId: testTenantId,
                data: recordData,
                groupId: testGroupId
            },
            { headers }
        );

        if (!createRecordRes.data.success) {
            throw new Error(`创建记录失败: ${createRecordRes.data.message}`);
        }

        const recordId = createRecordRes.data.data.recordId;
        await recordTest('Phase 4', '创建客户记录', 'PASS', Date.now() - startTime, `RecordID: ${recordId}`);

        // 8. 查询记录列表
        console.log('8. 查询记录列表...');
        startTime = Date.now();
        const getRecordRes = await axios.post(`${API_BASE}/base/tables/${tableId}/records/list`, { tenantId: testTenantId }, { headers });
        await recordTest('Phase 4', '查询客户记录', 'PASS', Date.now() - startTime, `找到 ${getRecordRes.data.data?.length || 0} 条记录`);

        // 9. 更新记录
        console.log('9. 更新记录...');
        startTime = Date.now();
        const updateData: Record<string, any> = {
            [fieldIds[0]]: '李四', // 客户姓名改为李四
            [fieldIds[4]]: false, // 取消VIP
        };
        const updateRecordRes = await axios.put(
            `${API_BASE}/base/tables/${tableId}/records/${recordId}`,
            {
                tenantId: testTenantId,
                data: updateData,
            },
            { headers }
        );

        if (!updateRecordRes.data.success) {
            throw new Error(`更新记录失败: ${updateRecordRes.data.message}`);
        }

        await recordTest('Phase 4', '更新客户记录', 'PASS', Date.now() - startTime);

        // 10. 删除记录
        console.log('10. 删除记录...');
        startTime = Date.now();
        const deleteRecordRes = await axios.delete(`${API_BASE}/base/tables/${tableId}/records/${recordId}?tenantId=${testTenantId}`, { headers });

        if (!deleteRecordRes.data.success) {
            throw new Error(`删除记录失败: ${deleteRecordRes.data.message}`);
        }

        await recordTest('Phase 4', '删除客户记录', 'PASS', Date.now() - startTime);

        // 11. 删除字段
        console.log('11. 删除字段...');
        startTime = Date.now();
        const deleteFieldRes = await axios.delete(`${API_BASE}/base/tables/${tableId}/fields/${fieldIds[6]}?tenantId=${testTenantId}`, { headers });

        if (!deleteFieldRes.data.success) {
            throw new Error(`删除字段失败: ${deleteFieldRes.data.message}`);
        }

        await recordTest('Phase 4', '删除字段: 备注', 'PASS', Date.now() - startTime);

        // 12. 删除表
        console.log('12. 删除表...');
        startTime = Date.now();
        const deleteTableRes = await axios.delete(`${API_BASE}/base/tables/${tableId}?tenantId=${testTenantId}`, { headers });

        if (!deleteTableRes.data.success) {
            throw new Error(`删除表失败: ${deleteTableRes.data.message}`);
        }

        await recordTest('Phase 4', '删除客户管理表', 'PASS', Date.now() - startTime);

        console.log('\n✅ 所有 CRUD 操作测试完成！');
        return true;
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error('\n❌ CRUD 操作测试失败:', errorMsg);
        if (error.response) {
            console.error('   响应状态:', error.response.status);
            console.error('   响应数据:', JSON.stringify(error.response.data, null, 2));
        }
        await recordTest('Phase 4', 'CRUD操作', 'FAIL', 0, errorMsg);
        return false;
    }
}

// ========================================
// 生成测试报告
// ========================================
function generateTestReport() {
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    测试结果报告');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const phase of testResults) {
        console.log(`\n📊 ${phase.phase}`);
        console.log('─'.repeat(60));

        for (const test of phase.tests) {
            const icon = test.status === 'PASS' ? '✅' : '❌';
            const status = test.status === 'PASS' ? '通过' : '失败';
            console.log(`${icon} ${test.name}`);
            console.log(`   状态: ${status} | 耗时: ${test.duration}ms`);
            if (test.details) {
                console.log(`   详情: ${test.details}`);
            }

            totalTests++;
            if (test.status === 'PASS') {
                passedTests++;
            } else {
                failedTests++;
            }
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n📈 测试统计');
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   ✅ 通过: ${passedTests}`);
    console.log(`   ❌ 失败: ${failedTests}`);
    console.log(`   📊 通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    console.log('\n' + '═'.repeat(60));

    // 保存报告到文件
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: totalTests,
            passed: passedTests,
            failed: failedTests,
            passRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`
        },
        phases: testResults
    };

    const fs = require('fs');
    const reportPath = 'TEST_REPORT.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 测试报告已保存到: ${reportPath}`);

    return { totalTests, passedTests, failedTests };
}

// ========================================
// 主函数
// ========================================
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           Auth Core 完整系统测试脚本                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    try {
        // Phase 1: 初始化 ROOT 租户和 Admin 用户
        const { rootTenant, adminUser, adminRole, rootGroup } = await setupROOT();

        // Phase 2: 创建所有 Permissions
        const permissions = await setupPermissions(adminRole.id);

        // Phase 3: 创建 Sudelan 租户和 Sudelan-Admin 用户
        const { sudelanTenant, sudelanUser, sudelanAdminRole, sudelanGroup } = await setupSudelan();

        // Phase 4: 测试 CRUD 操作
        await testCRUDOperations(sudelanTenant.id, sudelanUser.id);

        // 生成测试报告
        const { totalTests, passedTests, failedTests } = generateTestReport();

        console.log('\n\n');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                         测试完成');
        console.log('═══════════════════════════════════════════════════════════════\n');

        console.log('📋 登录信息汇总:\n');
        console.log('🔐 ROOT 系统管理员:');
        console.log('   租户ID: ROOT');
        console.log('   用户名: Admin');
        console.log('   密码: admin123');
        console.log('   权限: 全部权限（包括 tenant 和 permission 管理）\n');

        console.log('🔐 Sudelan 租户管理员:');
        console.log('   租户ID: Sudelan');
        console.log('   用户名: Sudelan-Admin');
        console.log('   密码: admin123');
        console.log('   权限: 租户级权限（不包括 tenant 和 permission 管理）\n');

        console.log(`\n✅ 测试完成! 通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`);

        await prisma.$disconnect();
        process.exit(failedTests > 0 ? 1 : 0);
    } catch (error) {
        console.error('\n❌ 测试执行失败:', error);
        generateTestReport();
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();
