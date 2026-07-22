#!/usr/bin/env node
/**
 * Import sales plan markdown data into production records.
 * Usage: node scripts/import_sales_plan.js
 */
const fs = require('fs');
const http = require('http');
const https = require('https');

const API_BASE = 'http://localhost:3001/api';
const TOKEN = process.argv[2] || '';
const TENANT = '1ccfa701-ce7e-4d83-b2a0-ae204b08dffc';

// Table IDs
const PROD_TABLE = 'tblSqVPFfuLQSVo';
const SURFACE_TABLE = 'tbldDgdooUoLSsX';
const PACK_TABLE = 'tbl50ETwgSREdl0';
const RECORD_TABLE = 'tblYM9eBk8UqpKS';

// Simple HTTP client
function api(method, path, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);
        const body = data ? JSON.stringify(data) : undefined;
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
            },
        };
        const req = http.request(options, (res) => {
            let chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
                } catch (e) {
                    resolve({ success: false, message: 'JSON parse error' });
                }
            });
        });
        req.on('error', (e) => resolve({ success: false, message: e.message }));
        if (body) req.write(body);
        req.end();
    });
}

function apiPost(path, data) { return api('POST', path, data); }
function apiPut(path, data) { return api('PUT', path, data); }
function apiGet(path) { return api('GET', path); }

// ===== Load existing reference records =====
async function loadExisting() {
    console.log('=== Loading existing data ===');

    const surfResp = await apiPost(`/dynamic/tables/${SURFACE_TABLE}/records/list`, { page: 1, pageSize: 200 });
    const surfaces = {};
    for (const r of (surfResp?.data?.items || [])) {
        const name = r.data?.['工艺名称'];
        if (name) surfaces[name] = r.recordId;
    }
    console.log(`  Surfaces (${Object.keys(surfaces).length}):`, Object.keys(surfaces));

    const packResp = await apiPost(`/dynamic/tables/${PACK_TABLE}/records/list`, { page: 1, pageSize: 200 });
    const packs = {};
    for (const r of (packResp?.data?.items || [])) {
        const d = r.data || {};
        const name = d['名称'] || '';
        const mat = d['材质'] || '';
        const spec = d['规格'] || '';
        if (name) {
            packs[name] = r.recordId;
            if (mat) packs[`${name}|${mat}`] = r.recordId;
            if (spec) packs[`${name}|${spec}`] = r.recordId;
        }
    }
    console.log(`  Packages (${Object.keys(packs).length} keys):`, Object.keys(packs));

    const prodResp = await apiPost(`/dynamic/tables/${PROD_TABLE}/records/list`, { page: 1, pageSize: 200 });
    const products = {};
    for (const r of (prodResp?.data?.items || [])) {
        const name = r.data?.['产品名称'];
        if (name) products[name] = r.recordId;
    }
    console.log(`  Products (${Object.keys(products).length}):`, Object.keys(products));

    return { surfaces, packs, products };
}

