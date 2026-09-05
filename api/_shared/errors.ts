/**
 * JWS 图片代理服务端共享：安全错误码与响应信封。
 * 设计原则：所有对外错误都不携带密钥、原始 prompt、图片内容或上游原始响应。
 */

/** 对外安全错误码（不含任何敏感细节）。 */
export type JwsErrorCode =
  | 'CONFIG_MISSING'
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'ORIGIN_FORBIDDEN'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR';

/** 错误码对应的 HTTP 状态码（对外可恢复语义）。 */
export const JWS_ERROR_STATUS: Record<JwsErrorCode, number> = {
  CONFIG_MISSING: 503,
  INVALID_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  ORIGIN_FORBIDDEN: 403,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
};

/** 错误码对应的用户可读说明（不含敏感信息，可直接展示或重试判断）。 */
export const JWS_ERROR_MESSAGE: Record<JwsErrorCode, string> = {
  CONFIG_MISSING: '图片服务暂未配置，请稍后再试。',
  INVALID_REQUEST: '请求参数不合法，请检查后重试。',
  METHOD_NOT_ALLOWED: '请求方法不支持。',
  UNSUPPORTED_MEDIA_TYPE: '请求格式不支持，需使用 JSON。',
  PAYLOAD_TOO_LARGE: '请求体过大，请缩短后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后再试。',
  ORIGIN_FORBIDDEN: '请求来源不被允许。',
  UPSTREAM_TIMEOUT: '图片服务超时，请稍后重试。',
  UPSTREAM_ERROR: '图片服务暂不可用，请稍后重试。',
};

/** 哪些错误码允许前端自动重试（不含敏感判断逻辑）。 */
export const JWS_RETRYABLE: Record<JwsErrorCode, boolean> = {
  CONFIG_MISSING: true,
  INVALID_REQUEST: false,
  METHOD_NOT_ALLOWED: false,
  UNSUPPORTED_MEDIA_TYPE: false,
  PAYLOAD_TOO_LARGE: false,
  RATE_LIMITED: true,
  ORIGIN_FORBIDDEN: false,
  UPSTREAM_TIMEOUT: true,
  UPSTREAM_ERROR: true,
};

/** 统一失败信封：只含错误码、通用说明与请求 ID。 */
export interface JwsErrorBody {
  ok: false;
  requestId?: string;
  error: {
    code: JwsErrorCode;
    message: string;
    retryable: boolean;
  };
}

/** 构造安全失败体（调用方不得在此拼接上游原文或密钥信息）。 */
export function jwsError(
  code: JwsErrorCode,
  requestId?: string,
): JwsErrorBody {
  return {
    ok: false,
    ...(requestId ? { requestId } : {}),
    error: {
      code,
      message: JWS_ERROR_MESSAGE[code],
      retryable: JWS_RETRYABLE[code],
    },
  };
}
