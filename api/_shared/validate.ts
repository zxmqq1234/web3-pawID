/**
 * 服务端输入校验：白名单字段、长度与格式。
 * 说明：无文档原文时不猜上游字段；这里只校验前端发给本站的规范化字段。
 */

/** 前端请求 `requestId` 允许的字符与长度（用于幂等键派生）。 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** 单个规格值的长度上限（防大字段占内存）。 */
const SPEC_VALUE_MAX = 64;

/** 生图数量上下限（控制上游成本与响应体积）。 */
const COUNT_MIN = 1;
const COUNT_MAX = 4;

/** 规范化后的生图请求（只含本站契约字段，不直接等同上游字段）。 */
export interface ValidImageRequest {
  prompt: string;
  requestId: string;
  size?: string;
  style?: string;
  quality?: string;
  count?: number;
}

/**
 * 校验 requestId 格式（稳定幂等键的前置条件）。
 * 仅允许 8-128 位字母数字、中划线与下划线。
 */
export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

/**
 * 校验并规范化生图请求体。
 * 返回 null 表示非法请求，上层统一报 INVALID_REQUEST，不回显原始内容。
 */
export function validateImageRequest(
  body: unknown,
  maxPromptLength: number,
): ValidImageRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;

  // 顶层只接受已知字段，多余字段直接拒绝，避免未知数据进入上游。
  for (const key of Object.keys(record)) {
    if (
      key !== 'prompt' &&
      key !== 'requestId' &&
      key !== 'size' &&
      key !== 'style' &&
      key !== 'quality' &&
      key !== 'count'
    ) {
      return null;
    }
  }

  if (!isValidRequestId(record.requestId)) return null;
  if (typeof record.prompt !== 'string') return null;
  const prompt = record.prompt.trim();
  if (!prompt || prompt.length > maxPromptLength) return null;
  // 拒绝不可见控制字符（允许常规换行与制表），防日志/上游注入。
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(prompt)) return null;

  const out: ValidImageRequest = {
    prompt,
    requestId: record.requestId as string,
  };

  for (const key of ['size', 'style', 'quality'] as const) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > SPEC_VALUE_MAX) return null;
    if (!/^[A-Za-z0-9_.x:-]+$/.test(trimmed)) return null;
    out[key] = trimmed;
  }

  const count = record.count;
  if (count !== undefined) {
    if (typeof count !== 'number' || !Number.isInteger(count)) return null;
    if (count < COUNT_MIN || count > COUNT_MAX) return null;
    out.count = count;
  }

  return out;
}

/**
 * 检查 Content-Type 是否为 JSON（忽略大小写与 charset 参数）。
 * 避免表单/二进制请求绕过体大小与字段校验。
 */
export function isJsonContentType(header: string | null | undefined): boolean {
  if (!header) return false;
  const mediaType = header.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}
