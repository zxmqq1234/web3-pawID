/**
 * 服务端请求安全工具：幂等键、限流、Origin 校验与安全响应头。
 * 全部逻辑只用 requestId 等非敏感标识，不接触密钥与 prompt 原文。
 * 说明：用纯函数实现稳定哈希，不依赖 Node 内建模块，保持零新增依赖。
 */
import type { JwsConfig } from './config.js';

/** 内存限流桶：key -> 窗口内命中时间戳（进程级最小限流）。 */
const buckets = new Map<string, number[]>();

/** 测试/冷启动时可清空内存限流状态。 */
export function resetRateLimitState(): void {
  buckets.clear();
}

/**
 * 64 位 cyrb53 哈希（纯函数，无外部依赖）。
 * 输出 16 位十六进制，同一输入必然同一输出。
 */
function cyrb53(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const lo = (h2 >>> 0).toString(16).padStart(8, '0');
  const hi = (h1 >>> 0).toString(16).padStart(8, '0');
  return `${hi}${lo}`;
}

/**
 * 由 requestId 派生稳定的幂等键。
 * 同一 requestId 重试得到同一键；只做单向派生，不记录、不回显、不拼密钥。
 */
export function idempotencyKeyFor(requestId: string): string {
  return `pawid-${cyrb53(`pawid-jws:${requestId}`, 7)}${cyrb53(requestId, 97)}`;
}

/**
 * 最小内存滑动窗口限流（按调用方 IP 或 requestId 粒度）。
 * 返回 false 表示应报 RATE_LIMITED。
 */
export function checkRateLimit(key: string, config: JwsConfig): boolean {
  const now = Date.now();
  const windowStart = now - config.rateLimitWindowMs;
  const hits = buckets.get(key) ?? [];
  const fresh = hits.filter((t) => t > windowStart);
  if (fresh.length >= config.rateLimitMax) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}

/**
 * 同源 Origin 校验。
 * 仅当 JWS_STRICT_ORIGIN_ENABLED=1/true 且配了白名单时严格开启；
 * 未开启时默认放行，方便纯静态预览与本地开发。
 */
export function isOriginAllowed(
  origin: string | null,
  host: string | null,
  config: JwsConfig,
): boolean {
  if (!config.strictOrigin || config.allowedOrigins.length === 0) return true;
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (config.allowedOrigins.includes(parsed.origin)) return true;
  // 同源兜底：Origin 的 host 与当前请求 Host 一致即放行。
  if (host && parsed.host.toLowerCase() === host.toLowerCase()) return true;
  return false;
}

/** 统一安全响应头：禁缓存、防嗅探、最小引用来源。 */
export function securityHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

/**
 * 从请求头取客户端标识（限流用，不做身份认证）。
 * 优先 x-forwarded-for 首段，否则回落远端地址。
 */
export function clientKey(
  forwardedFor: string | null,
  remoteAddress: string | null,
  fallback: string,
): string {
  const first = forwardedFor?.split(',', 1)[0]?.trim();
  if (first) return `ip:${first.slice(0, 64)}`;
  if (remoteAddress) return `ip:${remoteAddress.slice(0, 64)}`;
  return `id:${fallback.slice(0, 128)}`;
}
