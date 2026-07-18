/**
 * AI 蓝图生成服务
 *
 * 当前：关键词匹配 → 预制模板库 → 组装蓝图 JSON
 * 后续：接入真实 AI API (Claude/GPT) → 生成自定义蓝图
 */

// ---- 内联类型 ----
type NodeId = string;
interface BlueprintNode { nodeId: NodeId; nodeType: string; label: string; pos: { x: number; y: number }; config: Record<string, unknown>; }
interface BlueprintEdge { edgeId: string; sourceNodeId: NodeId; sourcePortKey: string; targetNodeId: NodeId; targetPortKey: string; }

// ---- 模板定义 ----

interface NodeTemplate {
  nodeType: string;
  label: string;
  pos: { x: number; y: number };
  config: Record<string, unknown>;
}

interface EdgeTemplate {
  sourceNodeIdx: number;
  sourcePort: string;
  targetNodeIdx: number;
  targetPort: string;
}

interface BlueprintTemplate {
  keywords: string[];
  name: string;
  description: string;
  nodes: NodeTemplate[];
  edges: EdgeTemplate[];
}

// ---- 模板库 ----

const TEMPLATES: BlueprintTemplate[] = [
  {
    keywords: ["ocr", "图片", "识别", "文字", "上传"],
    name: "图片 OCR 识别",
    description: "上传图片 → OCR 识别文字 → 展示结果",
    nodes: [
      { nodeType: "core:ui:fileUpload", label: "上传图片", pos: { x: 50, y: 50 }, config: { accept: "image/*", maxSizeMB: 10 } },
      { nodeType: "core:logic:fileMeta", label: "文件信息", pos: { x: 350, y: 50 }, config: {} },
      { nodeType: "core:logic:ocr", label: "OCR 识别", pos: { x: 650, y: 50 }, config: {} },
      { nodeType: "core:ui:input", label: "识别结果", pos: { x: 950, y: 50 }, config: { label: "OCR 结果", placeholder: "识别文字将显示在此" } },
      { nodeType: "core:ui:modal", label: "结果弹窗", pos: { x: 950, y: 220 }, config: { title: "OCR 识别结果", content: "识别完成后弹窗展示" } },
    ],
    edges: [
      { sourceNodeIdx: 0, sourcePort: "fileMeta", targetNodeIdx: 1, targetPort: "fileMeta" },
      { sourceNodeIdx: 1, sourcePort: "url", targetNodeIdx: 2, targetPort: "fileMeta" },
      { sourceNodeIdx: 2, sourcePort: "text", targetNodeIdx: 3, targetPort: "value" },
      { sourceNodeIdx: 2, sourcePort: "text", targetNodeIdx: 4, targetPort: "content" },
    ],
  },
  {
    keywords: ["表单", "提交", "审批", "流程"],
    name: "表单审批流程",
    description: "填写表单 → 条件判断 → 审批通过/拒绝通知",
    nodes: [
      { nodeType: "core:ui:input", label: "申请人", pos: { x: 50, y: 50 }, config: { label: "申请人", placeholder: "请输入姓名" } },
      { nodeType: "core:ui:input", label: "金额", pos: { x: 50, y: 200 }, config: { label: "申请金额", placeholder: "请输入金额" } },
      { nodeType: "core:ui:button", label: "提交审批", pos: { x: 50, y: 350 }, config: { buttonText: "提交审批", variant: "primary" } },
      { nodeType: "core:logic:condition", label: "金额判断", pos: { x: 400, y: 200 }, config: { expression: "return value > 5000" } },
      { nodeType: "core:ui:modal", label: "审批通过", pos: { x: 750, y: 80 }, config: { title: "审批通过", content: "金额在权限范围内，自动通过" } },
      { nodeType: "core:ui:modal", label: "需要复审", pos: { x: 750, y: 300 }, config: { title: "需要复审", content: "金额超出权限，需上级审批" } },
      { nodeType: "core:logic:textFormat", label: "通知消息", pos: { x: 400, y: 420 }, config: { operation: "template", template: "审批申请：{{text}}元" } },
    ],
    edges: [
      { sourceNodeIdx: 2, sourcePort: "trigger", targetNodeIdx: 3, targetPort: "trigger" },
      { sourceNodeIdx: 1, sourcePort: "value", targetNodeIdx: 3, targetPort: "value" },
      { sourceNodeIdx: 3, sourcePort: "true", targetNodeIdx: 4, targetPort: "confirmed" },
      { sourceNodeIdx: 3, sourcePort: "false", targetNodeIdx: 5, targetPort: "confirmed" },
      { sourceNodeIdx: 1, sourcePort: "value", targetNodeIdx: 6, targetPort: "text" },
    ],
  },
  {
    keywords: ["表格", "查询", "数据", "展示", "列表"],
    name: "数据查询展示",
    description: "查询多维表格 → 表格展示结果",
    nodes: [
      { nodeType: "core:logic:tableQuery", label: "数据查询", pos: { x: 50, y: 50 }, config: { tableId: "" } },
      { nodeType: "core:ui:table", label: "数据表格", pos: { x: 400, y: 50 }, config: { title: "查询结果", pageSize: 20 } },
      { nodeType: "core:ui:input", label: "搜索框", pos: { x: 50, y: 220 }, config: { label: "搜索", placeholder: "输入关键字过滤..." } },
      { nodeType: "core:logic:condition", label: "搜索过滤", pos: { x: 400, y: 300 }, config: { expression: "return value && value.length > 0" } },
      { nodeType: "core:ui:button", label: "查询按钮", pos: { x: 50, y: 380 }, config: { buttonText: "查询", variant: "primary" } },
    ],
    edges: [
      { sourceNodeIdx: 4, sourcePort: "trigger", targetNodeIdx: 0, targetPort: "trigger" },
      { sourceNodeIdx: 0, sourcePort: "records", targetNodeIdx: 1, targetPort: "records" },
    ],
  },
  {
    keywords: ["图表", "柱状图", "饼图", "折线", "可视化", "统计"],
    name: "数据可视化",
    description: "查询数据 → 图表展示",
    nodes: [
      { nodeType: "core:logic:tableQuery", label: "数据查询", pos: { x: 50, y: 50 }, config: { tableId: "" } },
      { nodeType: "core:ui:table", label: "数据表格", pos: { x: 400, y: 50 }, config: { title: "明细数据", pageSize: 20 } },
      { nodeType: "core:ui:button", label: "刷新", pos: { x: 50, y: 220 }, config: { buttonText: "刷新数据", variant: "primary" } },
    ],
    edges: [
      { sourceNodeIdx: 2, sourcePort: "trigger", targetNodeIdx: 0, targetPort: "trigger" },
      { sourceNodeIdx: 0, sourcePort: "records", targetNodeIdx: 1, targetPort: "records" },
    ],
  },
  {
    keywords: ["文件", "上传", "管理", "附件", "文档"],
    name: "文件上传管理",
    description: "上传文件 → 查看文件信息 → 写入表格",
    nodes: [
      { nodeType: "core:ui:fileUpload", label: "上传文件", pos: { x: 50, y: 50 }, config: { accept: "*/*", maxSizeMB: 50 } },
      { nodeType: "core:logic:fileMeta", label: "文件信息", pos: { x: 350, y: 50 }, config: {} },
      { nodeType: "core:ui:input", label: "文件名", pos: { x: 650, y: 30 }, config: { label: "文件名", placeholder: "自动填充" } },
      { nodeType: "core:ui:input", label: "文件大小", pos: { x: 650, y: 160 }, config: { label: "大小(KB)", placeholder: "自动填充" } },
      { nodeType: "core:ui:button", label: "确认上传", pos: { x: 650, y: 300 }, config: { buttonText: "确认上传", variant: "primary" } },
    ],
    edges: [
      { sourceNodeIdx: 0, sourcePort: "fileMeta", targetNodeIdx: 1, targetPort: "fileMeta" },
      { sourceNodeIdx: 1, sourcePort: "name", targetNodeIdx: 2, targetPort: "value" },
      { sourceNodeIdx: 1, sourcePort: "size", targetNodeIdx: 3, targetPort: "value" },
    ],
  },
  {
    keywords: ["通知", "提醒", "消息", "告警", "推送"],
    name: "通知提醒",
    description: "触发事件 → 条件判断 → 发送通知",
    nodes: [
      { nodeType: "core:ui:button", label: "触发事件", pos: { x: 50, y: 50 }, config: { buttonText: "触发检查", variant: "primary" } },
      { nodeType: "core:logic:condition", label: "条件判断", pos: { x: 350, y: 50 }, config: { expression: "return value !== undefined" } },
      { nodeType: "core:logic:textFormat", label: "通知内容", pos: { x: 350, y: 220 }, config: { operation: "template", template: "提醒：{{text}}" } },
      { nodeType: "core:ui:modal", label: "通知弹窗", pos: { x: 700, y: 50 }, config: { title: "系统通知", content: "请查看详情" } },
    ],
    edges: [
      { sourceNodeIdx: 0, sourcePort: "trigger", targetNodeIdx: 1, targetPort: "trigger" },
      { sourceNodeIdx: 1, sourcePort: "true", targetNodeIdx: 3, targetPort: "confirmed" },
    ],
  },
  {
    keywords: ["报销", "费用", "发票", "审批"],
    name: "费用报销",
    description: "上传发票 → OCR 识别 → 填写金额 → 提交报销",
    nodes: [
      { nodeType: "core:ui:fileUpload", label: "上传发票", pos: { x: 50, y: 50 }, config: { accept: "image/*", maxSizeMB: 10 } },
      { nodeType: "core:logic:ocr", label: "OCR 识别", pos: { x: 350, y: 50 }, config: {} },
      { nodeType: "core:ui:input", label: "金额", pos: { x: 650, y: 30 }, config: { label: "报销金额", placeholder: "请输入金额" } },
      { nodeType: "core:ui:input", label: "事由", pos: { x: 650, y: 160 }, config: { label: "报销事由", placeholder: "请简述原因" } },
      { nodeType: "core:logic:condition", label: "金额校验", pos: { x: 350, y: 250 }, config: { expression: "return Number(value) <= 5000" } },
      { nodeType: "core:ui:modal", label: "提交成功", pos: { x: 700, y: 300 }, config: { title: "报销提交成功", content: "您的报销申请已提交，请等待审批" } },
      { nodeType: "core:ui:modal", label: "需要审批", pos: { x: 950, y: 80 }, config: { title: "需要上级审批", content: "金额超过 5000 元，需要上级审批" } },
      { nodeType: "core:ui:button", label: "提交", pos: { x: 350, y: 420 }, config: { buttonText: "提交报销", variant: "primary" } },
    ],
    edges: [
      { sourceNodeIdx: 0, sourcePort: "fileMeta", targetNodeIdx: 1, targetPort: "fileMeta" },
      { sourceNodeIdx: 7, sourcePort: "trigger", targetNodeIdx: 4, targetPort: "trigger" },
      { sourceNodeIdx: 2, sourcePort: "value", targetNodeIdx: 4, targetPort: "value" },
      { sourceNodeIdx: 4, sourcePort: "true", targetNodeIdx: 5, targetPort: "confirmed" },
      { sourceNodeIdx: 4, sourcePort: "false", targetNodeIdx: 6, targetPort: "confirmed" },
    ],
  },
];

