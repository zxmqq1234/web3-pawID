// Web3 层统一错误模型：所有链上与钱包操作失败都收敛为带错误码的 Web3Error，
// 保证页面拿到的是"可恢复错误"（有明确原因与中文提示，可重试），而不是裸异常。
// 编码 UTF-8。

/** 钱包与链上操作的稳定错误码，页面据此展示差异化提示。 */
export type Web3ErrorCode =
  | 'NO_WALLET'
  | 'USER_REJECTED'
  | 'WRONG_NETWORK'
  | 'RPC_ERROR'
  | 'RECEIPT_FAILED'
  | 'REGISTRY_NOT_CONFIGURED'
  | 'CONTRACT_ERROR'
  | 'UNEXPECTED';

/** EIP-1193 标准错误码：用户在钱包弹窗中拒绝了请求。 */
const USER_REJECTED_RPC_CODE = 4001;

/** EIP-1193 常见链相关错误码：链未添加（4902）或链参数错误（-32602/-32002）。 */
const CHAIN_ERROR_RPC_CODES = new Set([4902, -32602, -32002]);

/** Web3 层统一错误：携带稳定错误码，message 为面向用户的中文提示。 */
export class Web3Error extends Error {
  /** 稳定错误码，供页面或测试精确分支。 */
  readonly code: Web3ErrorCode;
  /** 原始错误，保留用于排查但不直接暴露给用户。 */
  readonly cause?: unknown;

  constructor(code: Web3ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'Web3Error';
    this.code = code;
    this.cause = cause;
  }
}

/** 从钱包/SDK 抛出的对象上尽力读取数字错误码。 */
function readRpcCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

/** 从错误消息中识别钱包标准文案的用户拒绝场景。 */
function looksLikeUserRejection(message: string): boolean {
  return /user rejected|user denied|rejected the request|user cancelled|用户拒绝/i.test(message);
}

/** 依据 EIP-1193 错误码与常见文案把未知异常归类为稳定错误码。 */
export function classifyWeb3Error(error: unknown): Web3ErrorCode {
  const rpcCode = readRpcCode(error);
  if (rpcCode === USER_REJECTED_RPC_CODE) return 'USER_REJECTED';
  if (rpcCode !== null && CHAIN_ERROR_RPC_CODES.has(rpcCode)) return 'WRONG_NETWORK';
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (looksLikeUserRejection(message)) return 'USER_REJECTED';
  return 'UNEXPECTED';
}

/** 把任意抛出的值收敛为 Web3Error；已是 Web3Error 则原样返回，避免二次包装丢失信息。 */
export function toWeb3Error(error: unknown, fallbackCode: Web3ErrorCode = 'UNEXPECTED'): Web3Error {
  if (error instanceof Web3Error) return error;
  const message = error instanceof Error ? error.message : String(error ?? '未知错误');
  return new Web3Error(classifyWeb3Error(error) === 'UNEXPECTED' ? fallbackCode : classifyWeb3Error(error), message, error);
}
