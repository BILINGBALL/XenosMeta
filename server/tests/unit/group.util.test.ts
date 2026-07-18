import {
    buildGroupTree,
    getSubGroupTree,
    hasGroupPermission,
    extractAllGroupIds,
} from '../../src/utils/group.util'

// eslint-disable-next-line
type GroupItem = { id: string; parentId: string | null; [key: string]: any }

function makeGroup(id: string, parentId: string | null): GroupItem {
    return { id, parentId, groupName: `Group ${id}`, groupCode: `CODE_${id}`, tenantId: 't1' }
}

describe('buildGroupTree', () => {
    it('should build a single-root tree from a flat list', () => {
        const list: GroupItem[] = [
            makeGroup('root', null),
            makeGroup('a', 'root'),
            makeGroup('b', 'root'),
            makeGroup('a1', 'a'),
        ]
        const tree = buildGroupTree(list)
        expect(tree).not.toBeNull()
        expect(tree!.id).toBe('root')
        expect(tree!.children).toHaveLength(2)
        expect(tree!.children[0].id).toBe('a')
        expect(tree!.children[1].id).toBe('b')
        expect(tree!.children[0].children).toHaveLength(1)
        expect(tree!.children[0].children[0].id).toBe('a1')
    })

    it('should return null for an empty list', () => {
        expect(buildGroupTree([])).toBeNull()
    })

    it('should handle multiple root nodes (unusual but valid)', () => {
        const list: GroupItem[] = [
            makeGroup('r1', null),
            makeGroup('r2', null),
        ]
        const tree = buildGroupTree(list)
        expect(tree).not.toBeNull()
        expect(tree!.id).toBe('r1')
    })

    it('should build a deep nested tree', () => {
        const list: GroupItem[] = [
            makeGroup('1', null),
            makeGroup('2', '1'),
            makeGroup('3', '2'),
            makeGroup('4', '3'),
            makeGroup('5', '4'),
        ]
        const tree: any = buildGroupTree(list)
        let node = tree
        let depth = 0
        while (node && node.children.length > 0) {
            depth++
            node = node.children[0]
        }
        expect(depth).toBe(4)
    })
})

describe('getSubGroupTree', () => {
    const tree = buildGroupTree([
        makeGroup('root', null),
        makeGroup('a', 'root'),
        makeGroup('a1', 'a'),
        makeGroup('a2', 'a'),
        makeGroup('b', 'root'),
        makeGroup('b1', 'b'),
    ] as GroupItem[])

    it('should return the entire tree when target is the root', () => {
        const sub: any = getSubGroupTree(tree, 'root')
        expect(sub).not.toBeNull()
        expect(sub.id).toBe('root')
        expect(sub.children).toHaveLength(2)
    })

    it('should return a subtree for a middle node', () => {
        const sub: any = getSubGroupTree(tree, 'a')
        expect(sub).not.toBeNull()
        expect(sub.id).toBe('a')
        expect(sub.children).toHaveLength(2)
        expect(sub.children.map((c: any) => c.id).sort()).toEqual(['a1', 'a2'])
    })

    it('should return a leaf node with no children', () => {
        const sub: any = getSubGroupTree(tree, 'a1')
        expect(sub).not.toBeNull()
        expect(sub.id).toBe('a1')
        expect(sub.children).toHaveLength(0)
    })

    it('should return null for a non-existent id', () => {
        expect(getSubGroupTree(tree, 'nonexistent')).toBeNull()
    })

    it('should not mutate the original tree (deep clone)', () => {
        const originalJson = JSON.stringify(tree)
        const sub: any = getSubGroupTree(tree, 'a')
        sub.id = 'mutated'
        expect(JSON.stringify(tree)).toBe(originalJson)
    })
})

describe('hasGroupPermission', () => {
    const tree = buildGroupTree([
        makeGroup('root', null),
        makeGroup('dept', 'root'),
        makeGroup('team', 'dept'),
    ] as GroupItem[])

    it('should return true for a group in the tree', () => {
        expect(hasGroupPermission(tree, 'dept')).toBe(true)
        expect(hasGroupPermission(tree, 'team')).toBe(true)
        expect(hasGroupPermission(tree, 'root')).toBe(true)
    })

    it('should return false for a group not in the tree', () => {
        expect(hasGroupPermission(tree, 'other-dept')).toBe(false)
    })

    it('should return false for null/undefined inputs', () => {
        expect(hasGroupPermission(null, 'any')).toBe(false)
        expect(hasGroupPermission(tree, '')).toBe(false)
        expect(hasGroupPermission(undefined as any, 'any')).toBe(false)
    })
})

describe('extractAllGroupIds', () => {
    const tree = buildGroupTree([
        makeGroup('root', null),
        makeGroup('a', 'root'),
        makeGroup('a1', 'a'),
        makeGroup('b', 'root'),
    ] as GroupItem[])

    it('should extract all group IDs from the tree', () => {
        const ids = extractAllGroupIds(tree)
        expect(ids).toHaveLength(4)
        expect(ids.sort()).toEqual(['a', 'a1', 'b', 'root'])
    })

    it('should return empty array for null/undefined', () => {
        expect(extractAllGroupIds(null)).toEqual([])
    })
})
