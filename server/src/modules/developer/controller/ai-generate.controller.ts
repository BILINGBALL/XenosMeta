import { Request, Response } from "express";
import { success, fail } from "@utils/response";
import { generateBlueprint } from "../service/ai-generate.service";

class AIGenerateController {
  async generate(req: Request, res: Response) {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return res.status(400).json(fail("请提供至少2个字的自然语言描述"));
    }

    const result = generateBlueprint(prompt.trim());

    if (!result) {
      return res.json(
        fail(
          `未匹配到合适的模板。支持的关键词：OCR/图片识别、表单审批、数据查询、图表、文件上传、通知提醒、费用报销。请尝试更明确的描述。`,
          404,
        ),
      );
    }

    res.json(
      success(
        {
          ...result.blueprint,
          _meta: {
            templateName: result.templateName,
            matchedKeywords: result.matchedKeywords,
            prompt,
          },
        },
        `AI 已生成蓝图「${result.templateName}」`,
      ),
    );
  }
}

export const aiGenerateController = new AIGenerateController();
