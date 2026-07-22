#!/usr/bin/env node
/**
 * Import sales plan markdown → production records with batch-date splitting.
 * Usage: node scripts/import_sales_plan_v2.js <token>
 */
const fs = require('fs');
const http = require('http');

const API = 'http://localhost:3001/api';
const TOKEN = process.argv[2] || '';
const TENANT = '1ccfa701-ce7e-4d83-b2a0-ae204b08dffc';

const PROD_TABLE = 'tblSqVPFfuLQSVo';
const SURFACE_TABLE = 'tbldDgdooUoLSsX';
const PACK_TABLE = 'tbl50ETwgSREdl0';
const RECORD_TABLE = 'tblYM9eBk8UqpKS';

function api(method, path, data) {
    return new Promise((resolve) => {
        const u = new URL(API + path);
        const body = data ? JSON.stringify(data) : undefined;
        const req = http.request({
            hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let c = [];
            res.on('data', d => c.push(d));
            res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf-8'))) } catch (e) { resolve({}) } });
        });
        req.on('error', () => resolve({}));
        if (body) req.write(body);
        req.end();
    });
}
const post = (p, d) => api('POST', p, d);
const put = (p, d) => api('PUT', p, d);

// ===== Load existing reference records =====
async function loadExisting() {
    const [surfR, packR, prodR] = await Promise.all([
        post(`/dynamic/tables/${SURFACE_TABLE}/records/list`, { page: 1, pageSize: 200 }),
        post(`/dynamic/tables/${PACK_TABLE}/records/list`, { page: 1, pageSize: 200 }),
        post(`/dynamic/tables/${PROD_TABLE}/records/list`, { page: 1, pageSize: 200 }),
    ]);

    const surfaces = {}, packs = {}, products = {};
    for (const r of (surfR?.data?.items || [])) {
        const n = r.data?.['工艺名称']; if (n) surfaces[n] = r.recordId;
    }
    for (const r of (packR?.data?.items || [])) {
        const d = r.data || {}; const n = d['名称'] || '';
        if (n) { packs[n] = r.recordId; if (d['材质']) packs[`${n}|${d['材质']}`] = r.recordId; if (d['规格']) packs[`${n}|${d['规格']}`] = r.recordId; }
    }
    for (const r of (prodR?.data?.items || [])) {
        const n = r.data?.['产品名称']; if (n) products[n] = r.recordId;
    }
    return { surfaces, packs, products };
}

