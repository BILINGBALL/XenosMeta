import {Group} from '@prisma/client';
import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';
import {buildGroupTree, getSubGroupTree} from '@utils/group.util'
import {CacheKeys, CacheTTL} from "@cache/keys";
import {Cacheable, CacheEvict} from "@cache/decorators";
import {AppError} from '@middleware/error.middleware';
import { logger } from '@common/logger'
import {paginate, PaginatedResult} from '@utils/pagination';

type CreateGroupDto = {
    tenantId: string;
    groupName: string;
    groupCode: string;
    parentId?: string;
    public?: boolean;
};

type UpdateGroupDto = {
    groupName?: string;
    groupCode?: string;
    status?: boolean;
    public?: boolean;
};

class GroupService {
    @CacheEvict({
        keys: (tenantId: string, tenantCode: string) => [
            CacheKeys.rootGroupTree(tenantId),
            CacheKeys.groupList(tenantId)
        ]
    })
    async createRootGroup(tenantId: string, tenantCode: string): Promise<Group> {
        const exists = await prisma.group.findFirst({
            where: {tenantId, groupCode: `ROOT_${tenantCode}`},
        });
        if (exists) {
            // 确保已有根组也有 path
            if (!exists.path) {
                await prisma.group.update({
                    where: {id: exists.id},
                    data: {path: `/${exists.id}`},
                });
            }
            return exists;
        }
        // 根组 parentId = null，path = /{id}
        const tempId = `temp_${Date.now()}`;
        const group = await prisma.group.create({
            data: {
                groupName: "根组织",
                groupCode: `ROOT_${tenantCode}`,
                tenantId: tenantId,
                parentId: null,
                path: `/${tempId}`, // 临时path，创建后更新
            },
        });
        // 用真实ID更新path
        const realPath = `/${group.id}`;
        return prisma.group.update({
            where: {id: group.id},
            data: {path: realPath},
        });
    }

    async getTenantRootGroup(tenantId: string) {
        return prisma.group.findFirst({
            where: {tenantId, groupCode: {startsWith: 'ROOT_'}},
        });
    }


    @CacheEvict({
        keys: (dto: CreateGroupDto) => [
            CacheKeys.rootGroupTree(dto.tenantId),
            CacheKeys.groupList(dto.tenantId)
        ]
    })
    async createGroup(dto: CreateGroupDto) {
        const {tenantId, groupName, groupCode, parentId} = dto;
        if (groupCode && groupCode.startsWith('ROOT_')) {
            throw new AppError(400, '群组织代码不通过，不能以"ROOT_"开头!');
        }
        let pid = parentId;
        if (!pid) {
            const root = await this.getTenantRootGroup(tenantId);
            if (!root) throw new AppError(404, '租户根组织不存在');
            pid = root.id;
        }

        // 计算物化路径：父path + "/" + 自身ID
        const parent = await prisma.group.findUnique({where: {id: pid}});
        const parentPath = parent?.path || '';

        // 先创建以获取ID
        const group = await prisma.group.create({
            data: {groupName, groupCode, tenantId, parentId: pid, path: `${parentPath}/temp`, public: dto.public ?? false},
        });

        // 用真实ID更新path
        return prisma.group.update({
            where: {id: group.id},
            data: {path: `${parentPath}/${group.id}`},
        });
    }

    /**
     * 通过物化路径获取所有子孙群组
     * 替代递归 buildGroupTree → getSubGroupTree → extractAllGroupIds 的 O(n) 遍历
     */
    async getDescendantGroupIds(rootGroupId: string): Promise<string[]> {
        const root = await prisma.group.findUnique({where: {id: rootGroupId}});
        if (!root || !root.path) return [rootGroupId];

        const descendants = await prisma.group.findMany({
            where: {path: {startsWith: root.path}},
            select: {id: true},
        });
        return descendants.map((g: any) => g.id);
    }

