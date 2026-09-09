import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { AuthError, requireAdmin } from '@/lib/server/auth';
import {
  CandidatePoolError,
  CandidatePoolRepository,
  seedCandidateBatch,
  updateCandidateItemStatus,
} from '@/lib/candidate-pool';
import { LeadRepository } from '@/lib/server/repository';
import { leadPatchSchema, leadSchema } from '@/lib/server/validation';

export async function GET(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db);
    const url = new URL(request.url);
    if (url.searchParams.get('view') === 'grouped') {
      const limitText = url.searchParams.get('limit');
      const offsetText = url.searchParams.get('offset');
      const data = new CandidatePoolRepository(db).listGrouped({
        q: url.searchParams.get('q') || undefined,
        status: url.searchParams.get('status') || undefined,
        itemStatus:
          (url.searchParams.get('itemStatus') as
            | 'new'
            | 'triaged'
            | 'verifying'
            | 'converted'
            | 'rejected'
            | 'duplicate'
            | null) || undefined,
        discoveryMethod: url.searchParams.get('discoveryMethod') || undefined,
        sourcePlatform: url.searchParams.get('sourcePlatform') || undefined,
        limit: limitText ? Number(limitText) : undefined,
        offset: offsetText ? Number(offsetText) : undefined,
      });
      return NextResponse.json({
        data,
        meta: {
          count: data.length,
          itemCount: data.reduce((sum, group) => sum + group.itemCount, 0),
        },
      });
    }
    return NextResponse.json({ data: new LeadRepository(db).list() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const rawBody = await request.json();
    const body = (rawBody ?? {}) as Record<string, unknown>;
    if (
      Array.isArray(rawBody) ||
      Array.isArray(body.records) ||
      Array.isArray(body.candidates) ||
      body.view === 'batch' ||
      body.kind === 'candidate_seed'
    ) {
      const records = Array.isArray(rawBody)
        ? rawBody
        : body.records ?? body.candidates ?? body.data;
      const result = seedCandidateBatch(db, records, 'admin');
      return NextResponse.json({ data: result }, { status: 201 });
    }
    const input = leadSchema.parse(body);
    return NextResponse.json(
      { id: new LeadRepository(db).create(input) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const db = openDatabase();
  try {
    requireAdmin(request, db, true);
    const body = (await request.json()) as Record<string, unknown>;
    const itemId =
      typeof body.sourceLeadItemId === 'string'
        ? body.sourceLeadItemId
        : typeof body.itemId === 'string'
          ? body.itemId
          : '';
    if (itemId) {
      const status = body.status;
      if (
        typeof status !== 'string' ||
        ![
          'new',
          'triaged',
          'verifying',
          'converted',
          'rejected',
          'duplicate',
        ].includes(status)
      )
        throw new CandidatePoolError(
          'INVALID_CANDIDATE_ITEM_STATUS',
          '候选餐食状态不正确',
          400,
        );
      return NextResponse.json({
        data: {
          status: updateCandidateItemStatus(
            db,
            itemId,
            status as
              | 'new'
              | 'triaged'
              | 'verifying'
              | 'converted'
              | 'rejected'
              | 'duplicate',
          ),
        },
      });
    }
    const id = typeof body.id === 'string' ? body.id : '';
    const patch = leadPatchSchema.parse(body.patch ?? body);
    new LeadRepository(db).update(id, patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthError)
    return NextResponse.json(
      { error: { code: error.code, message: '未授权或请求来源不受信任' } },
      { status: error.status },
    );
  if (error instanceof CandidatePoolError)
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    );
  const isZod = error instanceof Error && error.name === 'ZodError';
  return NextResponse.json(
    {
      error: {
        code: isZod ? 'VALIDATION_ERROR' : 'LEAD_REQUEST_FAILED',
        message: '请求无法处理',
      },
    },
    { status: isZod ? 400 : 500 },
  );
}
