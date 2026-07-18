export interface ApiResponse<T = any> {
    code: number
    message: string
    data: T | null
    success: boolean
}

export function success<T = any>(data?: T, msg = '操作成功'): ApiResponse<T> {
    return { code: 200, message: msg, data: data || null, success: true }
}

export function fail(msg = '操作失败', code = 400): ApiResponse {
    return { code, message: msg, data: null, success: false }
}

export function created<T = any>(data?: T, msg = '创建成功'): ApiResponse<T> {
    return { code: 201, message: msg, data: data || null, success: true }
}

export function noContent(msg = '删除成功'): ApiResponse {
    return { code: 204, message: msg, data: null, success: true }
}

export function unauthorized(msg = '未授权，请先登录'): ApiResponse {
    return { code: 401, message: msg, data: null, success: false }
}

export function forbidden(msg = '无权限操作'): ApiResponse {
    return { code: 403, message: msg, data: null, success: false }
}

export function notFound(msg = '资源不存在'): ApiResponse {
    return { code: 404, message: msg, data: null, success: false }
}