import { asyncHandler } from '../../src/utils/async-handler'

describe('asyncHandler', () => {
    it('should call the wrapped function with req, res, next', async () => {
        const fn = jest.fn().mockResolvedValue(undefined)
        const req = {} as any
        const res = {} as any
        const next = jest.fn()

        const handler = asyncHandler(fn)
        await handler(req, res, next)

        expect(fn).toHaveBeenCalledWith(req, res, next)
    })

    it('should call next with the error when the wrapped function throws', async () => {
        const error = new Error('test error')
        const fn = jest.fn().mockRejectedValue(error)
        const req = {} as any
        const res = {} as any
        const next = jest.fn()

        const handler = asyncHandler(fn)
        await handler(req, res, next)

        expect(next).toHaveBeenCalledWith(error)
    })

    it('should not call next when the function succeeds', async () => {
        const fn = jest.fn().mockResolvedValue('success')
        const req = {} as any
        const res = {} as any
        const next = jest.fn()

        const handler = asyncHandler(fn)
        await handler(req, res, next)

        expect(next).not.toHaveBeenCalled()
    })
})
