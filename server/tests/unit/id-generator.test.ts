import {
    generateTableId,
    generateFieldId,
    generateRecordId,
    generateViewId,
    generateMirrorId,
} from '../../src/utils/id-generator'

describe('id-generator', () => {
    const ID_REGEX = /^[a-z]{3}[a-zA-Z0-9]{12}$/

    describe('generateTableId', () => {
        it('should generate ids with tbl prefix', () => {
            const id = generateTableId()
            expect(id).toMatch(/^tbl[a-zA-Z0-9]{12}$/)
            expect(id).toHaveLength(15)
        })

        it('should generate unique ids', () => {
            const ids = new Set(Array.from({ length: 100 }, () => generateTableId()))
            expect(ids.size).toBe(100)
        })
    })

    describe('generateFieldId', () => {
        it('should generate ids with fld prefix', () => {
            expect(generateFieldId()).toMatch(/^fld[a-zA-Z0-9]{12}$/)
        })
    })

    describe('generateRecordId', () => {
        it('should generate ids with rec prefix', () => {
            expect(generateRecordId()).toMatch(/^rec[a-zA-Z0-9]{12}$/)
        })
    })

    describe('generateViewId', () => {
        it('should generate ids with vew prefix', () => {
            expect(generateViewId()).toMatch(/^vew[a-zA-Z0-9]{12}$/)
        })
    })

    describe('generateMirrorId', () => {
        it('should generate ids with mir prefix', () => {
            expect(generateMirrorId()).toMatch(/^mir[a-zA-Z0-9]{12}$/)
        })
    })
})
