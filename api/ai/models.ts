/**
 * GET /api/ai/models：返回本站图片模型清单（只读配置，不触密钥）。
 * 说明：无文档原文时不做上游模型查询；模型标识完全来自环境变量。
 */
import { getJwsConfig, getProcessEnv, type EnvTable } from '../_shared/config.js';
import { jwsError } from '../_shared/errors.js';
import { securityHeaders } from '../_shared/security.js';

/** Vercel Node 函数请求最小形态（只用到的字段）。 */
interface ModelsRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/** Vercel Node 函数响应最小形态（status + json/setHeader）。 */
interface ModelsResponse {
  status: (code: number) => ModelsResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

/**
 * 模型查询处理器（可注入 env，无需网络，便于测试）。
 * 成功只返回模型标识；失败返回安全错误码。
 */
export async function modelsHandler(
  req: ModelsRequest,
  res: ModelsResponse,
  env: EnvTable = getProcessEnv(),
): Promise<void> {
  for (const [name, value] of Object.entries(securityHeaders())) {
    res.setHeader?.(name, value);
  }
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    res.status(405).json(jwsError('METHOD_NOT_ALLOWED'));
    return;
  }
  const { config } = getJwsConfig(env);
  if (!config) {
    res.status(503).json(jwsError('CONFIG_MISSING'));
    return;
  }
  // 不回显密钥、地址与路径，只给前端渲染所需的模型标识。
  res.status(200).json({
    ok: true,
    models: [{ id: config.model, kind: 'image' }],
    defaultModel: config.model,
  });
}

/** Vercel 入口：仅支持 GET models。 */
export default async function handler(
  req: ModelsRequest,
  res: ModelsResponse,
): Promise<void> {
  await modelsHandler(req, res, getProcessEnv());
}
