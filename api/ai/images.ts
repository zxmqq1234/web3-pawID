/**
 * POST /api/ai/images：JWS 图片安全代理（唯一写上游的入口）。
 * 安全要点：密钥只在服务端内存；原始 prompt/密钥/图片内容/上游原文不记录；
 * 同 requestId 重试派生稳定 Idempotency-Key；体积与超时处处设限。
 * 说明：测试文件在 tsconfig.app.json 的 include 内，这里用到的 Buffer/超时类型
 * 做最小本地声明，不引入 @types/node 等新依赖。
 */

/** 最小 Buffer 形态（仅 consultation 字节长度与 base64 解码）。 */
interface MinimalBuffer {
  byteLength: (text: string, encoding?: string) => number;
  from: (data: string, encoding?: string) => { toString: (encoding?: string) => string };
  isBuffer: (value: unknown) => boolean;
}

/** 全局 Buffer 最小声明（运行时由 Node 提供，缺失则回落 TextEncoder）。 */
declare const Buffer:
  | (MinimalBuffer & {
      new (...args: never[]): never;
    })
  | undefined;
import {
  buildUpstreamUrl,
  getJwsConfig,
  getProcessEnv,
  type EnvTable,
} from '../_shared/config.js';
import { jwsError } from '../_shared/errors.js';
import {
  checkRateLimit,
  clientKey,
  idempotencyKeyFor,
  isOriginAllowed,
  resetRateLimitState,
  securityHeaders,
} from '../_shared/security.js';
import {
  callUpstreamGenerations,
  extractSafeImages,
  extractUpstreamModel,
} from '../_shared/upstream.js';
import {
  isJsonContentType,
  isValidRequestId,
  validateImageRequest,
} from '../_shared/validate.js';

/** 测试可重置内存限流（生产无须调用）。 */
export { resetRateLimitState };

/** Vercel 请求最小形态（覆盖真实运行时常用字段）。 */
export interface ImagesRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  /** Vercel/Node 可能已解析 body；此处同时兼容字符串与对象。 */
  body?: unknown;
  socket?: { remoteAddress?: string };
}

