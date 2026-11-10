// 解析 TRUST_PROXY：跳数（如 1）、true/false 或 IP/子网列表；
// 未设置时生产环境默认信任 1 跳（适用于 Railway 等单层代理），其余环境不信任
export function parseTrustProxy(
  value: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean | number | string {
  if (value === undefined || value === '') return nodeEnv === 'production' ? 1 : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}
