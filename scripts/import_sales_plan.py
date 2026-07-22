#!/usr/bin/env python3
"""
Import sales plan data into production records.
Parses the sales plan markdown and creates records via API.
"""
import json, re, sys, urllib.request, urllib.error

API = "http://localhost:3001/api"
TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""
TENANT = "1ccfa701-ce7e-4d83-b2a0-ae204b08dffc"

PROD_TABLE = "tblSqVPFfuLQSVo"
SURFACE_TABLE = "tbldDgdooUoLSsX"
PACK_TABLE = "tbl50ETwgSREdl0"
RECORD_TABLE = "tblYM9eBk8UqpKS"

def api_call(method, path, data=None):
    url = f"{API}{path}"
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='replace')
        return {"success": False, "message": f"HTTP {e.code}: {err[:200]}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}

def api_get(path):
    return api_call("GET", path)

def api_post(path, data):
    return api_call("POST", path, data)

def api_put(path, data):
    return api_call("PUT", path, data)

# ===== Load existing reference records =====
print("=== Loading existing data ===")

surf_resp = api_post(f"/dynamic/tables/{SURFACE_TABLE}/records/list", {"page":1,"pageSize":200})
surfaces = {}
for r in surf_resp.get("data",{}).get("items",[]):
    d = r.get("data",{})
    name = d.get("工艺名称","")  # 工艺名称
    if name: surfaces[name] = r["recordId"]
print(f"  Surfaces: {list(surfaces.keys())}")

pack_resp = api_post(f"/dynamic/tables/{PACK_TABLE}/records/list", {"page":1,"pageSize":200})
packs = {}
for r in pack_resp.get("data",{}).get("items",[]):
    d = r.get("data",{})
    name = d.get("名称","")  # 名称
    mat = d.get("材质","")   # 材质
    spec = d.get("规格","")  # 规格
    rid = r["recordId"]
    packs[name] = rid
    if mat: packs[f"{name}|{mat}"] = rid
    if spec: packs[f"{name}|{spec}"] = rid
print(f"  Packaging keys: {list(packs.keys())}")

prod_resp = api_post(f"/dynamic/tables/{PROD_TABLE}/records/list", {"page":1,"pageSize":200})
products = {}
for r in prod_resp.get("data",{}).get("items",[]):
    d = r.get("data",{})
    name = d.get("产品名称","")  # 产品名称
    if name: products[name] = r["recordId"]
print(f"  Products: {list(products.keys())}")

# ===== Helper functions =====
def find_or_create_surface(name, standard=""):
    if not name: return None
    name = name.strip()
    if name in surfaces:
        return surfaces[name]
    for sname, sid in surfaces.items():
        if sname in name or name in sname:
            return sid
    print(f"  + Creating surface: {name}")
    resp = api_post(f"/dynamic/tables/{SURFACE_TABLE}/records", {
        "data": {"工艺名称": name, "标准": standard or ""},
        "tenantId": TENANT
    })
    if resp.get("success"):
        rid = resp["data"]["recordId"]
        surfaces[name] = rid
        return rid
    return None

def find_or_create_pack(name, material="", spec=""):
    if not name: return None
    name = name.strip()
    if name in packs:
        return packs[name]
    key = f"{name}|{material}" if material else ""
    if key and key in packs:
        return packs[key]
    for k, pid in packs.items():
        if name in k or k in name:
            return pid
    print(f"  + Creating packaging: {name}")
    resp = api_post(f"/dynamic/tables/{PACK_TABLE}/records", {
        "data": {"名称": name, "材质": material, "规格": spec},
        "tenantId": TENANT
    })
    if resp.get("success"):
        rid = resp["data"]["recordId"]
        packs[name] = rid
        return rid
    return None

def find_or_create_product(name, spec_str="", material="", weight=""):
    if not name: return None
    name = name.strip()
    if name in products:
        return products[name]
    print(f"  + Creating product: {name}")
    data = {"产品名称": name}
    if spec_str: data["产品规格"] = spec_str
    if material: data["原材料"] = material
    if weight:
        try: data["产品净重KG"] = str(float(weight))
        except: pass
    resp = api_post(f"/dynamic/tables/{PROD_TABLE}/records", {
        "data": data, "tenantId": TENANT
    })
    if resp.get("success"):
        rid = resp["data"]["recordId"]
        products[name] = rid
        return rid
    return None

def parse_packaging(pack_str):
    """Split '编织袋+托盘' into (inner, outer)."""
    if not pack_str: return None, None
    pack_str = pack_str.strip()
    # Clean up
    pack_str = re.sub(r'[（(].*?[）)]', '', pack_str).strip()
    pack_str = pack_str.replace('\n', '').strip()

    # Split by +
    parts = pack_str.split('+')
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    if len(parts) >= 3:
        return parts[0].strip(), '+'.join(parts[1:]).strip()
    return pack_str, None

def normalize_surface(name):
    """Map surface treatment to existing record names."""
    if not name: return None
    name = name.strip().replace('\n', ' ')
    # Map patterns
    patterns = [
        (r'热浈锌', '热浈锌'),       # 热镀锌
        (r'电镀白锌', '电镀锌'), # 电镀白锌→电镀锌
        (r'电镀黄锌', '电镀锌'), # 电镀黄锌→电镀锌
        (r'电镀锌', '电镀锌'),       # 电镀锌
        (r'冷镀锌', '电镀锌'),       # 冷镀锌→电镀锌
        (r'本色涂油', '本色涂油'), # 本色涂油
        (r'本色上油', '本色涂油'), # 本色上油→本色涂油
        (r'本色', '本色'),                   # 本色
        (r'发黑', '热处理发黑'), # 发黑→热处理发黑
        (r'热处理发黑', '热处理发黑'), # 热处理发黑
        (r'烤漆', '烤漆'),                   # 烤漆
        (r'涂蜡', '涂蜡'),                   # 涂蜡
        (r'达克罗', '达克罗'),       # 达克罗
        (r'玖美特', '玖美特'),       # 玖美特
        (r'久美特', '玖美特'),       # 久美特→玖美特
        (r'渗锌', '热浈锌'),             # 渗锌→热镀锌
    ]
    for pat, mapped in patterns:
        if pat in name:
            return mapped
    return name

def clean_number(val):
    """Extract numeric value from a cell."""
    if not val: return "0"
    val = str(val).replace('\n', '').strip()
    # Remove units and non-numeric except . and -
    val = re.sub(r'[^\d.\-]', '', val.split('<br>')[0])
    if not val or val == '-': return "0"
    try:
        return str(int(float(val))) if float(val) == int(float(val)) else str(float(val))
    except:
        return "0"

def parse_plan_sections(content):
    """Parse the markdown into (plan_name, month, table_rows) tuples."""
    results = []
    current_month = ""

    # Split by ### headings
    blocks = re.split(r'\n### (.+?)\n', content)

    for i in range(1, len(blocks), 2):
        if i+1 >= len(blocks):
            break
        section_title = blocks[i].strip()
        section_body = blocks[i+1] if i+1 < len(blocks) else ""

        # Detect month from preceding ## headers in the body
        month_match = re.search(r'## (\d+)月', blocks[i-1] if i > 0 else "")
        if month_match:
            current_month = month_match.group(1) + "月"

        # Skip non-plan sections
        if not section_title.endswith('.xlsx'):
            continue

        plan_name = section_title.replace('.xlsx', '').strip()

        # Parse the table in this section
        rows = parse_table(section_body)
        if rows:
            for row in rows:
                row['_plan'] = plan_name
                row['_month'] = current_month
            results.extend(rows)
            print(f"  {plan_name}: {len(rows)} rows")

    return results

def parse_table(text):
    """Parse a markdown table into list of dicts."""
    lines = text.split('\n')

    # Find the table (first sequence of | lines)
    table_lines = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('|') and stripped.endswith('|'):
            table_lines.append(stripped)
            in_table = True
        elif in_table and not stripped.startswith('|'):
            break

    if len(table_lines) < 3:
        return []

    # Parse headers from first line
    header_cells = [c.strip() for c in table_lines[0].split('|')[1:-1]]

    # Normalize headers (clean HTML tags, newlines)
    headers = []
    for h in header_cells:
        h = re.sub(r'<br>', '', h).strip()
        h = h.replace('\n', '')
        headers.append(h)

    # Find data rows (skip separator and header)
    data_rows = []
    for line in table_lines[2:]:
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) < 2: continue
        first = cells[0].strip()
        # Skip 合计 rows and empty
        if '合计' in first or first == '':  # 合计
            continue
        if not re.match(r'^\d+$', first):
            continue

        row = {}
        for j, cell in enumerate(cells):
            if j < len(headers):
                row[headers[j]] = cell.strip()
        if row:
            data_rows.append(row)

    return data_rows

