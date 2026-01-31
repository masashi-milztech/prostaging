
interface Env {
  STRIPE_SECRET_KEY: string;
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
    const body = await request.json() as any;
    if (!body) return new Response(JSON.stringify({ message: "Empty Body" }), { status: 400 });

    const { planTitle, amount, orderId, userEmail } = body;
    
    // 金額を確実に整数値（セント）として扱う
    const finalAmount = Math.round(Number(amount));

    if (!finalAmount || finalAmount < 50 || !orderId || !userEmail) {
      return new Response(JSON.stringify({ 
        message: "Missing or invalid payment parameters.",
        debug: { amount: finalAmount, orderId, userEmail }
      }), { status: 400 });
    }

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ message: "Server misconfigured: Stripe key missing." }), { status: 500 });
    }

    const stripeParams = new URLSearchParams();
    stripeParams.append("mode", "payment");
    stripeParams.append("customer_email", userEmail);
    stripeParams.append("success_url", `${new URL(request.url).origin}/?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}&payment=success`);
    stripeParams.append("cancel_url", `${new URL(request.url).origin}/`);
    stripeParams.append("line_items[0][price_data][currency]", "usd");
    stripeParams.append("line_items[0][price_data][product_data][name]", `StagingPro: ${planTitle || 'Service'}`);
    stripeParams.append("line_items[0][price_data][unit_amount]", finalAmount.toString());
    stripeParams.append("line_items[0][quantity]", "1");
    stripeParams.append("metadata[orderId]", orderId);
    stripeParams.append("payment_method_types[0]", "card");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeParams.toString(),
    });

    const session = await response.json() as any;

    if (!session.url) {
      return new Response(JSON.stringify({ message: session.error?.message || "Stripe session creation failed." }), { status: 500 });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), { status: 500 });
  }
};
