/**
 * Sudelan-Admin 权限测试脚本
 *
 * 测试 Sudelan-Admin（normal 租户管理员）对 tenant 和 permission 的增删改查操作
 * 预期：无权限或 API 不存在（因为 normal 租户不应该有 system scope 权限）
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

async function testSudelanAdminPermissions() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     Sudelan-Admin 权限测试 - Tenant & Permission API         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    let passedTests = 0;
    let failedTests = 0;
    const testResults: Array<{
        name: string;
        method: string;
        path: string;
        status: 'PASS' | 'FAIL';
        details?: string;
    }> = [];

    try {
        // 1. Sudelan-Admin 登录
        console.log('=== 1. Sudelan-Admin 登录 ===\n');
        const loginRes = await axios.post(`${API_BASE}/user/login`, {
            username: 'Sudelan-Admin',
            password: 'admin123',
            tenantId: 'Sudelan'
        });

        if (!loginRes.data.success) {
            console.log('❌ 登录失败:', loginRes.data.message);
            return;
        }

        const token = loginRes.data.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('✅ 登录成功\n');

        // 2. 测试 Tenant API
        console.log('=== 2. 测试 Tenant API ===\n');

        // 2.1 获取租户列表 (GET /tenant)
        console.log('2.1 GET /api/tenant - 获取租户列表');
        try {
            const getTenantsRes = await axios.get(`${API_BASE}/tenant`, { headers });
            testResults.push({
                name: '获取租户列表',
                method: 'GET',
                path: '/api/tenant',
                status: 'PASS',
                details: `响应: ${getTenantsRes.status} - ${getTenantsRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${getTenantsRes.status} - ${JSON.stringify(getTenantsRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '获取租户列表',
                method: 'GET',
                path: '/api/tenant',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 2.2 创建租户 (POST /tenant/create)
        console.log('\n2.2 POST /api/tenant/create - 创建租户');
        try {
            const createTenantRes = await axios.post(`${API_BASE}/tenant/create`, {
                tenantName: '测试租户',
                tenantCode: 'TEST',
                type: 'normal'
            }, { headers });
            testResults.push({
                name: '创建租户',
                method: 'POST',
                path: '/api/tenant/create',
                status: 'PASS',
                details: `响应: ${createTenantRes.status} - ${createTenantRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${createTenantRes.status} - ${JSON.stringify(createTenantRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '创建租户',
                method: 'POST',
                path: '/api/tenant/create',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 2.3 更新租户 (PUT /tenant/:id)
        console.log('\n2.3 PUT /api/tenant/Sudelan - 更新租户');
        try {
            const updateTenantRes = await axios.put(`${API_BASE}/tenant/Sudelan`, {
                tenantName: 'Sudelan公司-已修改'
            }, { headers });
            testResults.push({
                name: '更新租户',
                method: 'PUT',
                path: '/api/tenant/:id',
                status: 'PASS',
                details: `响应: ${updateTenantRes.status} - ${updateTenantRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${updateTenantRes.status} - ${JSON.stringify(updateTenantRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '更新租户',
                method: 'PUT',
                path: '/api/tenant/:id',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 2.4 删除租户 (DELETE /tenant/:id)
        console.log('\n2.4 DELETE /api/tenant/Sudelan - 删除租户');
        try {
            const deleteTenantRes = await axios.delete(`${API_BASE}/tenant/Sudelan`, { headers });
            testResults.push({
                name: '删除租户',
                method: 'DELETE',
                path: '/api/tenant/:id',
                status: 'PASS',
                details: `响应: ${deleteTenantRes.status} - ${deleteTenantRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${deleteTenantRes.status} - ${JSON.stringify(deleteTenantRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '删除租户',
                method: 'DELETE',
                path: '/api/tenant/:id',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 3. 测试 Permission API
        console.log('\n=== 3. 测试 Permission API ===\n');

        // 3.1 获取权限列表 (GET /permission)
        console.log('3.1 GET /api/permission - 获取权限列表');
        try {
            const getPermsRes = await axios.get(`${API_BASE}/permission`, { headers });
            testResults.push({
                name: '获取权限列表',
                method: 'GET',
                path: '/api/permission',
                status: 'PASS',
                details: `响应: ${getPermsRes.status} - ${getPermsRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${getPermsRes.status} - ${JSON.stringify(getPermsRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '获取权限列表',
                method: 'GET',
                path: '/api/permission',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 3.2 创建权限 (POST /permission)
        console.log('\n3.2 POST /api/permission - 创建权限');
        try {
            const createPermRes = await axios.post(`${API_BASE}/permission`, {
                permName: '测试权限',
                permCode: 'test:perm:add',
                scope: 'system'
            }, { headers });
            testResults.push({
                name: '创建权限',
                method: 'POST',
                path: '/api/permission',
                status: 'PASS',
                details: `响应: ${createPermRes.status} - ${createPermRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${createPermRes.status} - ${JSON.stringify(createPermRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '创建权限',
                method: 'POST',
                path: '/api/permission',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 3.3 更新权限 (PUT /permission/:id)
        console.log('\n3.3 PUT /api/permission/:id - 更新权限');
        try {
            const updatePermRes = await axios.put(`${API_BASE}/permission/test-id`, {
                permName: '测试权限-已修改'
            }, { headers });
            testResults.push({
                name: '更新权限',
                method: 'PUT',
                path: '/api/permission/:id',
                status: 'PASS',
                details: `响应: ${updatePermRes.status} - ${updatePermRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${updatePermRes.status} - ${JSON.stringify(updatePermRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '更新权限',
                method: 'PUT',
                path: '/api/permission/:id',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 3.4 删除权限 (DELETE /permission/:id)
        console.log('\n3.4 DELETE /api/permission/:id - 删除权限');
        try {
            const deletePermRes = await axios.delete(`${API_BASE}/permission/test-id`, { headers });
            testResults.push({
                name: '删除权限',
                method: 'DELETE',
                path: '/api/permission/:id',
                status: 'PASS',
                details: `响应: ${deletePermRes.status} - ${deletePermRes.data.success ? '成功' : '失败'}`
            });
            console.log(`   响应: ${deletePermRes.status} - ${JSON.stringify(deletePermRes.data).substring(0, 100)}`);
            passedTests++;
        } catch (error: any) {
            const status = error.response?.status || 'N/A';
            const message = error.response?.data?.message || error.message;
            testResults.push({
                name: '删除权限',
                method: 'DELETE',
                path: '/api/permission/:id',
                status: 'FAIL',
                details: `状态: ${status}, 消息: ${message}`
            });
            console.log(`   ❌ 状态: ${status}, 消息: ${message}`);
            failedTests++;
        }

        // 4. 生成测试报告
        console.log('\n\n');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('                    测试结果报告');
        console.log('═══════════════════════════════════════════════════════════════\n');

        console.log('📋 Tenant API 测试结果:');
        console.log('────────────────────────────────────────────────────────────');
        testResults.filter(t => t.path.includes('tenant')).forEach(t => {
            const icon = t.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${t.name} (${t.method} ${t.path})`);
            console.log(`   ${t.details}`);
        });

        console.log('\n📋 Permission API 测试结果:');
        console.log('────────────────────────────────────────────────────────────');
        testResults.filter(t => t.path.includes('permission')).forEach(t => {
            const icon = t.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${t.name} (${t.method} ${t.path})`);
            console.log(`   ${t.details}`);
        });

        console.log('\n' + '═'.repeat(60));
        console.log('\n📈 测试统计');
        console.log(`   总测试数: ${passedTests + failedTests}`);
        console.log(`   ✅ 成功（正常访问）: ${passedTests}`);
        console.log(`   ❌ 失败（无权限/错误）: ${failedTests}`);
        console.log('\n' + '═'.repeat(60));

        console.log('\n📝 分析结论:');
        console.log('   由于 Sudelan-Admin 属于 normal 类型租户，不应拥有 system scope 权限。');
        console.log('   预期行为：无权限访问或 API 不存在。\n');

    } catch (error: any) {
        console.error('❌ 测试执行失败:', error.message);
    }
}

testSudelanAdminPermissions();