// ---- 生成服务 ----

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface GenerateResult {
  blueprint: {
    blueprintId: string;
    name: string;
    version: string;
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
    viewport: { x: number; y: number; zoom: number };
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  matchedKeywords: string[];
  templateName: string;
}

export function generateBlueprint(prompt: string): GenerateResult | null {
  const lower = prompt.toLowerCase();

  // 关键词匹配打分
  let bestMatch: BlueprintTemplate | null = null;
  let bestScore = 0;
  const matchedKw: string[] = [];

  for (const tpl of TEMPLATES) {
    let score = 0;
    const matched: string[] = [];
    for (const kw of tpl.keywords) {
      if (lower.includes(kw)) {
        score += kw.length; // 长关键词权重更高
        matched.push(kw);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = tpl;
      matchedKw.length = 0;
      matchedKw.push(...matched);
    }
  }

  if (!bestMatch || bestScore === 0) return null;

  // 组装蓝图
  const nodeIdMap: Record<number, string> = {};
  const nodes: BlueprintNode[] = bestMatch.nodes.map((nt, i) => {
    const id = genId("nd_ai");
    nodeIdMap[i] = id;
    return {
      nodeId: id,
      nodeType: nt.nodeType,
      label: nt.label,
      pos: nt.pos,
      config: nt.config,
    };
  });

  const edges: BlueprintEdge[] = bestMatch.edges.map((et) => ({
    edgeId: genId("e_ai"),
    sourceNodeId: nodeIdMap[et.sourceNodeIdx],
    sourcePortKey: et.sourcePort,
    targetNodeId: nodeIdMap[et.targetNodeIdx],
    targetPortKey: et.targetPort,
  }));

  return {
    blueprint: {
      blueprintId: genId("bp_ai"),
      name: bestMatch.name,
      version: "1.0.0",
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: { generatedBy: "ai_template", prompt },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    matchedKeywords: matchedKw,
    templateName: bestMatch.name,
  };
}
