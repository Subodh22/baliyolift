import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const http = httpRouter();

// Handle preflight
http.route({
  path: "/upload-photo",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }),
});

http.route({
  path: "/upload-photo",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
    const bucket = process.env.R2_BUCKET_NAME!;
    const publicUrl = process.env.R2_PUBLIC_URL!;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const key = `photos/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const body = await req.arrayBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(body),
        ContentType: "image/jpeg",
      })
    );

    const url = `${publicUrl}/${key}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }),
});

// ── Daily-review endpoint (for the scheduled coach agent) ────────────────────
// Read-only. Guarded by a bearer token stored in the Convex env var
// DAILY_REVIEW_TOKEN (set via `npx convex env set DAILY_REVIEW_TOKEN <secret>`),
// never hardcoded. Query params: clerkId (required), date (YYYY-MM-DD, optional
// — the caller's local day is preferred), tzOffsetMinutes (optional).
http.route({
  path: "/daily-review",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const expected = process.env.DAILY_REVIEW_TOKEN;
    if (!expected) {
      return new Response("DAILY_REVIEW_TOKEN not configured", { status: 503 });
    }
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const clerkId = url.searchParams.get("clerkId");
    const date = url.searchParams.get("date");
    const tzRaw = url.searchParams.get("tzOffsetMinutes");
    if (!clerkId || !date) {
      return new Response("Missing clerkId or date", { status: 400 });
    }

    try {
      const result = await ctx.runQuery(api.dailyReview.dailyReview, {
        clerkId,
        date,
        tzOffsetMinutes: tzRaw != null ? Number(tzRaw) : undefined,
      });
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(String(e instanceof Error ? e.message : e), { status: 404 });
    }
  }),
});

export default http;
