


interface Env {
  // Fix: changed R2Bucket to any to resolve "Cannot find name 'R2Bucket'" error
  R2_BUCKET: any;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return new Response("Media not found", { status: 404 });
  }

  try {
    const object = await env.R2_BUCKET.get(path);

    if (!object) {
      return new Response("Object not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=31536000"); // 1年間のキャッシュ（転送量節約）

    return new Response(object.body, {
      headers,
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};