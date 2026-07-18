import { z } from 'zod'

/**
 * DynamicField 支持的字段类型
 *
 * text       — 文本（短文本/长文本/邮箱/电话/链接 等均用 text 承载）
 * number     — 数字
 * date       — 日期/时间
 * select     — 下拉选择（选项通过 options 字段配置）
 * checkbox   — 复选框/布尔
 * user       — 人员（存储用户ID，可单选或多选）
 * attachment — 附件（不限制文档类型，存储附件元信息 JSON）
 */
export const FIELD_TYPES = [
    'text',
    'number',
    'date',
    'select',
    'checkbox',
    'user',
    'attachment',
    'reference',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export const fieldTypeSchema = z.enum(FIELD_TYPES)

export const createFieldSchema = z.object({
    name: z.string().min(1, '字段名不能为空').max(50, '字段名最多50个字符'),
    type: fieldTypeSchema,
    options: z.array(z.string()).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
    tenantId: z.string().optional(),
    groupId: z.string().nullable().optional(),
})

export const updateFieldSchema = z.object({
    name: z.string().min(1, '字段名不能为空').max(50).optional(),
    type: fieldTypeSchema.optional(),
    options: z.array(z.string()).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
})
