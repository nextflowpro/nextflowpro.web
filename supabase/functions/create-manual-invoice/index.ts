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

function makeOrderId(tier: string) {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `NFP-${tier.toUpperCase()}-${Date.now()}-${random}`;
}

async function sendInvoiceEmail(params: {
  to: string;
  tier: string;
  invoiceNumber: string;
  amount: number;
  orderId: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "Nextflow Pro <admin@nextflowpro.web.id>";
  const inboundDomain = Deno.env.get("INBOUND_EMAIL_DOMAIN") || "reply.nextflowpro.web.id";
  const replyTo = `payment-${params.orderId}@${inboundDomain}`;

  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping email.");
    return;
  }

  const bankName = Deno.env.get("BANK_NAME") || "BCA";
  const bankAccount = Deno.env.get("BANK_ACCOUNT") || "7925184291";
  const bankHolder = Deno.env.get("BANK_HOLDER") || "Muhammad Ihsan Kamal";
  const qrisUrl = Deno.env.get("QRIS_IMAGE_URL") || "";

  const bankName2 = Deno.env.get("BANK_NAME_2") || "";
  const bankAccount2 = Deno.env.get("BANK_ACCOUNT_2") || "";
  const bankHolder2 = Deno.env.get("BANK_HOLDER_2") || "";

  let qrisSection = "";
  if (qrisUrl) {
    qrisSection = `
      <div style="text-align: center; margin: 24px 0; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 12px; background-color: #f8fafc;">
        <p style="margin: 0 0 12px; font-weight: 700; color: #0f172a; font-size: 14px;">Atau Scan QRIS di bawah ini:</p>
        <img src="${qrisUrl}" alt="QRIS Code" style="max-width: 200px; height: auto; display: block; margin: 0 auto; border-radius: 8px;" />
      </div>
    `;
  }

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tagihan Pembayaran Nextflow Pro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">

  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
          
          <!-- HEADER -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 32px 24px;">
              <img src="https://nextflowpro.github.io/nextflowpro.web/assets/text_only.png" alt="NextFlow Pro" style="height: 32px; display: block; border: none;">
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 40px 32px;">
              
              <div style="display: inline-block; padding: 6px 16px; background-color: #fef3c7; color: #d97706; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">
                ⚠️ MENUNGGU PEMBAYARAN
              </div>

              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.2;">
                Tagihan Pembayaran Nextflow Pro
              </h1>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                Terima kasih telah memilih <strong>Nextflow Pro</strong>. Silakan lakukan transfer pembayaran sesuai rincian di bawah ini. Setelah membayar, <strong>silakan balas/reply email ini dengan melampirkan foto bukti transfer/resi pembayaran</strong>.
              </p>

              <!-- PAYMENT DETAILS -->
              <div style="background-color: #f1f5f9; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 16px; text-align: center;">Tujuan Transfer Bank</div>
                
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  ${
                    bankName2 && bankAccount2
                      ? `
                      <tr>
                        <td style="padding: 4px 0; color: #475569; font-size: 14px; font-weight: 600;" colspan="2">Pilihan Rekening 1:</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0 8px 12px; color: #475569; font-size: 14px;">Bank / Atas Nama</td>
                        <td style="padding: 4px 0 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right;">${bankName} <br><span style="font-size: 12px; color: #64748b; font-weight: normal;">a/n ${bankHolder}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0 8px 12px; color: #475569; font-size: 14px;">Nomor Rekening</td>
                        <td style="padding: 4px 0 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right; font-family: monospace;">${bankAccount}</td>
                      </tr>
                      <tr style="border-top: 1px dashed #cbd5e1;">
                        <td style="padding: 12px 0 4px; color: #475569; font-size: 14px; font-weight: 600;" colspan="2">Pilihan Rekening 2:</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0 8px 12px; color: #475569; font-size: 14px;">Bank / Atas Nama</td>
                        <td style="padding: 4px 0 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right;">${bankName2} <br><span style="font-size: 12px; color: #64748b; font-weight: normal;">a/n ${bankHolder2 || bankHolder}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0 8px 12px; color: #475569; font-size: 14px;">Nomor Rekening</td>
                        <td style="padding: 4px 0 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right; font-family: monospace;">${bankAccount2}</td>
                      </tr>
                      `
                      : `
                      <tr>
                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">Bank</td>
                        <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right;">${bankName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">Nomor Rekening</td>
                        <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right; font-family: monospace;">${bankAccount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #475569; font-size: 14px;">Atas Nama</td>
                        <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-size: 14px; text-align: right;">${bankHolder}</td>
                      </tr>
                      `
                  }
                  <tr style="border-top: 1px solid #cbd5e1;">
                    <td style="padding: 12px 0 0; color: #475569; font-size: 14px; font-weight: 600;">Jumlah Transfer</td>
                    <td style="padding: 12px 0 0; font-weight: 800; color: #0f9f88; font-size: 18px; text-align: right;">Rp ${params.amount.toLocaleString("id-ID")}</td>
                  </tr>
                </table>

                ${qrisSection}
              </div>

              <!-- TRANSACTION INFO -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 12px; display: table;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="color: #64748b; font-size: 13px; padding: 12px 16px; text-align: left;">Paket</td>
                  <td style="font-weight: 600; color: #0f172a; font-size: 13px; padding: 12px 16px; text-align: right;">${params.tier}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="color: #64748b; font-size: 13px; padding: 12px 16px; text-align: left;">Nomor Invoice</td>
                  <td style="font-weight: 600; color: #0f172a; font-size: 13px; padding: 12px 16px; text-align: right;">${params.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding: 12px 16px; text-align: left;">Order ID</td>
                  <td style="font-weight: 600; color: #0f172a; font-size: 13px; padding: 12px 16px; text-align: right; font-family: monospace;">${params.orderId}</td>
                </tr>
              </table>

              <!-- INSTRUCTION BOX -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="color:#1e40af; font-size:14px; font-weight:700; margin:0 0 6px;">
                      💡 Langkah Selanjutnya
                    </p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height:1.6; color: #1e3a8a;">
                      <li>Lakukan transfer sebesar <strong>Rp ${params.amount.toLocaleString("id-ID")}</strong> ke rekening di atas.</li>
                      <li>Foto atau screenshot bukti pembayaran/resi transfer Anda.</li>
                      <li><strong>Balas (Reply)</strong> email ini dengan melampirkan foto bukti pembayaran tersebut.</li>
                      <li>Sistem kami akan memverifikasi dan mengirimkan token aktivasi lisensi ke email Anda secara otomatis.</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; text-align: center; color: #94a3b8; margin: 0;">
                Ada pertanyaan? Balas email ini atau hubungi support kami via WhatsApp di <a href="https://wa.me/6281234899273" style="color: #0f9f88; text-decoration: none; font-weight: 600;">+62 812-3489-9273</a>.
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding: 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">
                &copy; 2026 <strong>NextFlow Pro</strong>. Hak Cipta Dilindungi.<br>
                Email ini dikirim otomatis oleh sistem billing NextFlow Pro.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;

  console.log(`[${params.orderId}] Mengirim email invoice ke ${params.to} dengan reply-to ${replyTo}...`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      reply_to: replyTo,
      subject: `Tagihan Pembayaran Nextflow Pro - ${params.tier} (${params.invoiceNumber})`,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("RESEND_ERROR:", data);
    throw new Error(data.message || "Gagal mengirim email tagihan");
  } else {
    console.log("INVOICE_EMAIL_SENT_SUCCESS:", data.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Validasi Secrets
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Konfigurasi server (Secrets) belum lengkap di dashboard Supabase.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
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
        invoice_number: invoiceNumber,
        payment_type: "manual_transfer",
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

    console.log(`[${orderId}] Berhasil membuat record transaksi pending.`);

    // Kirim email tagihan/invoice
    await sendInvoiceEmail({
      to: email,
      tier,
      invoiceNumber,
      amount: product.amount,
      orderId,
    });

    // Update status invoice sent
    await adminClient
      .from("payment_transactions")
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq("order_id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        invoice_number: invoiceNumber,
        message: "Invoice email successfully sent",
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
