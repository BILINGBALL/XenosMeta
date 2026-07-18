import { success, fail, created, noContent, unauthorized, forbidden, notFound } from '../../src/utils/response'

describe('response utils', () => {
    describe('success', () => {
        it('should return a success response with default message', () => {
            expect(success({ id: '1' })).toEqual({
                code: 200,
                message: '操作成功',
                data: { id: '1' },
                success: true,
            })
        })

        it('should use custom message when provided', () => {
            expect(success({ id: '1' }, '自定义成功')).toEqual({
                code: 200,
                message: '自定义成功',
                data: { id: '1' },
                success: true,
            })
        })

        it('should set data to null when no data provided', () => {
            expect(success()).toEqual({
                code: 200,
                message: '操作成功',
                data: null,
                success: true,
            })
        })
    })

    describe('fail', () => {
        it('should return a fail response with default message and code', () => {
            expect(fail()).toEqual({
                code: 400,
                message: '操作失败',
                data: null,
                success: false,
            })
        })

        it('should use custom message and code', () => {
            expect(fail('参数错误', 422)).toEqual({
                code: 422,
                message: '参数错误',
                data: null,
                success: false,
            })
        })
    })

    describe('created', () => {
        it('should return 201 with default message', () => {
            expect(created({ id: '1' })).toEqual({
                code: 201,
                message: '创建成功',
                data: { id: '1' },
                success: true,
            })
        })
    })

    describe('noContent', () => {
        it('should return 204', () => {
            expect(noContent()).toEqual({
                code: 204,
                message: '删除成功',
                data: null,
                success: true,
            })
        })
    })

    describe('unauthorized', () => {
        it('should return 401', () => {
            expect(unauthorized()).toEqual({
                code: 401,
                message: '未授权，请先登录',
                data: null,
                success: false,
            })
        })
    })

    describe('forbidden', () => {
        it('should return 403', () => {
            expect(forbidden()).toEqual({
                code: 403,
                message: '无权限操作',
                data: null,
                success: false,
            })
        })
    })

    describe('notFound', () => {
        it('should return 404', () => {
            expect(notFound()).toEqual({
                code: 404,
                message: '资源不存在',
                data: null,
                success: false,
            })
        })
    })
})
