/** Coordinate helpers used at the browser/map boundary. Database coordinates are GCJ-02. */
export interface Coordinate { lng: number; lat: number }

const PI = Math.PI;
const AXIS = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  ret += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
  return ret;
}

function transformLng(x: number, y: number) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  ret += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
  return ret;
}

/** Convert a WGS-84 browser location to GCJ-02 for the map adapter and distance calculations. */
export function wgs84ToGcj02({ lng, lat }: Coordinate): Coordinate {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng >= 72 && lng <= 137 && lat >= 0.8293 && lat <= 55.8271)) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('INVALID_COORDINATE');
    const dLat = transformLat(lng - 105, lat - 35);
    const dLng = transformLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    return {
      lng: lng + (dLng * 180) / (AXIS / sqrtMagic * Math.cos(radLat) * PI),
      lat: lat + (dLat * 180) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI),
    };
  }
  return { lng, lat };
}

export function distanceMeters(a: Coordinate, b: Coordinate) {
  const rad = PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}
