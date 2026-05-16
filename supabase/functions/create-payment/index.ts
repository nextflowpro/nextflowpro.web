import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Tier = "Basic" | "Pro";

const PRODUCT_MAP: Record<Tier, { name: string; amount: number }> = {
  Basic: {
    name: "Nextflow Pro Basic - 30 Hari",
    amount: 255000,
  },
  Pro: {
    name: "Nextflow Pro Pro - 30 Hari",
    amount: 305000,
  },
};

function getMidtransSnapUrl() {
  const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
  return isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

function makeOrderId(tier: string) {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `NFP-${tier.toUpperCase()}-${Date.now()}-${random}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY")?.trim();
    const siteUrl = Deno.env.get("SITE_URL")?.trim();
    const isProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    // Validasi Secrets
    if (!midtransServerKey || !siteUrl || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Konfigurasi server (Secrets) belum lengkap di dashboard Supabase.");
    }

    // Cek apakah user salah memasukkan Client Key (seharusnya Server Key)
    if (midtransServerKey.includes("-client-")) {
      throw new Error("Anda memasukkan CLIENT_KEY ke dalam MIDTRANS_SERVER_KEY. Harap gunakan SERVER_KEY.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Sesi tidak valid" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const tier = body.tier as Tier;
    if (!PRODUCT_MAP[tier]) {
      return new Response(JSON.stringify({ success: false, message: "Paket tidak valid" }), { status: 400, headers: corsHeaders });
    }

    const product = PRODUCT_MAP[tier];
    const orderId = makeOrderId(tier);
    const email = user.email || "";
    const invoiceNumber = `INV-${new Date().getFullYear()}-${orderId}`;

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: product.amount,
      },
      customer_details: {
        email,
        first_name: user.user_metadata?.full_name || email.split("@")[0],
      },
      item_details: [
        {
          id: `NFP-${tier.toUpperCase()}`,
          price: product.amount,
          quantity: 1,
          name: product.name,
        },
      ],
      callbacks: {
        finish: `${siteUrl}/#harga`, // Redirect kembali ke landing page jika beres
        error: `${siteUrl}/#harga`,
        pending: `${siteUrl}/#harga`,
      },
      custom_field1: user.id,
      custom_field2: tier,
      custom_field3: invoiceNumber,
    };

    console.log(`[${orderId}] Menghubungi Midtrans (${isProduction ? 'PROD' : 'SANDBOX'})...`);

    const authString = btoa(`${midtransServerKey}:`);
    const midtransRes = await fetch(getMidtransSnapUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok) {
      console.error(`[${orderId}] MIDTRANS_ERROR:`, JSON.stringify(midtransData, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          message: "Midtrans Error: " + (midtransData.error_messages?.join(", ") || "Terjadi kesalahan di server Midtrans"),
          detail: midtransData,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simpan ke Database
    const { error: insertError } = await adminClient
      .from("payment_transactions")
      .insert({
        order_id: orderId,
        user_id: user.id,
        email,
        tier,
        amount: product.amount,
        status: "pending",
        snap_token: midtransData.token,
        redirect_url: midtransData.redirect_url,
        invoice_number: invoiceNumber,
      });

    if (insertError) {
      console.error("DB_INSERT_ERROR:", insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Gagal simpan ke DB: " + insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
console.log(`[${orderId}] Berhasil membuat token Snap.`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        snap_token: midtransData.token,
        redirect_url: midtransData.redirect_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("CRITICAL_ERROR:", e.message);
    return new Response(
      JSON.stringify({ success: false, message: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


