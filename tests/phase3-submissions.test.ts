import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { openDatabase } from '@/lib/server/db';
import { seedDemo } from '@/lib/server/seed';
import {
  approveSubmission,
  createSubmission,
  getSubmissionStatus,
} from '@/lib/server/services';
import { submissionSchema } from '@/lib/server/validation';
import {
  readAdminMedia,
  readPublicMedia,
  saveAdminReplacement,
  saveSubmissionMedia,
} from '@/lib/server/media';
import { sourceHash } from '@/lib/server/auth';
import { PlaceRepository } from '@/lib/server/repository';
import { toPublicPlace } from '@/lib/server/public';

const roots: string[] = [];
function testDb() {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), 'budget-map-phase3-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'test.sqlite'));
  seedDemo(db);
  return { db, root };
}
function newPricePayload() {
  return {
    type: 'new_price' as const,
    placeId: 'kexing-b1-foodcourt',
    menuItemId: 'kexing-rice',
    priceFen: 2200,
    observedAt: '2026-09-01',
    claimedVerificationMethod: 'onsite_menu' as const,
    note: '现场价签',
  };
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});

describe('阶段 3 匿名投稿与媒体安全边界', () => {
  it('四种投稿共享严格联合 schema，拒绝越权字段、HTML、错误坐标和不完整纠错', () => {
    expect(submissionSchema.parse(newPricePayload()).type).toBe('new_price');
    expect(
      submissionSchema.parse({
        type: 'new_place',
        zoneId: 'sz university',
        placeName: '新店',
        address: '深圳大学旁',
        lng: 113.93,
        lat: 22.53,
        coordinateSystem: 'GCJ-02',
        placeCategory: '快餐',
        menuItemName: '套餐',
        priceFen: 2000,
        observedAt: '2026-09-01',
        claimedVerificationMethod: 'onsite_menu',
      }),
    ).toBeTruthy();
    expect(
      submissionSchema.parse({
        type: 'correction',
        placeId: 'p',
        field: 'address',
        proposedValue: '新地址',
        reason: '现场确认',
      }),
    ).toBeTruthy();
    expect(
      submissionSchema.parse({
        type: 'closure',
        placeId: 'p',
        closureType: 'closed',
        observedAt: '2026-09-01',
      }),
    ).toBeTruthy();
    expect(() =>
      submissionSchema.parse({ ...newPricePayload(), admin: true }),
    ).toThrow();
    expect(() =>
      submissionSchema.parse({
        ...newPricePayload(),
        note: '<script>alert(1)</script>',
      }),
    ).toThrow();
    expect(() =>
      submissionSchema.parse({ ...newPricePayload(), lat: 80 }),
    ).toThrow();
    expect(() =>
      submissionSchema.parse({
        ...newPricePayload(),
        menuItemId: undefined,
        newMenuItemName: undefined,
      }),
    ).toThrow();
    expect(() =>
      submissionSchema.parse({
        type: 'correction',
        placeId: 'p',
        field: 'menu_item_name',
        proposedValue: '新名',
        reason: '核验',
      }),
    ).toThrow();
    expect(() =>
      submissionSchema.parse({
        type: 'correction',
        placeId: 'p',
        field: 'menu_item_name',
        menuItemId: 'meal-1',
        proposedValue: '新名',
        reason: '核验',
      }),
    ).not.toThrow();
  });

  it('查询码和上传令牌只返回一次且只存哈希，查询码不能作为上传令牌', () => {
    const { db } = testDb();
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'source-a',
    });
    expect(
      Buffer.from(result.lookupCode, 'base64url').length,
    ).toBeGreaterThanOrEqual(16);
    expect(result.lookupCode).not.toBe(result.uploadToken);
    const row = db
      .prepare(
        'SELECT lookup_code_hash,upload_token_hash,payload_json FROM submissions WHERE id=?',
      )
      .get(result.id) as {
      lookup_code_hash: string;
      upload_token_hash: string;
      payload_json: string;
    };
    expect(row.lookup_code_hash).not.toContain(result.lookupCode);
    expect(row.upload_token_hash).not.toContain(result.uploadToken);
    expect(row.payload_json).not.toContain(result.lookupCode);
    expect(() => getSubmissionStatus(db, 'wrong-code', 'source-a')).toThrow(
      'NOT_FOUND',
    );
    expect(getSubmissionStatus(db, result.lookupCode, 'source-a').status).toBe(
      'pending',
    );
  });

  it('默认不信任客户端 X-Forwarded-For，明确启用可信代理后才使用它', () => {
    process.env.SESSION_SECRET = 'phase3-source-secret-012345678901234567890';
    delete process.env.TRUST_PROXY;
    const request = new Request('http://localhost', {
      headers: { 'user-agent': 'same-browser', 'x-forwarded-for': '192.0.2.1' },
    });
    const withoutProxy = sourceHash(request);
    process.env.TRUST_PROXY = '1';
    const withProxy = sourceHash(request);
    expect(withProxy).not.toBe(withoutProxy);
    delete process.env.TRUST_PROXY;
  });

  it('投稿与状态查询按不可逆来源指纹限流，数据库不保存原始来源', () => {
    const { db } = testDb();
    for (let i = 0; i < 5; i += 1)
      createSubmission(db, newPricePayload(), { sourceHash: 'hashed-source' });
    expect(() =>
      createSubmission(db, newPricePayload(), { sourceHash: 'hashed-source' }),
    ).toThrow('RATE_LIMITED');
    const row = db
      .prepare(
        'SELECT source_hash FROM submissions WHERE source_hash IS NOT NULL LIMIT 1',
      )
      .get() as { source_hash: string };
    expect(row.source_hash).toBe('hashed-source');
    expect(row.source_hash).not.toContain('192.0.2.1');
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'another-source',
    });
    for (let i = 0; i < 10; i += 1)
      expect(
        getSubmissionStatus(db, result.lookupCode, 'status-source').status,
      ).toBe('pending');
    expect(() =>
      getSubmissionStatus(db, result.lookupCode, 'status-source'),
    ).toThrow('RATE_LIMITED');
  });

  it('拒绝伪 MIME/超大文件/查询码上传，并将合法图片转 WebP、去 EXIF、限制最长边', async () => {
    const { db } = testDb();
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'media-source',
    });
    const jpeg = await sharp({
      create: {
        width: 2200,
        height: 1100,
        channels: 3,
        background: { r: 240, g: 100, b: 20 },
      },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: 'private' } } })
      .toBuffer();
    const file = new File([jpeg], 'receipt.jpg', { type: 'image/jpeg' });
    await expect(
      saveSubmissionMedia(db, result.id, result.lookupCode, file, true),
    ).rejects.toThrow('UPLOAD_TOKEN_INVALID');
    await expect(
      saveSubmissionMedia(
        db,
        result.id,
        result.uploadToken,
        new File([jpeg], 'fake.png', { type: 'image/png' }),
        true,
      ),
    ).rejects.toThrow('MIME_MISMATCH');
    const tooLarge = new File(
      [
        Buffer.concat([
          Buffer.from([0xff, 0xd8, 0xff]),
          Buffer.alloc(10 * 1024 * 1024),
        ]),
      ],
      'large.jpg',
      { type: 'image/jpeg' },
    );
    await expect(
      saveSubmissionMedia(db, result.id, result.uploadToken, tooLarge, true),
    ).rejects.toThrow('FILE_TOO_LARGE');
    const media = await saveSubmissionMedia(
      db,
      result.id,
      result.uploadToken,
      file,
      true,
    );
    expect(media.width).toBeLessThanOrEqual(1600);
    const row = db
      .prepare(
        'SELECT storage_path,mime_type,visibility,redaction_status FROM evidence_media WHERE id=?',
      )
      .get(media.id) as {
      storage_path: string;
      mime_type: string;
      visibility: string;
      redaction_status: string;
    };
    expect(row.mime_type).toBe('image/webp');
    const stored = await sharp(
      path.join(process.env.UPLOADS_DIR ?? 'uploads', row.storage_path),
    ).metadata();
    expect(stored.format).toBe('webp');
    expect(stored.width).toBeLessThanOrEqual(1600);
    expect(stored.exif).toBeUndefined();
    expect(row.visibility).toBe('admin_only');
    expect(row.redaction_status).toBe('pending');
    await expect(readPublicMedia(db, media.id)).rejects.toThrow('NOT_FOUND');
    expect((await readAdminMedia(db, media.id)).body.length).toBeGreaterThan(0);
    expect(
      fsSync
        .readdirSync(
          path.join(
            process.env.UPLOADS_DIR ?? 'uploads',
            'submissions',
            result.id,
          ),
        )
        .every((name) => name.endsWith('.webp')),
    ).toBe(true);
  });

  it('每投稿最多五张，管理员替代图保留原图关联且仍需后续复核', async () => {
    const { db } = testDb();
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'five-source',
    });
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    for (let i = 0; i < 4; i += 1)
      await saveSubmissionMedia(
        db,
        result.id,
        result.uploadToken,
        new File([png], `${i}.png`, { type: 'image/png' }),
        true,
      );
    const original = db
      .prepare('SELECT id FROM evidence_media WHERE submission_id=? LIMIT 1')
      .get(result.id) as { id: string };
    const replacement = await saveAdminReplacement(
      db,
      original.id,
      new File([png], 'redacted.png', { type: 'image/png' }),
      true,
    );
    const row = db
      .prepare(
        'SELECT replaces_media_id,visibility,redaction_status FROM evidence_media WHERE id=?',
      )
      .get(replacement.id) as {
      replaces_media_id: string;
      visibility: string;
      redaction_status: string;
    };
    expect(row.replaces_media_id).toBe(original.id);
    expect(row.visibility).toBe('admin_only');
    expect(row.redaction_status).toBe('pending');
    await expect(
      saveSubmissionMedia(
        db,
        result.id,
        result.uploadToken,
        new File([png], 'six.png', { type: 'image/png' }),
        true,
      ),
    ).rejects.toThrow('MEDIA_LIMIT_REACHED');
  });

  it('批准价格时可关联已复核媒体，匿名读取只得到 public 媒体', async () => {
    const { db } = testDb();
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'public-media',
      rightsConfirmed: true,
    });
    const png = await sharp({
      create: { width: 12, height: 12, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const media = await saveSubmissionMedia(
      db,
      result.id,
      result.uploadToken,
      new File([png], 'proof.png', { type: 'image/png' }),
      true,
    );
    db.prepare(
      "UPDATE evidence_media SET redaction_status='completed' WHERE id=?",
    ).run(media.id);
    expect(
      approveSubmission(db, result.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-02',
        independentVerification: true,
        publicMediaIds: [media.id],
      }),
    ).toBe('approved');
    const publicMedia = await readPublicMedia(db, media.id);
    expect(publicMedia.mimeType).toBe('image/webp');
    expect(publicMedia.body.length).toBeGreaterThan(0);
    expect(
      (
        db
          .prepare(
            'SELECT visibility,price_report_id FROM evidence_media WHERE id=?',
          )
          .get(media.id) as {
          visibility: string;
          price_report_id: string | null;
        }
      ).visibility,
    ).toBe('public');
  });

  it('批准映射写入价格并在公开媒体校验失败时整体回滚', () => {
    const { db } = testDb();
    const result = createSubmission(db, newPricePayload(), {
      sourceHash: 'approval-source',
    });
    const before = Number(
      (
        db
          .prepare(
            "SELECT count(*) count FROM price_reports WHERE menu_item_id='kexing-rice'",
          )
          .get() as { count: number }
      ).count,
    );
    expect(() =>
      approveSubmission(db, result.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-01',
        independentVerification: true,
        publicMediaIds: ['missing-media'],
      }),
    ).toThrow('MEDIA_PUBLIC_REVIEW_REQUIRED');
    expect(
      Number(
        (
          db
            .prepare(
              "SELECT count(*) count FROM price_reports WHERE menu_item_id='kexing-rice'",
            )
            .get() as { count: number }
        ).count,
      ),
    ).toBe(before);
    expect(
      (
        db
          .prepare('SELECT status FROM submissions WHERE id=?')
          .get(result.id) as { status: string }
      ).status,
    ).toBe('pending');
    expect(
      approveSubmission(db, result.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-01',
        independentVerification: true,
      }),
    ).toBe('approved');
    expect(
      (
        db
          .prepare('SELECT status FROM submissions WHERE id=?')
          .get(result.id) as { status: string }
      ).status,
    ).toBe('approved');
    expect(
      (
        db
          .prepare(
            "SELECT status,price_fen FROM price_reports WHERE menu_item_id='kexing-rice' ORDER BY created_at DESC LIMIT 1",
          )
          .get() as { status: string; price_fen: number }
      ).status,
    ).toBe('verified');
  });

  it('new_price 可记录超过 25 元的涨价，但公开层仍隐藏该餐食并 supersede 旧价', () => {
    const { db } = testDb();
    const result = createSubmission(
      db,
      { ...newPricePayload(), priceFen: 2600 },
      { sourceHash: 'over-price' },
    );
    expect(
      approveSubmission(db, result.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-02',
        independentVerification: true,
      }),
    ).toBe('approved');
    const prices = db
      .prepare(
        "SELECT price_fen,status FROM price_reports WHERE menu_item_id='kexing-rice' ORDER BY created_at DESC",
      )
      .all() as Array<{ price_fen: number; status: string }>;
    expect(prices[0]).toMatchObject({ price_fen: 2600, status: 'verified' });
    expect(prices.filter((price) => price.status === 'verified')).toHaveLength(
      1,
    );
    const place = new PlaceRepository(db).get('kexing-b1-foodcourt');
    expect(
      toPublicPlace(place!, new Date('2026-09-02')).meals.some(
        (meal) => meal.priceFen > 2500,
      ),
    ).toBe(false);
  });

  it('四种 approved 都映射到各自正式事实', () => {
    const { db } = testDb();
    const review = {
      verificationMethod: 'onsite_menu' as const,
      observedAt: '2026-09-02',
      independentVerification: true as const,
    };
    const placeSubmission = createSubmission(
      db,
      {
        type: 'new_place',
        zoneId: 'sz university',
        placeName: '阶段3新地点',
        address: '阶段3测试地址',
        lng: 113.901,
        lat: 22.551,
        coordinateSystem: 'GCJ-02',
        placeCategory: '快餐',
        menuItemName: '阶段3套餐',
        priceFen: 1800,
        observedAt: '2026-09-02',
        claimedVerificationMethod: 'onsite_menu',
      },
      { sourceHash: 'approve-place' },
    );
    expect(
      approveSubmission(
        db,
        placeSubmission.id,
        'approved',
        'admin',
        undefined,
        review,
      ),
    ).toBe('approved');
    const correction = createSubmission(
      db,
      {
        type: 'correction',
        placeId: 'shenda-west-noodle',
        field: 'address',
        proposedValue: '新地址',
        reason: '现场核对',
      },
      { sourceHash: 'approve-correction' },
    );
    expect(
      approveSubmission(
        db,
        correction.id,
        'approved',
        'admin',
        undefined,
        review,
      ),
    ).toBe('approved');
    const closure = createSubmission(
      db,
      {
        type: 'closure',
        placeId: 'tencent-community-kitchen',
        closureType: 'closed',
        observedAt: '2026-09-02',
        reason: '现场确认',
      },
      { sourceHash: 'approve-closure' },
    );
    expect(
      approveSubmission(db, closure.id, 'approved', 'admin', undefined, review),
    ).toBe('approved');
    expect(
      (
        db
          .prepare(
            "SELECT business_status FROM places WHERE id='tencent-community-kitchen'",
          )
          .get() as { business_status: string }
      ).business_status,
    ).toBe('closed');
    expect(
      (
        db
          .prepare("SELECT address FROM places WHERE id='shenda-west-noodle'")
          .get() as { address: string }
      ).address,
    ).toBe('新地址');
    expect(
      (
        db
          .prepare("SELECT count(*) count FROM places WHERE name='阶段3新地点'")
          .get() as { count: number }
      ).count,
    ).toBe(1);
  });

  it('停业目标不存在和新地点重复候选时回滚并保持 pending', () => {
    const { db } = testDb();
    db.prepare(
      "UPDATE places SET record_status='archived' WHERE id='tencent-community-kitchen'",
    ).run();
    const missing = createSubmission(
      db,
      {
        type: 'closure',
        placeId: 'tencent-community-kitchen',
        closureType: 'closed',
        observedAt: '2026-09-02',
      },
      { sourceHash: 'missing-close' },
    );
    expect(() =>
      approveSubmission(db, missing.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-02',
        independentVerification: true,
      }),
    ).toThrow('PLACE_NOT_FOUND');
    expect(
      (
        db
          .prepare('SELECT status FROM submissions WHERE id=?')
          .get(missing.id) as { status: string }
      ).status,
    ).toBe('pending');
    const duplicate = createSubmission(
      db,
      {
        type: 'new_place',
        zoneId: 'sz university',
        placeName: '深大粤海食堂·二楼',
        address: '不同地址',
        lng: 113.933073,
        lat: 22.526639,
        coordinateSystem: 'GCJ-02',
        placeCategory: '快餐',
        menuItemName: '套餐',
        priceFen: 1800,
        observedAt: '2026-09-02',
        claimedVerificationMethod: 'onsite_menu',
      },
      { sourceHash: 'duplicate-place' },
    );
    expect(() =>
      approveSubmission(db, duplicate.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-02',
        independentVerification: true,
      }),
    ).toThrow('DUPLICATE_CANDIDATE');
    expect(
      (
        db
          .prepare('SELECT status FROM submissions WHERE id=?')
          .get(duplicate.id) as { status: string }
      ).status,
    ).toBe('pending');
  });

  it('待核验、拒绝和重复只改变投稿状态，不写入正式价格', () => {
    const { db } = testDb();
    const before = Number(
      (
        db
          .prepare(
            "SELECT count(*) count FROM price_reports WHERE menu_item_id='kexing-rice'",
          )
          .get() as { count: number }
      ).count,
    );
    const pending = createSubmission(db, newPricePayload(), {
      sourceHash: 'decision-a',
    });
    expect(
      approveSubmission(db, pending.id, 'needs_verification', 'admin'),
    ).toBe('needs_verification');
    expect(
      Number(
        (
          db
            .prepare(
              "SELECT count(*) count FROM price_reports WHERE menu_item_id='kexing-rice'",
            )
            .get() as { count: number }
        ).count,
      ),
    ).toBe(before);
    const rejected = createSubmission(db, newPricePayload(), {
      sourceHash: 'decision-b',
    });
    expect(
      approveSubmission(db, rejected.id, 'rejected', 'admin', '证据不足'),
    ).toBe('rejected');
    expect(
      Number(
        (
          db
            .prepare(
              "SELECT count(*) count FROM price_reports WHERE menu_item_id='kexing-rice'",
            )
            .get() as { count: number }
        ).count,
      ),
    ).toBe(before);
    expect(() =>
      approveSubmission(db, rejected.id, 'approved', 'admin', undefined, {
        verificationMethod: 'onsite_menu',
        observedAt: '2026-09-01',
        independentVerification: true,
      }),
    ).toThrow('SUBMISSION_NOT_PENDING');
  });
});
