import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha512(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isPaymentSuccess(transactionStatus: string, fraudStatus?: string) {
  if (transactionStatus === "settlement") return true;
  if (transactionStatus === "capture") {
    return fraudStatus === "accept" || !fraudStatus;
  }
  return false;
}

function mapMidtransStatus(transactionStatus: string) {
  switch (transactionStatus) {
    case "settlement":
    case "capture":
      return "paid";
    case "pending":
      return "pending";
    case "expire":
      return "expired";
    case "cancel":
    case "deny":
      return "failed";
    case "refund":
    case "partial_refund":
      return "refunded";
    default:
      return "pending";
  }
}

async function sendLicenseEmail(params: {
  to: string;
  tier: string;
  licenseKey: string;
  invoiceNumber: string;
  amount: number;
  paymentType?: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "Nextflow Pro <admin@nextflowpro.web.id>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping email.");
    return;
  }

  // Map Payment Type to readable name
  const paymentMethodMap: Record<string, string> = {
    "bank_transfer": "Bank Transfer",
    "cstore": "Convenience Store",
    "qris": "QRIS",
    "credit_card": "Credit Card",
    "echannel": "Mandiri Bill",
    "permata_va": "Permata VA",
    "gopay": "GoPay",
    "shopeepay": "ShopeePay"
  };
  const methodLabel = paymentMethodMap[params.paymentType || ""] || params.paymentType || "Online Payment";

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lisensi Nextflow Pro</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        :root { --primary: #3b82f6; --success: #10b981; --slate-900: #0f172a; --slate-600: #475569; --slate-400: #94a3b8; --slate-100: #f1f5f9; --white: #ffffff; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 0; background-color: #f8fafc; }
        .wrapper { width: 100%; padding: 40px 20px; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); }
        .header { background: #0f172a; padding: 40px 20px; text-align: center; }
        .content { padding: 48px; }
        .badge { display: inline-block; padding: 6px 16px; background: #ecfdf5; color: #10b981; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 24px; }
        h1 { margin: 0 0 16px 0; font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; }
        p { margin: 0 0 24px 0; color: #475569; font-size: 16px; }
        .license-card { background: #0f172a; border-radius: 20px; padding: 32px; color: #ffffff; text-align: center; margin: 32px 0; position: relative; overflow: hidden; }
        .license-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 12px; }
        .license-key { font-family: 'Monaco', 'Consolas', monospace; font-size: 24px; font-weight: 700; color: #fbbf24; letter-spacing: 2px; }
        .transaction-details { border: 1px solid #f1f5f9; border-radius: 16px; padding: 24px; margin-bottom: 32px; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #475569; font-size: 14px; }
        .detail-value { font-weight: 600; color: #0f172a; font-size: 14px; }
        .instructions { background: #fffbeb; border-left: 4px solid #fbbf24; padding: 20px; border-radius: 12px; margin-bottom: 32px; }
        .instructions-title { font-weight: 700; color: #92400e; font-size: 14px; margin-bottom: 8px; }
        .footer { padding: 40px; background: #f1f5f9; text-align: center; }
        .copyright { font-size: 12px; color: #94a3b8; }
        @media (max-width: 480px) { .content { padding: 32px 24px; } h1 { font-size: 24px; } .license-key { font-size: 18px; } }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <img src="https://nextflowpro.github.io/nextflowpro.web/assets/text_only.png" alt="Nextflow Pro" style="height: 32px;">
            </div>
            <div class="content">
                <div class="badge">Pembayaran Berhasil</div>
                <h1>Lisensi Nextflow Pro Anda Telah Terbit</h1>
                <p>Halo,</p>
                <p>Terima kasih telah memilih Nextflow Pro. Token lisensi Anda sudah siap digunakan untuk mengaktifkan fitur premium.</p>
                <div class="license-card">
                    <div class="license-label">Token Lisensi Premium</div>
                    <div class="license-key">${params.licenseKey}</div>
                    <div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">Simpan kode ini dengan aman</div>
                </div>
                <table class="transaction-details" style="width: 100%; border-collapse: collapse; margin: 32px 0; border: 1px solid #f1f5f9; border-radius: 16px; display: table;">
                    <tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Paket</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">${params.tier}</td>
                    </tr>
                    <tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Nomor Invoice</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">${params.invoiceNumber || "-"}</td>
                    </tr>
                    <tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Total Pembayaran</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">Rp ${params.amount.toLocaleString("id-ID")}</td>
                    </tr>
                    <tr class="detail-row">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Metode Pembayaran</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">${methodLabel}</td>
                    </tr>
                </table>
                <div class="instructions">
                    <div class="instructions-title">💡 Cara Aktivasi</div>
                    <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #92400e;">
                        <li>Buka aplikasi <strong>Nextflow Pro</strong> di laptop Anda.</li>
                        <li>Masuk ke menu <strong>Lisensi/Aktivasi</strong>.</li>
                        <li>Copy & Paste token di atas ke kolom yang tersedia.</li>
                        <li>Klik <strong>Aktifkan</strong> dan nikmati fitur premium!</li>
                    </ol>
                </div>
                <p style="font-size: 14px; text-align: center; color: #94a3b8; margin: 0;">
                    Butuh bantuan? Balas email ini atau hubungi support kami via WhatsApp.
                </p>
            </div>
            <div class="footer">
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nextflow Pro. Hak Cipta Dilindungi.<br>
                    Sent from Nextflow Pro Team
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: `Token Lisensi Nextflow Pro - ${params.tier}`,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("RESEND_ERROR:", data);
  } else {
    console.log("EMAIL_SENT_SUCCESS:", data.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY")?.trim();

    if (!supabaseUrl || !serviceRoleKey || !midtransServerKey) {
      throw new Error("Missing secrets for webhook processing");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const notif = await req.json();

    const {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      transaction_id: transactionId,
      payment_type: paymentType
    } = notif;

    console.log(`[${orderId}] Webhook received: ${transactionStatus}`);

    // Verify Signature
    const expectedSignature = await sha512(
      `${orderId}${statusCode}${grossAmount}${midtransServerKey}`,
    );

    if (expectedSignature !== signatureKey) {
      console.error(`[${orderId}] INVALID_SIGNATURE`, { expected: expectedSignature, received: signatureKey });
      return new Response(JSON.stringify({ success: false, message: "Invalid signature" }), { status: 403 });
    }

    const { data: tx, error: txError } = await adminClient
      .from("payment_transactions")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (txError || !tx) {
      console.error(`[${orderId}] TRANSACTION_NOT_FOUND`);
      return new Response(JSON.stringify({ success: false, message: "Transaction not found" }), { status: 404 });
    }

    const mappedStatus = mapMidtransStatus(transactionStatus);

    // If payment not success, just update status
    if (!isPaymentSuccess(transactionStatus, fraudStatus)) {
      await adminClient
        .from("payment_transactions")
        .update({
          status: mappedStatus,
          midtrans_transaction_id: transactionId,
          payment_type: paymentType,
          fraud_status: fraudStatus,
          raw_notification: notif,
        })
        .eq("order_id", orderId);

      return new Response(JSON.stringify({ success: true, message: "Status updated", status: mappedStatus }), { status: 200 });
    }

    // Idempotency check
    if (tx.status === "paid" && tx.license_key) {
      console.log(`[${orderId}] ALREADY_PROCESSED`);
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), { status: 200 });
    }

    // Generate license via RPC
    const { data: licenseResult, error: licenseError } = await adminClient.rpc(
      "generate_license",
      { p_user_id: tx.user_id, p_tier: tx.tier }
    );

    if (licenseError || !licenseResult?.success) {
      console.error(`[${orderId}] LICENSE_GENERATE_ERROR:`, licenseError || licenseResult);
      return new Response(JSON.stringify({ success: false, message: "Failed to generate license" }), { status: 500 });
    }

    const licenseKey = licenseResult.license_key;

    // Update Transaction as PAID
    await adminClient
      .from("payment_transactions")
      .update({
        status: "paid",
        midtrans_transaction_id: transactionId,
        payment_type: paymentType,
        fraud_status: fraudStatus,
        raw_notification: notif,
        license_key: licenseKey,
        license_generated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    // Sync User Profile
    await adminClient
      .from("profiles")
      .update({ subscription_tier: tx.tier })
      .eq("id", tx.user_id);

    // Send Email
    await sendLicenseEmail({
      to: tx.email,
      tier: tx.tier,
      licenseKey,
      invoiceNumber: tx.invoice_number,
      amount: tx.amount,
      paymentType: paymentType,
    });

    await adminClient
      .from("payment_transactions")
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq("order_id", orderId);

    console.log(`[${orderId}] WEBHOOK_COMPLETE: License delivered to ${tx.email}`);

    return new Response(JSON.stringify({ success: true, message: "Processed" }), { status: 200 });

  } catch (e) {
    console.error("WEBHOOK_CATCH_ERROR:", e.message);
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500 });
  }
});
