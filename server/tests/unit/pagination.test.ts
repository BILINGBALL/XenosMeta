import { paginate, PaginatedResult } from '../../src/utils/pagination'

describe('paginate', () => {
    const mockModel = {
        findMany: jest.fn(),
        count: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should return paginated results', async () => {
        const items = [{ id: '1' }, { id: '2' }]
        mockModel.findMany.mockResolvedValue(items)
        mockModel.count.mockResolvedValue(10)

        const result = await paginate(mockModel, { where: { status: true } }, 2, 5)

        expect(mockModel.findMany).toHaveBeenCalledWith({
            where: { status: true },
            skip: 5,
            take: 5,
        })
        expect(mockModel.count).toHaveBeenCalledWith({ where: { status: true } })
        expect(result).toEqual({
            items,
            total: 10,
            page: 2,
            pageSize: 5,
            totalPages: 2,
        })
    })

    it('should calculate skip correctly for page 1', async () => {
        mockModel.findMany.mockResolvedValue([])
        mockModel.count.mockResolvedValue(0)

        await paginate(mockModel, {}, 1, 20)

        expect(mockModel.findMany).toHaveBeenCalledWith({
            skip: 0,
            take: 20,
        })
    })

    it('should return totalPages = 0 when total is 0', async () => {
        mockModel.findMany.mockResolvedValue([])
        mockModel.count.mockResolvedValue(0)

        const result = await paginate(mockModel, {}, 1, 20)

        expect(result.totalPages).toBe(0)
    })

    it('should pass include, orderBy, select to findMany', async () => {
        mockModel.findMany.mockResolvedValue([])
        mockModel.count.mockResolvedValue(0)

        const query = {
            where: { tenantId: 't1' },
            include: { roles: true },
            orderBy: { createdAt: 'desc' as const },
            select: { id: true },
        }

        await paginate(mockModel, query, 1, 10)

        expect(mockModel.findMany).toHaveBeenCalledWith({
            ...query,
            skip: 0,
            take: 10,
        })
    })
})
