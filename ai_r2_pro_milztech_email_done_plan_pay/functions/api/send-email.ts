
interface Env {
  VITE_RESEND_API_KEY: string;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  // POSTメソッドのみ許可
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), { 
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await request.json();
    const apiKey = env.VITE_RESEND_API_KEY;

    if (!apiKey) {
      console.error("[Function Error] VITE_RESEND_API_KEY is missing in Cloudflare Environment Variables");
      return new Response(JSON.stringify({ message: "Server configuration error: API Key missing" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // サーバーサイドから Resend API へリクエスト（CORSの影響を受けない）
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await resendResponse.json();

    return new Response(JSON.stringify(result), {
      status: resendResponse.status,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  } catch (error: any) {
    console.error("[Function Error]", error);
    return new Response(JSON.stringify({ message: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
