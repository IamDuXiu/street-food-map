/** Human-facing labels shared by public and operator-facing surfaces. */

export const verificationMethodLabels = {
  onsite_menu: '现场价签',
  receipt: '消费小票',
  official_menu: '官方菜单',
  phone_check: '电话核验',
  community_confirmed: '双人确认',
  external_lead: '线索',
} as const;

export function verificationMethodLabel(method: string): string {
  return verificationMethodLabels[method as keyof typeof verificationMethodLabels] ?? '线索';
}

export const submissionTypeLabels = {
  new_place: '发现新饭点',
  new_price: '价格有变化',
  correction: '地点有纠错',
  closure: '地点已停业',
} as const;

export const submissionStatusLabels = {
  pending: '排队核验',
  needs_verification: '需要补充核验',
  approved: '已通过审核',
  rejected: '未通过审核',
  duplicate: '与已有记录重复',
} as const;

export function submissionStatusLabel(status: string): string {
  return submissionStatusLabels[status as keyof typeof submissionStatusLabels] ?? '处理中';
}

export function submissionTypeLabel(type: string): string {
  return submissionTypeLabels[type as keyof typeof submissionTypeLabels] ?? '其他投稿';
}
