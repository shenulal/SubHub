import { NextRequest, NextResponse } from "next/server";

import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@/actions/subscriptions/attachments";
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";

type Params = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

/**
 * GET /api/v1/subscriptions/[id]/attachments — list with signed download URLs.
 */
export const GET = withLogging(
  "GET /api/v1/subscriptions/:id/attachments",
  async (_request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;
    const result = await listAttachments(id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);

/**
 * POST /api/v1/subscriptions/[id]/attachments — multipart upload.
 * Fields: `file` (required), `kind` (CONTRACT | INVOICE | ORDER_FORM | OTHER).
 */
export const POST = withLogging(
  "POST /api/v1/subscriptions/:id/attachments",
  async (request: NextRequest, { params }: Params) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Expected multipart form data" },
        { status: 400 }
      );
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Missing file" },
        { status: 400 }
      );
    }
    const kind = form.get("kind");
    const result = await uploadAttachment({
      subscriptionId: id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer: Buffer.from(await file.arrayBuffer()),
      kind: typeof kind === "string" ? kind : null,
    });
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  }
);

/**
 * DELETE /api/v1/subscriptions/[id]/attachments?attachmentId=
 */
export const DELETE = withLogging(
  "DELETE /api/v1/subscriptions/:id/attachments",
  async (request: NextRequest) => {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "attachmentId is required" },
        { status: 400 }
      );
    }
    const result = await deleteAttachment(attachmentId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }
);