    async getGroupList(tenantId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.group, {
            where: { tenantId, ...notDeleted },
            include: {parent: true, children: true},
            orderBy: {createdAt: 'asc'},
        }, page, pageSize);
    }

    // 内部方法：获取所有群组（不分页，用于树构建）
    async getAllGroups(tenantId: string) {
        return prisma.group.findMany({
            where: { tenantId, ...notDeleted },
            include: {parent: true, children: true},
            orderBy: {createdAt: 'asc'},
        });
    }

    @Cacheable({key: CacheKeys.rootGroupTree, ttl: CacheTTL.GROUP_TREE})
    async getRootGroupTree(tenantId: string) {
        const root = await this.getTenantRootGroup(tenantId);
        if (!root) return null;
        const list = await this.getAllGroups(tenantId);
        return buildGroupTree(list);
    }

    @Cacheable({key: CacheKeys.userGroupIds, ttl: CacheTTL.USER_GROUP})
    async getUserGroupIdList(tenantId: string, userId: string) {
        logger.info({ userId }, 'getUserGroupIdList')
        const userGroups = await prisma.userGroup.findMany({
            where: { userId },
            select: { groupId: true },
        });
        logger.info({ count: userGroups.length }, 'userGroups found')
        return userGroups.map((item: any) => item.groupId);
    }

    /** 获取租户下所有群组 ID（不过滤用户归属） */
    async getAllGroupIds(tenantId: string): Promise<string[]> {
        const groups = await prisma.group.findMany({
            where: { tenantId, ...notDeleted },
            select: { id: true },
        })
        return groups.map((g) => g.id)
    }

    async getGroupTree(tenantId: string, groupId: string) {
        // 1. 获取根组
        const rootGroupTree = await this.getRootGroupTree(tenantId);
        // 2. 截取groupTree
        return await getSubGroupTree(rootGroupTree, groupId)
    }

    /**
     * 获取用户所有权限组子树
     * 返回 subTrees 数组
     */
    async getUserGroupTrees(tenantId: string, userId: string) {
        const rootGroupTree = await this.getRootGroupTree(tenantId);
        const groupIds = await this.getUserGroupIdList(tenantId, userId);

        // 4. 对每个 groupId 截取子树
        const subTrees = [];
        for (const groupId of groupIds) {
            const subTree = getSubGroupTree(rootGroupTree, groupId);
            if (subTree) {
                subTrees.push(subTree);
            }
        }

        // 返回最终结果
        return subTrees;
    }

    @CacheEvict({
        keys: async (id: string, dto: UpdateGroupDto) => {
            const group = await prisma.group.findUnique({ where: { id } })
            if (!group) return []
            return [
                CacheKeys.group(id),
                CacheKeys.groupList(group.tenantId),
                CacheKeys.rootGroupTree(group.tenantId)
            ]
        }
    })
    async updateGroup(id: string, dto: UpdateGroupDto) {
        const group = await prisma.group.findUnique({ where: { id } })
        if (!group) {
            throw new AppError(404, '群组不存在')
        }

        return prisma.group.update({where: {id}, data: dto});
    }

    @Cacheable({
        key: CacheKeys.group,
        ttl: CacheTTL.GROUP
    })
    async getGroupById(id: string) {
        const group = await prisma.group.findUnique({
            where: {id},
            include: {
                parent: true,
                children: true,
                users: {
                    include: {
                        user: {
                            select: { id: true, username: true, nickname: true, email: true, avatar: true, status: true }
                        }
                    }
                }
            }
        });
        if (!group) {
            throw new AppError(404, '群组不存在');
        }
        return group;
    }

    @CacheEvict({
        keys: async (id: string) => {
            const group = await prisma.group.findUnique({ where: { id } })
            if (!group) return []
            return [
                CacheKeys.group(id),
                CacheKeys.groupList(group.tenantId),
                CacheKeys.rootGroupTree(group.tenantId)
            ]
        }
    })
    async deleteGroup(id: string) {
        const group = await prisma.group.findUnique({ where: { id } });
        if (!group) {
            throw new AppError(404, '群组不存在');
        }
        await prisma.group.update({
            where: {id},
            data: {deletedAt: new Date()}
        });

        return { success: true };
    }

    @CacheEvict({
        keys: async (id: string) => {
            const group = await prisma.group.findUnique({ where: { id, deletedAt: { not: null } } })
            if (!group) return []
            return [
                CacheKeys.group(id),
                CacheKeys.groupList(group.tenantId),
                CacheKeys.rootGroupTree(group.tenantId)
            ]
        }
    })
    async restoreGroup(id: string) {
        const group = await prisma.group.findUnique({ where: { id, deletedAt: { not: null } } });
        if (!group) {
            throw new AppError(404, '已删除的群组不存在');
        }
        // 恢复前检查：同租户内是否有同名且未删除的群组（部分唯一索引会在数据库层报错，这里做友好提示）
        const conflict = await prisma.group.findFirst({
            where: { tenantId: group.tenantId, groupCode: group.groupCode, deletedAt: null },
        });
        if (conflict) {
            throw new AppError(409, `群组编码「${group.groupCode}」在当前租户中已存在，无法恢复`);
        }
        return prisma.group.update({
            where: {id},
            data: {deletedAt: null}
        });
    }

    // ==================== My Groups ====================

    /** 获取用户所属的群组列表 */
    async getUserGroups(tenantId: string, userId: string) {
        const userGroups = await prisma.userGroup.findMany({
            where: { userId, group: { tenantId, ...notDeleted } },
            select: { group: true },
        })
        return userGroups.map((ug: any) => ug.group)
    }

    /** 获取用户群组及其所有子孙群组的 ID 集合 */
    private async getMyDescendantIds(tenantId: string, userId: string): Promise<string[]> {
        const myGroupIds = await this.getUserGroupIdList(tenantId, userId)
        if (!myGroupIds.length) return []
        const allIds = new Set(myGroupIds)
        for (const gid of myGroupIds) {
            const descendants = await this.getDescendantGroupIds(gid)
            for (const did of descendants) allIds.add(did)
        }
        return Array.from(allIds)
    }

    /** 获取与用户群组已建联的对端群组（通过 active GroupRelation） */
    async getConnectedGroups(tenantId: string, userId: string) {
        const myGroupIds = await this.getMyDescendantIds(tenantId, userId)
        if (!myGroupIds.length) return []

        const relations = await prisma.groupRelation.findMany({
            where: {
                tenantId,
                status: 'active',
                OR: [
                    { fromGroupId: { in: myGroupIds } },
                    { toGroupId: { in: myGroupIds } },
                ],
            },
            select: { fromGroupId: true, toGroupId: true },
        })

        const peerIds = new Set<string>()
        for (const r of relations) {
            if (myGroupIds.includes(r.fromGroupId)) peerIds.add(r.toGroupId)
            if (myGroupIds.includes(r.toGroupId)) peerIds.add(r.fromGroupId)
        }
        if (!peerIds.size) return []
        return prisma.group.findMany({
            where: { id: { in: Array.from(peerIds) }, ...notDeleted },
        })
    }

    /** 获取用户群组发出的联系请求 */
    async getSentRelations(tenantId: string, userId: string) {
        const myGroupIds = await this.getMyDescendantIds(tenantId, userId)
        if (!myGroupIds.length) return []
        return prisma.groupRelation.findMany({
            where: { fromGroupId: { in: myGroupIds } },
            include: { toGroup: { select: { id: true, groupName: true, groupCode: true } } },
            orderBy: { createdAt: 'desc' },
        })
    }

    /** 获取发往用户群组的待处理联系请求 */
    async getPendingRelations(tenantId: string, userId: string) {
        const myGroupIds = await this.getMyDescendantIds(tenantId, userId)
        if (!myGroupIds.length) return []
        return prisma.groupRelation.findMany({
            where: { tenantId, toGroupId: { in: myGroupIds }, status: 'pending' },
            include: { fromGroup: { select: { id: true, groupName: true, groupCode: true } }, toGroup: { select: { id: true, groupName: true, groupCode: true } }, creator: { select: { id: true, username: true, nickname: true } } },
            orderBy: { createdAt: 'desc' },
        })
    }

    // ==================== GroupRelation ====================

    /** 发起联系 */
    async createRelation(dto: { fromGroupId: string; toGroupId: string; tenantId: string; createdBy?: string; note?: string }) {
        if (dto.fromGroupId === dto.toGroupId) throw new AppError(400, '不能向自己的群组发起联系')
        const toGroup = await prisma.group.findUnique({ where: { id: dto.toGroupId } })
        if (!toGroup) throw new AppError(404, '目标群组不存在')
        if (!toGroup.public) throw new AppError(400, '目标群组未公开，无法发起联系')

        const existing = await prisma.groupRelation.findFirst({
            where: { fromGroupId: dto.fromGroupId, toGroupId: dto.toGroupId },
        })
        if (existing) throw new AppError(409, '已向该群组发起过联系，请勿重复')

        return prisma.groupRelation.create({
            data: {
                fromGroupId: dto.fromGroupId,
                toGroupId: dto.toGroupId,
                tenantId: dto.tenantId,
                createdBy: dto.createdBy,
                note: dto.note?.slice(0, 200),
            },
        })
    }

    /** 接受联系 */
    async acceptRelation(id: string) {
        const rel = await prisma.groupRelation.findUnique({ where: { id } })
        if (!rel) throw new AppError(404, '联系请求不存在')
        if (rel.status !== 'pending') throw new AppError(400, `联系状态为「${rel.status}」`)
        return prisma.groupRelation.update({ where: { id }, data: { status: 'active' } })
    }

    /** 拒绝联系 → status=rejected */
    async rejectRelation(id: string) {
        const rel = await prisma.groupRelation.findUnique({ where: { id } })
        if (!rel) throw new AppError(404, '联系请求不存在')
        if (rel.status !== 'pending') throw new AppError(400, '只有待处理的请求可以拒绝')
        return prisma.groupRelation.update({ where: { id }, data: { status: 'rejected' } })
    }

    /** 放弃联系 — 删除记录 */
    async deleteRelation(id: string) {
        const rel = await prisma.groupRelation.findUnique({ where: { id } })
        if (!rel) throw new AppError(404, '联系记录不存在')
        await prisma.groupRelation.delete({ where: { id } })
        return { success: true }
    }

    /** 取消关联 — 通过两个 groupId找 active relation 并删除 */
    async deleteRelationByGroups(userId: string, tenantId: string, groupA: string, groupB: string) {
        const myGroupIds = await this.getMyDescendantIds(tenantId, userId)
        const rel = await prisma.groupRelation.findFirst({
            where: {
                tenantId,
                status: 'active',
                OR: [
                    { fromGroupId: { in: myGroupIds }, toGroupId: groupB },
                    { fromGroupId: { in: myGroupIds }, toGroupId: groupA },
                    { fromGroupId: groupA, toGroupId: { in: myGroupIds } },
                    { fromGroupId: groupB, toGroupId: { in: myGroupIds } },
                ],
            },
        })
        if (!rel) throw new AppError(404, '未找到活跃联系')
        await prisma.groupRelation.delete({ where: { id: rel.id } })
        return { success: true }
    }

    /** 再次申请 → rejected 重置为 pending */
    async reapplyRelation(id: string) {
        const rel = await prisma.groupRelation.findUnique({ where: { id } })
        if (!rel) throw new AppError(404, '联系记录不存在')
        if (rel.status !== 'rejected') throw new AppError(400, '只有被拒绝的记录可以重新申请')
        return prisma.groupRelation.update({ where: { id }, data: { status: 'pending' } })
    }

    // ==================== Public / Share ====================

    /** 切换群组公开状态 */
    async togglePublic(id: string) {
        const group = await prisma.group.findUnique({ where: { id } })
        if (!group) throw new AppError(404, '群组不存在')
        return prisma.group.update({
            where: { id },
            data: { public: !group.public },
        })
    }

    /** 搜索租户内所有公开群组 */
    async searchPublicGroups(tenantId: string, search?: string, page = 1, pageSize = 20) {
        const where: any = { tenantId, public: true, ...notDeleted }
        if (search) {
            where.OR = [
                { groupName: { contains: search, mode: 'insensitive' } },
                { groupCode: { contains: search, mode: 'insensitive' } },
            ]
        }
        return paginate(prisma.group, { where, orderBy: { groupName: 'asc' } }, page, pageSize)
    }

    /** 向公开群组推送表镜像 — 创建 pending 状态的 TableMirror */
    async shareMirrorToGroup(dto: {
        sourceGroupId: string;
        targetGroupId: string;
        sourceTableId: string;
        visibleFields: string[];
        name: string;
        description?: string;
        tenantId: string;
        createdBy?: string;
    }) {
        const target = await prisma.group.findUnique({ where: { id: dto.targetGroupId } })
        if (!target) throw new AppError(404, '目标群组不存在')
        if (!target.public) throw new AppError(400, '目标群组未公开，无法推送镜像')

        // 检查重复
        const existing = await prisma.tableMirror.findFirst({
            where: { sourceTableId: dto.sourceTableId, groupId: dto.targetGroupId, sourceGroupId: dto.sourceGroupId },
        })
        if (existing) throw new AppError(409, '已向该群组推送过此表镜像，请勿重复发起')

        const { generateMirrorId } = await import('@utils/id-generator')
        return prisma.tableMirror.create({
            data: {
                mirrorId: generateMirrorId(),
                sourceTableId: dto.sourceTableId,
                sourceGroupId: dto.sourceGroupId,
                name: dto.name,
                description: dto.description,
                visibleFields: dto.visibleFields,
                groupId: dto.targetGroupId,
                status: 'pending',
                tenantId: dto.tenantId,
                createdBy: dto.createdBy,
            },
        })
    }

    /** 接受镜像共享 */
    async acceptMirror(mirrorId: string) {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')
        if (mirror.status !== 'pending') throw new AppError(400, `镜像状态为「${mirror.status}」，无法接受`)
        return prisma.tableMirror.update({ where: { mirrorId }, data: { status: 'accepted' } })
    }

    /** 拒绝镜像共享 — 直接删除 */
    async rejectMirror(mirrorId: string) {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')
        if (mirror.status !== 'pending') throw new AppError(400, '只有待处理的镜像可以拒绝')
        await prisma.tableMirror.delete({ where: { mirrorId } })
        return { success: true }
    }

    /** 获取某群组收到的镜像（可按 status 过滤 pending） */
    async getMirrorsForGroup(groupId: string, status?: string, page = 1, pageSize = 20) {
        const where: any = { groupId }
        if (status) where.status = status
        return paginate(prisma.tableMirror, {
            where,
            include: {
                sourceGroup: { select: { id: true, groupName: true, groupCode: true } },
                sourceTable: { select: { tableId: true, name: true } },
                creator: { select: { id: true, username: true, nickname: true } },
            },
            orderBy: { createdAt: 'desc' },
        }, page, pageSize)
    }

    /** 获取某群组发出的镜像 */
    async getMirrorsFromGroup(groupId: string, page = 1, pageSize = 20) {
        return paginate(prisma.tableMirror, {
            where: { sourceGroupId: groupId },
            include: {
                sourceTable: { select: { tableId: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        }, page, pageSize)
    }
}

export const groupService = new GroupService();