# ===== MAIN =====
filepath = "resources/2026/计划/销售计划汇总.md"
print(f"\n=== Parsing {filepath} ===")
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

plans = parse_plan_sections(content)
print(f"\nTotal plan rows: {len(plans)}")

created = 0
errors = 0
ref_created = {"products": 0, "surfaces": 0, "packs": 0}

# Track pre-existing counts
prev_prod = len(products)
prev_surf = len(surfaces)
prev_pack = len(packs)

for idx, plan in enumerate(plans):
    if idx % 50 == 0:
        print(f"  Processing {idx+1}/{len(plans)}... (created={created}, errors={errors})")

    plan_name = plan.get('_plan', '')

    # Extract fields - handle multi-line header names
    prod_name = plan.get('产品名称', '') or plan.get('产品\n名称', '')  # 产品名称
    if not prod_name:
        errors += 1
        continue

    order_num = plan.get('生产令号', '')  # 生产令号
    contract = plan.get('合同号P.O.', '') or plan.get('合同号P.O.\n', '')  # 合同号

    # Contract quantity
    contract_qty_raw = plan.get('合同要求量\n(件)', '')  # 合同要求量(件)
    if not contract_qty_raw:
        # Try other variants
        for k, v in plan.items():
            if '合同要求量' in k and '件' in k:
                contract_qty_raw = v
                break
    if not contract_qty_raw:
        contract_qty_raw = '0'

    # Skip assembly items (螺母 with bolt, 平垫圈 with 道钉)
    if '以上与' in str(contract_qty_raw):  # 以上与
        contract_qty_raw = '0'

    contract_qty = clean_number(contract_qty_raw)

    # Planned quantity
    plan_qty_raw = ''
    for k, v in plan.items():
        if '计划生产数量' in k and '件' in k:
            plan_qty_raw = v
            break
    if not plan_qty_raw:
        plan_qty_raw = '0'

    if '以上与' in str(plan_qty_raw):  # 以上与
        plan_qty_raw = '0'

    plan_qty = clean_number(plan_qty_raw)

    # Completion time
    completion = ''
    for k, v in plan.items():
        if '完成时间' in k:  # 完成时间
            completion = str(v).replace('\n', ' ').strip()
            break
    completion = completion[:100]

    # Surface treatment
    surface_raw = ''
    for k, v in plan.items():
        if '表面处理' in k:  # 表面处理
            surface_raw = str(v).replace('\n', ' ')
            break

    # Packaging
    pack_raw = ''
    for k, v in plan.items():
        if '包装物' in k:  # 包装物
            pack_raw = str(v).replace('\n', ' ')
            break

    # Material & spec
    material = ''
    for k, v in plan.items():
        if '材质' in k and '原材料' in k:  # 材质(原材料)
            material = str(v).replace('\n', ' ')
            break
    if not material:
        material = plan.get('材质\n(原材料)', '')

    spec = plan.get('型号及规格', '')  # 型号及规格

    weight = ''
    for k, v in plan.items():
        if '净重' in k and 'KG' in k:  # 净重...KG
            weight = str(v).replace('\n', ' ')
            break

    try:
        # 1. Product
        prod_id = find_or_create_product(prod_name, spec or "", material or "", weight or "")
        if not prod_id:
            errors += 1
            continue

        # 2. Surface treatment
        surf_norm = normalize_surface(surface_raw) if surface_raw else None
        surf_id = None
        if surf_norm:
            surf_id = find_or_create_surface(surf_norm, surface_raw or "")

        # 3. Packaging
        inner_pack, outer_pack = parse_packaging(pack_raw) if pack_raw else (None, None)
        inner_id = find_or_create_pack(inner_pack) if inner_pack else None
        outer_id = find_or_create_pack(outer_pack) if outer_pack else None

        # 4. Create production record
        record_data = {
            "合同号": str(contract or "")[:100],
            "合同数量(件/套)": contract_qty,
            "计划产量(件/套)": plan_qty,
            "完成时间": completion,
            "生产令号": str(order_num or "")[:100],
            "销售计划编号": plan_name,
        }
        if prod_id: record_data["产品"] = prod_id
        if surf_id: record_data["表面处理"] = surf_id
        if inner_id: record_data["内包装"] = inner_id
        if outer_id: record_data["外包装"] = outer_id

        resp = api_post(f"/dynamic/tables/{RECORD_TABLE}/records", {
            "data": record_data, "tenantId": TENANT
        })

        if resp.get("success"):
            created += 1
        else:
            errors += 1
            if errors <= 5:
                msg = resp.get('message', '?')
                print(f"    Error: {prod_name} | {msg[:150]}")

    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"    Exception: {e}")

# Count new ref records
new_prod = len(products) - prev_prod
new_surf = len(surfaces) - prev_surf
new_pack = len(packs) - prev_pack

print(f"\n=== DONE ===")
print(f"  Production records created: {created}")
print(f"  Errors: {errors}")
print(f"  New products: {new_prod}")
print(f"  New surfaces: {new_surf}")
print(f"  New packaging: {new_pack}")
print(f"  Total plans processed: {len(plans)}")
