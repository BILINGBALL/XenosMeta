import crypto from 'crypto'
export function generateFileId(): string { return `f_${crypto.randomBytes(8).toString('hex')}` }
