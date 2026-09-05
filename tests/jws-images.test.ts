/**
 * JWS 图片安全代理测试：覆盖缺配置、字段校验、幂等键稳定与上游错误映射。
 * 全程使用伪造 env 与伪造 fetch，不发真实上游请求，不用真实密钥。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { getJwsConfig, type EnvTable } from '../api/_shared/config';
import { idempotencyKeyFor, resetRateLimitState } from '../api/_shared/security';
import { validateImageRequest } from '../api/_shared/validate';
import { extractSafeImages } from '../api/_shared/upstream';
import { modelsHandler } from '../api/ai/models';
import { imagesHandler, type ImagesRequest, type ImagesResponse } from '../api/ai/images';

/** 测试用服务端 env（无真实密钥，地址指向本地回环 mock）。 */
function testEnv(extra: Record<string, string> = {}): EnvTable {
  return {
    JWS_API_KEY: 'test-key-not-real',
    JWS_API_BASE_URL: 'http://127.0.0.1:9',
    JWS_IMAGE_MODEL: 'test-image-model',
    JWS_IMAGE_GENERATIONS_PATH: '/images/generations',
    ...extra,
  };
}

/** 构造可断言的伪响应（收集 status/json/setHeader）。 */
function mockResponse() {
  const seen: { status: number; body: unknown; headers: Record<string, string> } = {
    status: 0,
    body: null,
    headers: {},
  };
  const res: ImagesResponse = {
    status(code: number) {
      seen.status = code;
      return res;
    },
    json(body: unknown) {
      seen.body = body;
    },
    setHeader(name: string, value: string) {
      seen.headers[name] = value;
    },
  };
  return { res, seen };
}

/** 构造图片请求（默认合法 JSON POST）。 */
function mockRequest(body: unknown, extraHeaders: Record<string, string> = {}): ImagesRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body,
    socket: { remoteAddress: '127.0.0.1-test' },
  };
}

/** 伪造成功上游（返回一张安全 https 图片）。 */
function okFetch(payload: unknown = { data: [{ url: 'https://cdn.example/i.png' }] }) {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
}

beforeEach(() => {
  resetRateLimitState();
});

describe('JWS 配置读取', () => {
  it('缺必需变量时返回 missing 且不回显值', () => {
    const { config, missing } = getJwsConfig({});
    expect(config).toBeNull();
    expect(missing).toContain('JWS_API_KEY');
    expect(missing).toContain('JWS_API_BASE_URL');
    expect(missing).toContain('JWS_IMAGE_MODEL');
    expect(missing).toContain('JWS_IMAGE_GENERATIONS_PATH');
  });

  it('生产 http 非回环地址视为缺配置', () => {
    const { config, missing } = getJwsConfig(
      testEnv({ JWS_API_BASE_URL: 'http://supplier.example' }),
    );
    expect(config).toBeNull();
    expect(missing).toContain('JWS_API_BASE_URL');
  });
});

describe('请求校验与幂等键', () => {
  it('拒绝未知字段与超长 prompt', () => {
    expect(
      validateImageRequest({ prompt: 'ok', requestId: 'req-12345678', evil: 1 }, 2000),
    ).toBeNull();
    expect(
      validateImageRequest({ prompt: 'x'.repeat(2001), requestId: 'req-12345678' }, 2000),
    ).toBeNull();
    expect(validateImageRequest({ prompt: 'ok', requestId: 'bad id!' }, 2000)).toBeNull();
  });

  it('同 requestId 幂等键稳定，不同则不同', () => {
    expect(idempotencyKeyFor('req-12345678')).toBe(idempotencyKeyFor('req-12345678'));
    expect(idempotencyKeyFor('req-12345678')).not.toBe(idempotencyKeyFor('req-87654321'));
  });
});

describe('上游图片提取', () => {
  it('只收 http/https 图片并丢弃超限 base64', () => {
    const big = 'A'.repeat(100);
    const images = extractSafeImages(
      { data: [{ url: 'javascript:alert(1)' }, { b64_json: big }, { url: 'https://cdn.example/a.png' }] },
      4,
      10,
    );
    expect(images).toEqual([{ url: 'https://cdn.example/a.png' }]);
  });
});