// ===== Batch parser =====
function parseBatches(completion) {
    if (!completion || completion === '库存' || completion === '分批发货')
        return [{ date: completion || '', qty: null }];

    let text = completion.replace(/<br>/g, '').trim();

    // 1) Shared pattern: "date1，date2...各发货N套"
    const shared = text.match(/^([\d\-\.,，\s]+?)各发[货送]\s*([\d.]+)/);
    if (shared) {
        const dates = shared[1].split(/[,，]/).map(d => d.trim()).filter(Boolean);
        const qty = parseFloat(shared[2]);
        let baseYear = '2026', baseMonth = '';
        return dates.map(d => {
            const parts = d.split(/[-.]/);
            let date;
            if (parts.length === 3) { baseYear = parts[0]; baseMonth = parts[1]; date = `${baseYear}-${baseMonth.padStart(2, '0')}-${parts[2].padStart(2, '0')}`; }
            else if (parts.length === 2) { date = `${baseYear}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`; }
            else { date = d; }
            return { date, qty };
        });
    }

    // 2) Explicit: "date发货N，date发货N"
    const re = /((?:\d{2,4}[-.])?\d{1,2}[-.]\d{1,2})\D*?发[货送]?\s*([\d.]+)/g;
    const batches = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        let date = m[1], qty = parseFloat(m[2]);
        const parts = date.split(/[-.]/);
        if (parts.length === 3) date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        else if (parts.length === 2) date = `2026-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        batches.push({ date, qty });
    }
    if (batches.length > 0) return batches;

    // 3) Single date
    const sd = text.match(/(\d{4}[-.]\d{1,2}[-.]\d{1,2})/);
    if (sd) {
        const parts = sd[1].split(/[-.]/);
        return [{ date: `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`, qty: null }];
    }

    return [{ date: text.substring(0, 50), qty: null }];
}

// ===== Reference helpers =====
async function findOrCreate(store, tableId, data, nameKey) {
    const name = data[nameKey];
    if (!name) return null;
    if (store[name]) return store[name];
    for (const [k, v] of Object.entries(store)) { if (k.includes(name) || name.includes(k)) return v; }
    console.log(`  + ${tableId.slice(-6)}: ${name}`);
    const resp = await post(`/dynamic/tables/${tableId}/records`, { data, tenantId: TENANT });
    if (resp?.success && resp.data?.recordId) { store[name] = resp.data.recordId; return resp.data.recordId; }
    return null;
}

function parsePackaging(s) {
    if (!s) return [null, null];
    s = s.replace(/[（(].*?[）)]/g, '').replace(/\n/g, '').trim();
    const parts = s.split('+');
    if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
    if (parts.length >= 3) return [parts[0].trim(), parts.slice(1).join('+').trim()];
    return [s, null];
}

function normalizeSurface(name) {
    if (!name) return null;
    const s = name.replace(/\n/g, ' ').trim();
    const map = [
        ['热镀锌', '热镀锌'], ['电镀白锌', '电镀锌'], ['电镀黄锌', '电镀锌'],
        ['电镀锌', '电镀锌'], ['冷镀锌', '电镀锌'], ['本色涂油', '本色涂油'],
        ['本色上油', '本色涂油'], ['涂油', '本色涂油'], ['本色', '本色'],
        ['发黑', '热处理发黑'], ['热处理发黑', '热处理发黑'], ['烤漆', '烤漆'],
        ['涂蜡', '涂蜡'], ['达克罗', '达克罗'], ['玖美特', '玖美特'],
        ['久美特', '玖美特'], ['渗锌', '热镀锌'], ['重铬酸盐', '电镀锌'],
        ['热浸镀锌', '热镀锌'],
    ];
    for (const [pat, mapped] of map) { if (s.includes(pat)) return mapped; }
    return s;
}

function cleanNumber(val) {
    if (!val) return '0';
    let s = String(val).replace(/\n/g, '').replace(/<br>/g, '').trim();
    s = s.replace(/[^\d.\-]/g, '');
    if (!s || s === '-') return '0';
    const n = parseFloat(s);
    return isNaN(n) ? '0' : String(n);
}

function getField(row, patterns) {
    for (const pat of patterns) {
        for (const [k, v] of Object.entries(row)) {
            if (k.includes(pat)) return String(v).replace(/\n/g, ' ').trim();
        }
    }
    return '';
}

// ===== Parse markdown =====
function parseMarkdown(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const blocks = content.split(/\n### (.+)/);
    const results = [];
    let currentMonth = '';

    for (let i = 1; i < blocks.length; i += 2) {
        const title = (blocks[i] || '').trim();
        const body = blocks[i + 1] || '';
        const monthMatch = (blocks[i - 1] || '').match(/## (\d+)月/);
        if (monthMatch) currentMonth = monthMatch[1] + '月';
        if (!title.endsWith('.xlsx')) continue;
        const planName = title.replace('.xlsx', '').trim();

        const lines = body.split('\n');
        const tableLines = [];
        for (const line of lines) {
            const s = line.trim();
            if (s.startsWith('|') && s.endsWith('|')) tableLines.push(s);
            else if (tableLines.length > 0 && !s.startsWith('|')) break;
        }
        if (tableLines.length < 3) continue;

        const headers = tableLines[0].split('|').slice(1, -1).map(c => c.trim().replace(/<br>/g, ''));
        const completionIdx = headers.findIndex(h => h.includes('完成时间'));

        for (let j = 2; j < tableLines.length; j++) {
            const cells = tableLines[j].split('|').slice(1, -1).map(c => c.trim());
            const first = cells[0];
            if (!first || first.includes('合计') || !/^\d+$/.test(first)) continue;

            const row = {};
            for (let k = 0; k < Math.min(cells.length, headers.length); k++) {
                row[headers[k]] = cells[k];
            }
            row._plan = planName;
            row._month = currentMonth;

            const completion = completionIdx >= 0 ? (cells[completionIdx] || '') : '';
            const batches = parseBatches(completion);

            // For assembly items (以上与...配套), use the parent's batches count
            const prodName = getField(row, ['产品名称']);
            const isAssembly = getField(row, ['合同要求量(件)']).includes('以上与') ||
                               getField(row, ['合同要求量\n(件)']).includes('以上与');

            for (const batch of batches) {
                results.push({ ...row, _batchDate: batch.date, _batchQty: batch.qty, _isAssembly: isAssembly, _prodName: prodName });
            }
        }
    }
    return results;
}

// ===== MAIN =====
async function main() {
    // 1. Delete all existing production records
    console.log('=== Clearing old production records ===');
    const existingResp = await post(`/dynamic/tables/${RECORD_TABLE}/records/list`, { page: 1, pageSize: 9999 });
    const existing = existingResp?.data?.items || [];
    console.log(`  Deleting ${existing.length} existing records...`);
    for (const r of existing) {
        await api('DELETE', `/dynamic/tables/${RECORD_TABLE}/records/${r.recordId}`);
    }
    console.log('  Done.');

    // 2. Load existing reference data
    const { surfaces, packs, products } = await loadExisting();
    const prevP = Object.keys(products).length, prevS = Object.keys(surfaces).length, prevK = Object.keys(packs).length;

    // 3. Parse markdown
    const filepath = 'resources/2026/计划/销售计划汇总.md';
    console.log(`\n=== Parsing ${filepath} ===`);
    const plans = parseMarkdown(filepath);
    console.log(`  Total production records to create: ${plans.length}`);

    // 4. Create records
    let created = 0, errors = 0;

    for (let idx = 0; idx < plans.length; idx++) {
        const plan = plans[idx];
        if (idx % 50 === 0 && idx > 0) console.log(`  Progress: ${idx}/${plans.length} (created=${created}, errors=${errors})`);

        const planName = plan._plan;
        const prodName = getField(plan, ['产品名称']).replace(/<br>/g, '');
        const orderNum = getField(plan, ['生产令号']).replace(/<br>/g, '');
        const contract = getField(plan, ['合同号P.O.', '合同号P.O.\n']).replace(/<br>/g, '');
        const material = getField(plan, ['材质\n(原材料)', '材质']).replace(/<br>/g, '');
        const spec = getField(plan, ['型号及规格']).replace(/<br>/g, '');
        const weight = getField(plan, ['净重\n(KG/件)', '净重']).replace(/<br>/g, '');
        const surfaceRaw = getField(plan, ['表面处理']).replace(/<br>/g, '');
        const packRaw = getField(plan, ['包装物']).replace(/<br>/g, '');
        const contractQtyRaw = getField(plan, ['合同要求量\n(件)', '合同要求量']);
        const planQtyRaw = getField(plan, ['计划生产数量\n(件)', '计划生产数量']);

        // Use batch qty if available, otherwise use the row qty
        let contractQty = '0', planQty = '0';
        if (plan._batchQty) {
            contractQty = String(plan._batchQty);
            planQty = String(Math.ceil(plan._batchQty * 1.005)); // ~0.5% over for buffer
        } else {
            if (contractQtyRaw && !contractQtyRaw.includes('以上与')) contractQty = cleanNumber(contractQtyRaw);
            if (planQtyRaw && !planQtyRaw.includes('以上与')) planQty = cleanNumber(planQtyRaw);
        }

        const completion = plan._batchDate || '';

        if (!prodName) { errors++; continue; }

        try {
            // Product
            const prodId = await findOrCreate(products, PROD_TABLE, {
                '产品名称': prodName, '产品规格': spec, '原材料': material, '产品净重KG': cleanNumber(weight),
            }, '产品名称');
            if (!prodId) { errors++; continue; }

            // Surface
            const surfNorm = normalizeSurface(surfaceRaw);
            let surfId = null;
            if (surfNorm) surfId = await findOrCreate(surfaces, SURFACE_TABLE, { '工艺名称': surfNorm, '标准': surfaceRaw }, '工艺名称');

            // Packaging
            const [inner, outer] = parsePackaging(packRaw);
            let innerId = null, outerId = null;
            if (inner) innerId = await findOrCreate(packs, PACK_TABLE, { '名称': inner, '材质': '', '规格': '' }, '名称');
            if (outer) outerId = await findOrCreate(packs, PACK_TABLE, { '名称': outer, '材质': '', '规格': '' }, '名称');

            // Create record
            const recordData = {
                '合同号': contract.substring(0, 100),
                '合同数量(件/套)': contractQty,
                '计划产量(件/套)': planQty,
                '完成时间': completion,
                '生产令号': orderNum.substring(0, 100),
                '销售计划编号': planName,
            };
            if (prodId) recordData['产品'] = prodId;
            if (surfId) recordData['表面处理'] = surfId;
            if (innerId) recordData['内包装'] = innerId;
            if (outerId) recordData['外包装'] = outerId;

            const resp = await post(`/dynamic/tables/${RECORD_TABLE}/records`, { data: recordData, tenantId: TENANT });
            if (resp?.success) { created++; }
            else { errors++; if (errors <= 5) console.log(`    Error [${idx}]: ${prodName} | ${(resp?.message || '?').substring(0, 150)}`); }
        } catch (e) {
            errors++;
            if (errors <= 5) console.log(`    Exception [${idx}]: ${e.message}`);
        }
    }

    // Stats
    const newP = Object.keys(products).length - prevP;
    const newS = Object.keys(surfaces).length - prevS;
    const newK = Object.keys(packs).length - prevK;

    console.log(`\n=== DONE ===`);
    console.log(`  Production records: ${created} created, ${errors} errors`);
    console.log(`  Products: ${Object.keys(products).length} (+${newP})`);
    console.log(`  Surfaces: ${Object.keys(surfaces).length} (+${newS})`);
    console.log(`  Packaging: ${Object.keys(packs).length} (+${newK})`);
    console.log(`  Total expected: ${plans.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
