import redis from '@common/redis';
import { logger } from '@common/logger'

// 用于 普通函数 的缓存装饰器
export function Cacheable(options: {
    key: (...args: any[]) => string;
    ttl: number;
}) {
    return function (
        target: any,
        context: ClassMemberDecoratorContext | any
    ) {
        return function (this: any, ...args: any[]) {
            return (async () => {
                const cacheKey = options.key(...args);
                const cached = await redis.get(cacheKey);

                if (cached) {
                    // logger.info("正在调用已有缓存：", JSON.parse(cached))
                    return JSON.parse(cached);
                }

                const result = await target.apply(this, args);
                // logger.info("正在建立新的缓存：", JSON.stringify(result));
                await redis.set(cacheKey, JSON.stringify(result), 'EX', options.ttl);
                return result;
            })();
        };
    };
}

// 用于 普通函数 的清理缓存装饰器 - 支持多个key
export function CacheEvict(options: {
    keys: (...args: any[]) => (string | string[] | Promise<string | string[]>);
}) {
    return function (
        target: any,
        context: ClassMemberDecoratorContext | any
    ) {
        return function (this: any, ...args: any[]) {
            return (async () => {
                // 先执行原方法
                const result = await target.apply(this, args);
                // 然后清除缓存
                const keyOrKeys = await options.keys(...args);
                const keysToDelete = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
                if (keysToDelete.length > 0) {
                    await redis.del(keysToDelete);
                }
                return result;
            })();
        };
    };
}