describe('GET /api/ai/models', () => {
  it('未配置返回可恢复 CONFIG_MISSING', async () => {
    const { res, seen } = mockResponse();
    await modelsHandler({ method: 'GET', headers: {} }, res, {});
    expect(seen.status).toBe(503);
    expect(seen.body).toMatchObject({ ok: false, error: { code: 'CONFIG_MISSING', retryable: true } });
  });

  it('已配置只返回模型标识，不含密钥与地址', async () => {
    const { res, seen } = mockResponse();
    await modelsHandler({ method: 'GET', headers: {} }, res, testEnv());
    expect(seen.status).toBe(200);
    const body = seen.body as { models: { id: string }[] };
    expect(body.models[0]?.id).toBe('test-image-model');
    expect(JSON.stringify(seen.body)).not.toContain('test-key-not-real');
    expect(JSON.stringify(seen.body)).not.toContain('127.0.0.1');
  });

  it('非 GET 返回 METHOD_NOT_ALLOWED', async () => {
    const { res, seen } = mockResponse();
    await modelsHandler({ method: 'POST', headers: {} }, res, testEnv());
    expect(seen.status).toBe(405);
  });
});

describe('POST /api/ai/images', () => {
  it('未配置返回 CONFIG_MISSING 且可重试', async () => {
    const { res, seen } = mockResponse();
    await imagesHandler(mockRequest({ prompt: 'a cat', requestId: 'req-12345678' }), res, {
      env: {},
    });
    expect(seen.status).toBe(503);
    expect(seen.body).toMatchObject({ ok: false, error: { code: 'CONFIG_MISSING' } });
  });

  it('非法请求返回 INVALID_REQUEST 且不回显原文', async () => {
    const { res, seen } = mockResponse();
    await imagesHandler(mockRequest({ prompt: '', requestId: 'bad' }), res, { env: testEnv() });
    expect(seen.status).toBe(400);
    expect(JSON.stringify(seen.body)).not.toContain('bad');
  });

  it('错误 Content-Type 返回 UNSUPPORTED_MEDIA_TYPE', async () => {
    const { res, seen } = mockResponse();
    await imagesHandler(
      { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' },
      res,
      { env: testEnv() },
    );
    expect(seen.status).toBe(415);
  });

  it('成功只返回图片引用与模型，不泄露密钥与上游原文', async () => {
    const { res, seen } = mockResponse();
    await imagesHandler(
      mockRequest({ prompt: 'a brave orange cat', requestId: 'req-12345678' }),
      res,
      { env: testEnv(), fetchImpl: okFetch({ model: 'upstream-model', data: [{ url: 'https://cdn.example/i.png' }] }) },
    );
    expect(seen.status).toBe(200);
    const text = JSON.stringify(seen.body);
    expect(text).toContain('https://cdn.example/i.png');
    expect(text).not.toContain('test-key-not-real');
    expect(text).not.toContain('brave orange cat');
  });

  it('同 requestId 两次成功请求的幂等键一致', async () => {
    const seenKeys: string[] = [];
    const capture = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      seenKeys.push(String(init?.headers?.['Idempotency-Key'] ?? ''));
      return new Response(JSON.stringify({ data: [{ url: 'https://cdn.example/i.png' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const env = testEnv();
    for (let i = 0; i < 2; i++) {
      const { res } = mockResponse();
      await imagesHandler(
        mockRequest({ prompt: 'retry same request', requestId: 'req-abcdef12' }),
        res,
        { env, fetchImpl: capture },
      );
    }
    expect(seenKeys).toHaveLength(2);
    expect(seenKeys[0]).toBe(seenKeys[1]);
    expect(seenKeys[0]).toBe(idempotencyKeyFor('req-abcdef12'));
  });

  it('上游非 2xx 映射为 UPSTREAM_ERROR 且不泄露原文', async () => {
    const fail = (async () =>
      new Response(JSON.stringify({ secret: 'upstream-detail' }), { status: 500 })) as unknown as typeof fetch;
    const { res, seen } = mockResponse();
    await imagesHandler(
      mockRequest({ prompt: 'a cat', requestId: 'req-12345678' }),
      res,
      { env: testEnv(), fetchImpl: fail },
    );
    expect(seen.status).toBe(502);
    expect(JSON.stringify(seen.body)).not.toContain('upstream-detail');
    expect(seen.body).toMatchObject({ ok: false, error: { code: 'UPSTREAM_ERROR' } });
  });

  it('严格 Origin 开启时拒绝白名单外来源', async () => {
    const env = testEnv({ JWS_STRICT_ORIGIN_ENABLED: '1', JWS_ALLOWED_ORIGINS: 'https://app.example' });
    const { res, seen } = mockResponse();
    await imagesHandler(
      mockRequest(
        { prompt: 'a cat', requestId: 'req-12345678' },
        { origin: 'https://evil.example' },
      ),
      res,
      { env, fetchImpl: okFetch() },
    );
    expect(seen.status).toBe(403);
    expect(seen.body).toMatchObject({ ok: false, error: { code: 'ORIGIN_FORBIDDEN' } });
  });
});
