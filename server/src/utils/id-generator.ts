import { randomBytes } from 'crypto';

// 纯安全字母表：62 字符，无任何符号
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LEN = ALPHABET.length;

/**
 * 生成 ID（无前缀时 prefix 传空）
 * @param prefix 前缀：tbl / fld / rec / ''
 * @param length 随机串长度
 */
function generateStyleId(prefix: string, length = 12) {
    const bytes = randomBytes(length); // 安全随机字节
    let id = prefix;
    for (let i = 0; i < length; i++) {
        id += ALPHABET[bytes[i] % LEN]; // 映射到纯字母数字
    }
    return id;
}

// ✅ 对外暴露：和飞书完全一致
export const generateTableId = () => generateStyleId('tbl');
export const generateFieldId = () => generateStyleId('fld');
export const generateRecordId = () => generateStyleId('rec');
export const generateViewId = () => generateStyleId('vew');
export const generateMirrorId = () => generateStyleId('mir');
export const generateReferenceId = () => generateStyleId('ref');
export const generateShareId = () => generateStyleId('share');