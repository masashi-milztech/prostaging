


interface Env {
  // Fix: changed R2Bucket to any to resolve "Cannot find name 'R2Bucket'" error
  R2_BUCKET: any;
  R2_PUBLIC_DOMAIN?: string; // 例: assets.milz.tech (設定されている場合)
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), { 
      status: 405, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  try {
    const { path, file } = await request.json() as { path: string, file: string };

    if (!path || !file) {
      return new Response(JSON.stringify({ message: "Path and File are required." }), { status: 400 });
    }

    if (!env.R2_BUCKET) {
      return new Response(JSON.stringify({ message: "R2 Bucket not bound. Please check Cloudflare settings." }), { status: 500 });
    }

    // Base64からバイナリデータに変換
    const base64Data = file.split(',')[1] || file;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // R2に保存
    const mimeType = file.match(/^data:(.*);base64,/)?.[1] || "image/jpeg";
    await env.R2_BUCKET.put(path, bytes, {
      httpMetadata: { contentType: mimeType }
    });

    // 公開URLの生成
    // バケットが「パブリック」設定になっている場合、Cloudflareが提供する pub-xxx.r2.dev URLを使用します。
    // またはカスタムドメインが設定されている場合はそれを使用します。
    let publicUrl = "";
    if (env.R2_PUBLIC_DOMAIN) {
      publicUrl = `https://${env.R2_PUBLIC_DOMAIN}/${path}`;
    } else {
      // Functions内では自分自身のホスト名を経由して画像を配信することも可能です（これが最も簡単です）
      const url = new URL(request.url);
      publicUrl = `${url.origin}/api/media?path=${encodeURIComponent(path)}`;
    }

    return new Response(JSON.stringify({ url: publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), { status: 500 });
  }
};