// ===== Parse markdown =====
function parseMarkdown(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    console.log(`\n=== Parsing markdown (${content.length} chars) ===`);

    const results = [];
    let currentMonth = '';

    // Split by ### headings
    const blocks = content.split(/\n### (.+)/);

    for (let i = 1; i < blocks.length; i += 2) {
        const title = (blocks[i] || '').trim();
        const body = blocks[i + 1] || '';

        // Detect month
        const monthMatch = (blocks[i - 1] || '').match(/## (\d+)月/);
        if (monthMatch) currentMonth = monthMatch[1] + '月';

        if (!title.endsWith('.xlsx')) continue;
        const planName = title.replace('.xlsx', '').trim();

        // Parse the table in body
        const rows = parseTable(body);
        if (rows.length > 0) {
            for (const row of rows) {
                row._plan = planName;
                row._month = currentMonth;
            }
            results.push(...rows);
            console.log(`  ${planName}: ${rows.length} rows`);
        }
    }

    return results;
}

function parseTable(text) {
    const lines = text.split('\n');

    // Collect all pipe-delimited lines until a non-pipe line
    const tableLines = [];
    for (const line of lines) {
        const s = line.trim();
        if (s.startsWith('|') && s.endsWith('|')) {
            tableLines.push(s);
        } else if (tableLines.length > 0 && !s.startsWith('|')) {
            break;
        }
    }

    if (tableLines.length < 3) return [];

    // Parse headers
    const headerCells = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
    const headers = headerCells.map(h => h.replace(/<br>/g, '').replace(/\n/g, '').trim());

    // Parse data rows
    const rows = [];
    for (let i = 2; i < tableLines.length; i++) {
        const cells = tableLines[i].split('|').slice(1, -1).map(c => c.trim());
        if (cells.length < 2) continue;
        const first = cells[0];
        if (!first || first.includes('合计') || !/^\d+$/.test(first)) continue;

        const row = {};
        for (let j = 0; j < Math.min(cells.length, headers.length); j++) {
            row[headers[j]] = cells[j];
        }
        if (Object.keys(row).length > 0) rows.push(row);
    }

    return rows;
}

// ===== Helpers =====
async function findOrCreate(store, tableId, data, nameKey) {
    const name = data[nameKey];
    if (!name) return null;
    if (store[name]) return store[name];

    // Fuzzy match
    for (const [k, v] of Object.entries(store)) {
        if (k.includes(name) || name.includes(k)) return v;
    }

    console.log(`  + Creating in ${tableId}: ${name}`);
    const resp = await apiPost(`/dynamic/tables/${tableId}/records`, {
        data,
        tenantId: TENANT,
    });
    if (resp?.success && resp.data?.recordId) {
        store[name] = resp.data.recordId;
        return resp.data.recordId;
    }
    return null;
}

function parsePackaging(packStr) {
    if (!packStr) return [null, null];
    let s = packStr.replace(/[（(].*?[）)]/g, '').replace(/\n/g, '').trim();
    const parts = s.split('+');
    if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
    if (parts.length >= 3) return [parts[0].trim(), parts.slice(1).join('+').trim()];
    return [s, null];
}

function normalizeSurface(name) {
    if (!name) return null;
    const s = name.replace(/\n/g, ' ').trim();
    // Ordered patterns
    const map = [
        ['热镀锌', '热镀锌'], ['电镀白锌', '电镀锌'], ['电镀黄锌', '电镀锌'],
        ['电镀锌', '电镀锌'], ['冷镀锌', '电镀锌'], ['本色涂油', '本色涂油'],
        ['本色上油', '本色涂油'], ['涂油', '本色涂油'], ['本色', '本色'],
        ['发黑', '热处理发黑'], ['热处理发黑', '热处理发黑'], ['烤漆', '烤漆'],
        ['涂蜡', '涂蜡'], ['达克罗', '达克罗'], ['玖美特', '玖美特'],
        ['久美特', '玖美特'], ['渗锌', '热镀锌'], ['重铬酸盐', '电镀锌'],
    ];
    for (const [pat, mapped] of map) {
        if (s.includes(pat)) return mapped;
    }
    return s;
}

function cleanNumber(val) {
    if (!val) return '0';
    let s = String(val).replace(/\n/g, '').trim();
    s = s.replace(/[^\d.\-]/g, '').split('<br>')[0];
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

// ===== Main =====
async function main() {
    const { surfaces, packs, products } = await loadExisting();
    const prevProd = Object.keys(products).length;
    const prevSurf = Object.keys(surfaces).length;
    const prevPack = Object.keys(packs).length;

    const filepath = 'resources/2026/计划/销售计划汇总.md';
    const plans = parseMarkdown(filepath);
    console.log(`\nTotal rows to process: ${plans.length}`);

    let created = 0, errors = 0;

    for (let idx = 0; idx < plans.length; idx++) {
        const plan = plans[idx];
        if (idx % 100 === 0 && idx > 0) {
            console.log(`  Progress: ${idx}/${plans.length} (created=${created}, errors=${errors})`);
        }

        const planName = plan._plan || '';
        const prodName = getField(plan, ['产品名称', '产品\n名称']);
        if (!prodName) { errors++; continue; }

        const orderNum = getField(plan, ['生产令号']);
        const contract = getField(plan, ['合同号P.O.', '合同号P.O.\n']);

        const contractQtyRaw = getField(plan, ['合同要求量\n(件)', '合同要求量']);
        let contractQty = '0';
        if (contractQtyRaw && !contractQtyRaw.includes('以上与')) {
            contractQty = cleanNumber(contractQtyRaw);
        }

        const planQtyRaw = getField(plan, ['计划生产数量\n(件)', '计划生产数量']);
        let planQty = '0';
        if (planQtyRaw && !planQtyRaw.includes('以上与')) {
            planQty = cleanNumber(planQtyRaw);
        }

        const completion = getField(plan, ['完成时间']).substring(0, 100);
        const surfaceRaw = getField(plan, ['表面处理']);
        const packRaw = getField(plan, ['包装物']);
        const material = getField(plan, ['材质\n(原材料)', '材质']);
        const spec = getField(plan, ['型号及规格']);
        const weight = getField(plan, ['净重\n(KG/件)', '净重']);

        try {
            // 1. Product
            const prodId = await findOrCreate(products, PROD_TABLE, {
                '产品名称': prodName,
                '产品规格': spec || '',
                '原材料': material || '',
                '产品净重KG': cleanNumber(weight),
            }, '产品名称');
            if (!prodId) { errors++; continue; }

            // 2. Surface treatment
            const surfNorm = normalizeSurface(surfaceRaw);
            let surfId = null;
            if (surfNorm) {
                surfId = await findOrCreate(surfaces, SURFACE_TABLE, {
                    '工艺名称': surfNorm,
                    '标准': surfaceRaw || '',
                }, '工艺名称');
            }

            // 3. Packaging
            const [inner, outer] = parsePackaging(packRaw);
            let innerId = null, outerId = null;
            if (inner) {
                innerId = await findOrCreate(packs, PACK_TABLE, {
                    '名称': inner,
                    '材质': '',
                    '规格': '',
                }, '名称');
            }
            if (outer) {
                outerId = await findOrCreate(packs, PACK_TABLE, {
                    '名称': outer,
                    '材质': '',
                    '规格': '',
                }, '名称');
            }

            // 4. Create production record
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

            const resp = await apiPost(`/dynamic/tables/${RECORD_TABLE}/records`, {
                data: recordData,
                tenantId: TENANT,
            });

            if (resp?.success) {
                created++;
            } else {
                errors++;
                if (errors <= 5) {
                    console.log(`    Error [${idx}]: ${prodName} | ${(resp?.message || '?').substring(0, 150)}`);
                }
            }
        } catch (e) {
            errors++;
            if (errors <= 5) console.log(`    Exception [${idx}]: ${e.message}`);
        }
    }

    const newProd = Object.keys(products).length - prevProd;
    const newSurf = Object.keys(surfaces).length - prevSurf;
    const newPack = Object.keys(packs).length - prevPack;

    console.log(`\n=== DONE ===`);
    console.log(`  Production records created: ${created}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  New products: ${newProd} (total: ${Object.keys(products).length})`);
    console.log(`  New surfaces: ${newSurf} (total: ${Object.keys(surfaces).length})`);
    console.log(`  New packaging: ${newPack} (total: ${Object.keys(packs).length})`);
    console.log(`  Total plans: ${plans.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
