/**
 * JWS 图片代理服务端配置：只读服务端环境变量（禁止客户端可读前缀）。
 * 说明：工作区内没有 JWS 图片 API 文档原文，因此不硬编码供应商域名、
 * 模型名与供应商特有字段；上游地址与模型全部由环境变量决定。
 * 密钥只存在于服务端进程内存，永不返回前端、不拼进 URL、不写日志。
 * 类型说明：env 使用普通键值表，不依赖 Node 类型，保持零新增依赖。
 */

/** 服务端环境变量表（值只读，不做回显）。 */
export type EnvTable = Record<string, string | undefined>;

/** 服务端生效的 JWS 配置（全部为无敏感回显的结构化值）。 */
export interface JwsConfig {
  /** 上游密钥（仅内存使用，禁止回显/日志/返回）。 */
  apiKey: string;
  /** 上游基础地址（已去末尾斜杠；生产要求 https，本地回环允许 http 便于 mock）。 */
  baseUrl: string;
  /** 生图路径（以 / 开头，不含查询串）。 */
  generationsPath: string;
  /** 图片模型标识（由环境变量决定，不猜默认值）。 */
  model: string;
  /** 上游请求超时毫秒。 */
  timeoutMs: number;
  /** prompt 最大字符数。 */
  maxPromptLength: number;
  /** 前端请求体最大字节数。 */
  maxBodyBytes: number;
  /** 单张图片 base64 解码后最大字节数。 */
  maxImageBytes: number;
  /** 上游响应体最大字节数（防大响应占内存）。 */
  maxUpstreamBytes: number;
  /** 限流窗口内最大请求数。 */
  rateLimitMax: number;
  /** 限流窗口毫秒。 */
  rateLimitWindowMs: number;
  /** 是否严格校验 Origin（仅在配置显式开启且配了白名单时生效）。 */
  strictOrigin: boolean;
  /** 允许的来源 Origin 白名单（精确匹配）。 */
  allowedOrigins: string[];
}

/** 配置读取结果：缺失时返回缺失键名，不回显任何值。 */
export interface JwsConfigResult {
  config: JwsConfig | null;
  /** 缺失或非法的必需变量名（只给名字，不给值）。 */
  missing: string[];
}

/** 必需的服务端环境变量（禁止加 VITE_ 前缀）。 */
export const REQUIRED_ENV_KEYS = [
  'JWS_API_KEY',
  'JWS_API_BASE_URL',
  'JWS_IMAGE_MODEL',
  'JWS_IMAGE_GENERATIONS_PATH',
] as const;

/** 解析正整数，非法时回落默认值并钳制到区间。 */
function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** 归一化基础地址：去空格与末尾斜杠，校验协议与可解析性。 */
function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.length > 256 || /\s/.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1';
  // 生产只允许 https；本地回环允许 http，方便用 mock 联调且不猜真实域名。
  if (parsed.protocol === 'https:') return trimmed;
  if (parsed.protocol === 'http:' && isLoopback) return trimmed;
  return null;
}

/** 归一化生图路径：必须以 / 开头，不含空格与查询串。 */
function normalizePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 256) return null;
  if (!trimmed.startsWith('/')) return null;
  if (/\s/.test(trimmed) || trimmed.includes('?') || trimmed.includes('#')) {
    return null;
  }
  return trimmed;
}

/** 归一化模型标识：非空、无空白、长度受限，不猜默认值。 */
function normalizeModel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (/\s/.test(trimmed)) return null;
  return trimmed;
}

/** 解析 Origin 白名单：逗号分隔，精确保存合法 Origin。 */
function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const list: string[] = [];
  for (const part of raw.split(',')) {
    const item = part.trim();
    if (!item) continue;
    try {
      const parsed = new URL(item);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      list.push(parsed.origin);
    } catch {
      continue;
    }
    if (list.length >= 20) break;
  }
  return list;
}

/**
 * 读取服务端 JWS 配置（默认读服务端进程 env，测试可传入自定义表）。
 * 缺任何必需项即返回 config=null，上层统一报 CONFIG_MISSING，不泄露细节。
 */
export function getJwsConfig(env: EnvTable = getProcessEnv()): JwsConfigResult {
  const missing: string[] = [];
  const apiKey = (env.JWS_API_KEY ?? '').trim();
  const baseRaw = (env.JWS_API_BASE_URL ?? '').trim();
  const modelRaw = (env.JWS_IMAGE_MODEL ?? '').trim();
  const pathRaw = (env.JWS_IMAGE_GENERATIONS_PATH ?? '').trim();

  if (!apiKey) missing.push('JWS_API_KEY');
  const baseUrl = baseRaw ? normalizeBaseUrl(baseRaw) : null;
  if (!baseUrl) missing.push('JWS_API_BASE_URL');
  const model = modelRaw ? normalizeModel(modelRaw) : null;
  if (!model) missing.push('JWS_IMAGE_MODEL');
  const generationsPath = pathRaw ? normalizePath(pathRaw) : null;
  if (!generationsPath) missing.push('JWS_IMAGE_GENERATIONS_PATH');

  if (missing.length > 0 || !baseUrl || !model || !generationsPath) {
    return { config: null, missing };
  }

  const strictFlag = (env.JWS_STRICT_ORIGIN_ENABLED ?? '').trim().toLowerCase();
  const config: JwsConfig = {
    apiKey,
    baseUrl,
    generationsPath,
    model,
    timeoutMs: parsePositiveInt(env.JWS_REQUEST_TIMEOUT_MS, 20000, 1000, 60000),
    maxPromptLength: parsePositiveInt(env.JWS_MAX_PROMPT_LENGTH, 2000, 1, 8000),
    maxBodyBytes: parsePositiveInt(env.JWS_MAX_BODY_BYTES, 32 * 1024, 1024, 128 * 1024),
    maxImageBytes: parsePositiveInt(
      env.JWS_MAX_IMAGE_BYTES,
      4 * 1024 * 1024,
      64 * 1024,
      8 * 1024 * 1024,
    ),
    maxUpstreamBytes: parsePositiveInt(
      env.JWS_MAX_UPSTREAM_BYTES,
      8 * 1024 * 1024,
      256 * 1024,
      16 * 1024 * 1024,
    ),
    rateLimitMax: parsePositiveInt(env.JWS_RATE_LIMIT_MAX, 30, 1, 1000),
    rateLimitWindowMs: parsePositiveInt(
      env.JWS_RATE_LIMIT_WINDOW_MS,
      60_000,
      1000,
      600_000,
    ),
    strictOrigin: strictFlag === '1' || strictFlag === 'true',
    allowedOrigins: parseAllowedOrigins(env.JWS_ALLOWED_ORIGINS),
  };
  return { config, missing: [] };
}

/** 读取服务端进程 env（无进程 env 时返回空表，不抛错）。 */
export function getProcessEnv(): EnvTable {
  const holder = globalThis as unknown as {
    process?: { env?: EnvTable };
  };
  return holder.process?.env ?? {};
}

/**
 * 由环境变量决定的上游完整地址（baseUrl + path），不拼密钥与业务参数。
 * 无文档原文时不猜任何供应商域名与端点，完全以配置为准。
 */
export function buildUpstreamUrl(config: JwsConfig): string {
  const full = `${config.baseUrl}${config.generationsPath}`;
  // 构造失败即抛错，上层统一映射为 CONFIG_MISSING，不回显地址细节。
  const parsed = new URL(full);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('invalid upstream url');
  }
  return full;
}
