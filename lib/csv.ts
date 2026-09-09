export const BUDGET_IMPORT_HEADERS = [
  'zone_name',
  'place_name',
  'address',
  'lng',
  'lat',
  'coordinate_system',
  'place_category',
  'access_type',
  'menu_item_name',
  'menu_category',
  'price_yuan',
  'observed_date',
  'verification_method',
  'evidence_filename',
  'source_lead_url',
  'admin_note',
] as const;

export const BUDGET_IMPORT_DISPLAY_HEADERS = [
  '片区名称',
  '店铺名称',
  '地址',
  '经度',
  '纬度',
  '坐标系',
  '店铺类别',
  '准入类型',
  '餐食名称',
  '餐食类别',
  '价格（元）',
  '核验日期',
  '核验方式',
  '证据文件名',
  '线索链接',
  '后台备注',
] as const;

const HEADER_ALIASES = new Map<string, string>([
  ...BUDGET_IMPORT_HEADERS.map((header) => [header, header] as const),
  ...BUDGET_IMPORT_DISPLAY_HEADERS.map(
    (header, index) => [header, BUDGET_IMPORT_HEADERS[index]] as const,
  ),
]);

/** RFC 4180 parser shared by the browser preview and the server fallback. */
export function parseCsvRFC4180(
  csv: string,
  expectedHeaders?: readonly string[],
): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV 中存在未闭合的引号');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim(),
  );
  if (!headers.length || headers.some((header) => !header)) {
    throw new Error('CSV 缺少有效表头');
  }
  const normalizedHeaders = headers.map(
    (header) => HEADER_ALIASES.get(header) ?? header,
  );
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
    throw new Error('CSV 表头不能重复');
  if (
    expectedHeaders &&
    normalizedHeaders.join('|') !== expectedHeaders.join('|')
  ) {
    throw new Error('CSV 表头必须使用系统模板');
  }

  return rows
    .filter((values) => values.some((value) => value.length > 0))
    .map((values, index) => {
      if (values.length !== headers.length) {
        throw new Error(`CSV 第 ${index + 2} 行列数与表头不一致`);
      }
      return Object.fromEntries(
        normalizedHeaders.map((header, column) => [header, values[column]]),
      );
    });
}
