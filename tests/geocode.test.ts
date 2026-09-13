import { describe, expect, it, vi } from 'vitest';
import {
  geocodeAddress,
  isPlaceholderAddress,
  tencentGeocoderKey,
} from '@/lib/server/geocode';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('腾讯地理编码', () => {
  it('无 Key 时返回空数组且不发起请求', async () => {
    const fetchImpl = fakeFetch({});
    const result = await geocodeAddress('广州市天河区某路 1 号', {
      key: '',
      fetchImpl,
    });
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('地址为空时不发起请求', async () => {
    const fetchImpl = fakeFetch({});
    expect(await geocodeAddress('   ', { key: 'k', fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('「待补」占位地址不发起请求，避免解析到市中心', async () => {
    const fetchImpl = fakeFetch({
      status: 0,
      result: { location: { lng: 113.264499, lat: 23.130061 } },
    });
    expect(await geocodeAddress('广州市（待补地址）', { key: 'k', fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isPlaceholderAddress('广州市（待补地址）')).toBe(true);
    expect(isPlaceholderAddress('广州市番禺区金江大道217-219号')).toBe(false);
  });

  it('解析腾讯返回的 GCJ-02 坐标', async () => {
    const fetchImpl = fakeFetch({
      status: 0,
      result: { title: '某快餐店', location: { lng: 113.264, lat: 23.129 }, reliability: 7 },
    });
    const result = await geocodeAddress('广州市某快餐店', {
      key: 'secret-key',
      fetchImpl,
    });
    expect(result).toEqual([
      { lng: 113.264, lat: 23.129, title: '某快餐店', reliability: 7 },
    ]);
    const calledUrl = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).toContain('apis.map.qq.com/ws/geocoder/v1/');
    expect(calledUrl).toContain(encodeURIComponent('广州市某快餐店'));
  });

  it('腾讯返回非 0 状态时返回空数组', async () => {
    const fetchImpl = fakeFetch({ status: 311, message: 'key error' });
    expect(await geocodeAddress('地址', { key: 'k', fetchImpl })).toEqual([]);
  });

  it('网络异常时安全降级为空数组', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await geocodeAddress('地址', { key: 'k', fetchImpl })).toEqual([]);
  });

  it('从环境变量读取服务端 Key', () => {
    const previous = process.env.TENCENT_MAP_WEB_SERVICE_KEY;
    process.env.TENCENT_MAP_WEB_SERVICE_KEY = 'env-key';
    expect(tencentGeocoderKey()).toBe('env-key');
    if (previous === undefined) delete process.env.TENCENT_MAP_WEB_SERVICE_KEY;
    else process.env.TENCENT_MAP_WEB_SERVICE_KEY = previous;
  });
});
