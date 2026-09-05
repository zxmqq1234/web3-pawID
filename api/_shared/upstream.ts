/**
 * 上游 JWS 请求与响应提取：最小中转、超时、体积上限。
 * 说明：工作区无 JWS 图片 API 文档原文，不猜供应商特有字段；
 * 上游请求体只含本站规范化字段 + 环境变量模型，不拼密钥进 URL。
 */
import type { JwsConfig } from './config.js';
import type { ValidImageRequest } from './validate.js';

/** 上游调用结果：成功返回原文字符串（调用方负责安全提取）。 */
export interface UpstreamResult {
  ok: boolean;
  /** 超时标记，上层映射为 UPSTREAM_TIMEOUT。 */
  timeout: boolean;
  /** 上游 HTTP 状态码（仅内部判断用，不直接回显）。 */
  status: number;
  /** 上游响应文本（已截断到体积上限，不做日志）。 */
  text: string;
}

/** 允许的图片 URL 协议（防 javascript:/data: 注入）。 */
const SAFE_URL_PROTOCOLS = new Set(['https:', 'http:']);

/** base64 字符白名单（防超大非法串进入解码）。 */
const BASE64_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/** 图片对象提取后的安全形态（只留前端需要的引用）。 */
export interface SafeImageItem {
  url?: string;
  b64?: string;
  revisedPrompt?: string;
}

/**
 * 估算 base64 解码后字节数（不实际解码，避免大串占内存）。
 * 长度必须为 4 的倍数近似值，非法字符直接判超限。
 */
export function base64ByteSize(b64: string): number {
  if (!b64 || b64.length > 12 * 1024 * 1024) return Number.MAX_SAFE_INTEGER;
  if (!BASE64_PATTERN.test(b64)) return Number.MAX_SAFE_INTEGER;
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** 校验图片 URL 安全（只放行 http/https，长度受限）。 */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return SAFE_URL_PROTOCOLS.has(parsed.protocol);
}

/**
 * 从未知上游 JSON 中提取图片引用（兼容 data[] 与 images[] 两种常见包法）。
 * 只取 url / b64_json / b64 三种引用字段；修订提示只取短文本且不回显原文 prompt。
 * 超过数量与体积上限的条目会被丢弃，调用方按“零条目=上游错误”处理。
 */
export function extractSafeImages(
  payload: unknown,
  maxImages: number,
  maxImageBytes: number,
): SafeImageItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const list = Array.isArray(root.data)
    ? root.data
    : Array.isArray(root.images)
      ? root.images
      : null;
  if (!list) return [];
  const out: SafeImageItem[] = [];
  const limit = Math.min(Math.max(maxImages, 1), 4);
  for (const entry of list) {
    if (out.length >= limit) break;
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const safe: SafeImageItem = {};
    const url = item.url;
    if (isSafeImageUrl(url)) safe.url = url;
    const b64 =
      typeof item.b64_json === 'string'
        ? item.b64_json
        : typeof item.b64 === 'string'
          ? item.b64
          : undefined;
    if (b64 && b64.length <= 12 * 1024 * 1024) {
      if (base64ByteSize(b64) <= maxImageBytes) safe.b64 = b64;
      else continue;
    }
    const revised = item.revised_prompt ?? item.revisedPrompt;
    if (typeof revised === 'string' && revised.trim()) {
      const text = revised.trim();
      if (text.length <= 2000) safe.revisedPrompt = text;
    }
    if (safe.url || safe.b64) out.push(safe);
  }
  return out;
}

/** 上游返回的模型标识提取（只取短字符串，不回显多余字段）。 */
export function extractUpstreamModel(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const model = (payload as Record<string, unknown>).model;
  if (typeof model !== 'string') return undefined;
  const trimmed = model.trim();
  if (!trimmed || trimmed.length > 128) return undefined;
  return trimmed;
}

/**
 * 调用上游生图接口（Node 内建 fetch + AbortSignal 超时）。
 * 密钥只放 Authorization 头；请求体由环境变量决定路径/模型，不猜文档外字段。
 * fetch 可注入，便于测试伪造上游；默认用全局 fetch。
 */
export async function callUpstreamGenerations(
  config: JwsConfig,
  url: string,
  body: ValidImageRequest,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      // 最小请求体：模型由环境变量决定，规格字段只透传白名单内的值。
      body: JSON.stringify({
        model: config.model,
        prompt: body.prompt,
        ...(body.size ? { size: body.size } : {}),
        ...(body.style ? { style: body.style } : {}),
        ...(body.quality ? { quality: body.quality } : {}),
        ...(body.count ? { n: body.count } : {}),
      }),
      signal: controller.signal,
    });
    const text = await readBoundedText(
      response,
      config.maxUpstreamBytes,
      controller.signal,
    );
    return {
      ok: response.ok,
      timeout: false,
      status: response.status,
      text,
    };
  } catch (error) {
    const aborted =
      (error as Error)?.name === 'AbortError' || controller.signal.aborted;
    return { ok: false, timeout: aborted, status: 0, text: '' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 有上限地读取上游文本（超限即截断，调用方按解析失败处理）。
 * 不记录、不打印响应内容。
 */
async function readBoundedText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = '';
  try {
    for (;;) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes + 1024) {
        out += decoder.decode(value, { stream: false }).slice(
          0,
          Math.max(0, maxBytes - out.length),
        );
        break;
      }
      out += decoder.decode(value, { stream: true });
      if (out.length > maxBytes) {
        out = out.slice(0, maxBytes);
        break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 锁释放失败不影响错误映射，忽略。
    }
  }
  return out;
}
