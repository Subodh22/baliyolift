import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
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

export default http;
