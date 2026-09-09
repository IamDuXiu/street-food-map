import { NextRequest, NextResponse } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { requireAdmin, AuthError } from '@/lib/server/auth';
import { approveSubmission } from '@/lib/server/services';
import { listSubmissions } from '@/lib/server/repository';
import { submissionApprovalSchema } from '@/lib/server/validation';
export async function GET(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db); return NextResponse.json({ data: listSubmissions(db) }); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: NextRequest) { const db = openDatabase(); try { requireAdmin(request, db, true); const body = submissionApprovalSchema.parse(await request.json()); return NextResponse.json({ status: approveSubmission(db, body.id, body.decision, 'admin', body.note, body.review) }); } catch (error) { return errorResponse(error); } }
function errorResponse(error: unknown) { const status = error instanceof AuthError ? error.status : 400; return NextResponse.json({ error: { code: error instanceof AuthError ? error.code : 'REQUEST_ERROR', message: '投稿操作失败' } }, { status }); }