/** Vercel 响应最小形态。 */
export interface ImagesResponse {
  status: (code: number) => ImagesResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

/** 可注入的依赖（测试伪造 fetch/env，生产用默认）。 */
export interface ImagesDeps {
  env?: EnvTable;
  fetchImpl?: typeof fetch;
  /** 直接给已读出的原始体（测试/无 body-parser 环境用）。 */
  rawBody?: string;
  /** body 读取器（真实 Node 请求流用）。 */
  readBody?: (req: ImagesRequest, maxBytes: number) => Promise<string | null>;
}

/** 取单值请求头（数组取首个，键名大小写不敏感）。 */
function headerValue(
  headers: ImagesRequest['headers'],
  name: string,
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

/** 求 UTF-8 字节长度（优先 Node Buffer，无则回落 TextEncoder）。 */
function utf8Length(text: string): number {
  try {
    if (typeof Buffer !== 'undefined' && Buffer?.byteLength) {
      return Buffer.byteLength(text, 'utf8');
    }
  } catch {
    // 取长度失败则回落估算，不中断安全校验。
  }
  return new TextEncoder().encode(text).length;
}

/** 从 Node 可读流限字节读取（超限返回 null，上层报 PAYLOAD_TOO_LARGE）。 */
async function readNodeBody(
  req: ImagesRequest,
  maxBytes: number,
): Promise<string | null> {
  const stream = req as unknown as {
    on?: (event: string, listener: (chunk?: unknown) => void) => void;
  };
  const onFn = stream.on;
  if (!onFn) return null;
  return new Promise((resolve) => {
    let received = 0;
    let out = '';
    let settled = false;
    const done = (value: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    onFn.call(stream, 'data', (chunk: unknown) => {
      if (settled) return;
      let text = '';
      if (typeof chunk === 'string') text = chunk;
      else {
        try {
          if (typeof Buffer !== 'undefined' && Buffer?.isBuffer?.(chunk)) {
            text = Buffer.from(chunk as string, 'utf8').toString('utf8');
          }
        } catch {
          text = '';
        }
      }
      received += utf8Length(text);
      if (received > maxBytes) {
        done(null);
        return;
      }
      out += text;
    });
    onFn.call(stream, 'end', () => done(out));
    onFn.call(stream, 'error', () => done(''));
  });
}

/**
 * 生图代理处理器。
 * 顺序：方法 -> Content-Type -> 体积 -> Origin -> 配置 -> 限流 -> 字段校验
 *      -> 上游调用 -> 安全提取；任何一步失败都返回无敏感细节的错误码。
 */
export async function imagesHandler(
  req: ImagesRequest,
  res: ImagesResponse,
  deps: ImagesDeps = {},
): Promise<void> {
  for (const [name, value] of Object.entries(securityHeaders())) {
    res.setHeader?.(name, value);
  }
  const env = deps.env ?? getProcessEnv();

  if ((req.method ?? '').toUpperCase() !== 'POST') {
    res.status(405).json(jwsError('METHOD_NOT_ALLOWED'));
    return;
  }
  if (!isJsonContentType(headerValue(req.headers, 'content-type'))) {
    res.status(415).json(jwsError('UNSUPPORTED_MEDIA_TYPE'));
    return;
  }

  // 先读配置拿到体积上限；配置缺失时用保守默认做体量检查，避免大体攻击。
  const { config: early } = getJwsConfig(env);
  const bodyLimit = early?.maxBodyBytes ?? 32 * 1024;

  let parsed: unknown;
  if (typeof req.body === 'string') {
    if (utf8Length(req.body) > bodyLimit) {
      res.status(413).json(jwsError('PAYLOAD_TOO_LARGE'));
      return;
    }
    try {
      parsed = req.body ? JSON.parse(req.body) : null;
    } catch {
      res.status(400).json(jwsError('INVALID_REQUEST'));
      return;
    }
  } else if (req.body && typeof req.body === 'object') {
    parsed = req.body;
    if (utf8Length(JSON.stringify(req.body)) > bodyLimit) {
      res.status(413).json(jwsError('PAYLOAD_TOO_LARGE'));
      return;
    }
  } else {
    const reader = deps.readBody ?? readNodeBody;
    const text =
      deps.rawBody !== undefined ? deps.rawBody : await reader(req, bodyLimit);
    if (text === null) {
      res.status(413).json(jwsError('PAYLOAD_TOO_LARGE'));
      return;
    }
    if (!text) {
      res.status(400).json(jwsError('INVALID_REQUEST'));
      return;
    }
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(400).json(jwsError('INVALID_REQUEST'));
      return;
    }
  }

  // 提前取出 requestId：合法才用于限流键与错误回显；非法不回显原文。
  const maybeId =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>).requestId
      : undefined;
  const requestIdEcho = isValidRequestId(maybeId) ? maybeId : undefined;

  const { config } = getJwsConfig(env);
  if (!config) {
    res.status(503).json(jwsError('CONFIG_MISSING', requestIdEcho));
    return;
  }

  // 同源校验只在配置显式开启时严格执行，默认兼容静态预览。
  const origin = headerValue(req.headers, 'origin');
  const host =
    headerValue(req.headers, 'x-forwarded-host') ??
    headerValue(req.headers, 'host');
  if (!isOriginAllowed(origin, host, config)) {
    res.status(403).json(jwsError('ORIGIN_FORBIDDEN', requestIdEcho));
    return;
  }

  const key = clientKey(
    headerValue(req.headers, 'x-forwarded-for'),
    req.socket?.remoteAddress ?? null,
    requestIdEcho ?? 'anonymous',
  );
  if (!checkRateLimit(key, config)) {
    res.status(429).json(jwsError('RATE_LIMITED', requestIdEcho));
    return;
  }

  const valid = validateImageRequest(parsed, config.maxPromptLength);
  if (!valid) {
    res.status(400).json(jwsError('INVALID_REQUEST', requestIdEcho));
    return;
  }

  // 同 requestId 必然得到同一幂等键，支持安全重试且不泄露原文。
  const idempotencyKey = idempotencyKeyFor(valid.requestId);
  let upstreamUrl: string;
  try {
    upstreamUrl = buildUpstreamUrl(config);
  } catch {
    res.status(503).json(jwsError('CONFIG_MISSING', valid.requestId));
    return;
  }

  const upstream = await callUpstreamGenerations(
    config,
    upstreamUrl,
    valid,
    idempotencyKey,
    deps.fetchImpl ?? fetch,
  );
  if (upstream.timeout) {
    res.status(504).json(jwsError('UPSTREAM_TIMEOUT', valid.requestId));
    return;
  }
  if (!upstream.ok) {
    res.status(502).json(jwsError('UPSTREAM_ERROR', valid.requestId));
    return;
  }

  let payload: unknown;
  try {
    payload = upstream.text ? JSON.parse(upstream.text) : null;
  } catch {
    res.status(502).json(jwsError('UPSTREAM_ERROR', valid.requestId));
    return;
  }
  const images = extractSafeImages(
    payload,
    valid.count ?? 1,
    config.maxImageBytes,
  );
  if (images.length === 0) {
    res.status(502).json(jwsError('UPSTREAM_ERROR', valid.requestId));
    return;
  }
  // 输出只含前端需要的图片引用、请求 ID 与模型标识。
  res.status(200).json({
    ok: true,
    requestId: valid.requestId,
    model: extractUpstreamModel(payload) ?? config.model,
    images,
  });
}

/** Vercel 入口：仅支持 POST images。 */
export default async function handler(
  req: ImagesRequest,
  res: ImagesResponse,
): Promise<void> {
  await imagesHandler(req, res, { env: getProcessEnv() });
}
