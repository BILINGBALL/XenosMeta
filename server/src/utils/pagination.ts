export interface PaginatedResult<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export interface PaginationParams {
    page: number
    pageSize: number
}

/**
 * 通用分页查询
 * 自动执行 findMany + count（并行），返回统一分页结构
 */
export async function paginate<T>(
    model: any,
    query: {
        where?: any
        include?: any
        orderBy?: any
        select?: any
    },
    page: number,
    pageSize: number,
): Promise<PaginatedResult<T>> {
    const skip = (page - 1) * pageSize

    const [items, total] = await Promise.all([
        model.findMany({
            ...query,
            skip,
            take: pageSize,
        }),
        model.count({
            where: query.where,
        }),
    ])

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
}
