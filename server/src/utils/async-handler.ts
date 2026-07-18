import { Request, Response, NextFunction } from 'express'

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>

/**
 * 包装异步 Controller 函数，自动捕获异常传递给 errorHandler
 * 消除每个 Controller 中重复的 try/catch
 *
 * @example
 * export const getList = asyncHandler(async (req, res) => {
 *     const data = await someService.getData();
 *     res.json(success(data));
 * });
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
