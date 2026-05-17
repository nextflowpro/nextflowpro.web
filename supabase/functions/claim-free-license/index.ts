import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Cek User Login
    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Harap login terlebih dahulu" }), { status: 401, headers: corsHeaders });
    }

    // 2. Cek apakah sudah pernah klaim
    const { data: existingClaim } = await adminClient
      .from("free_trial_claims")
      .select("id, license_key")
      .eq("user_id", user.id)
      .single();

    if (existingClaim) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Anda sudah pernah mengklaim Paket Free.",
        license_key: existingClaim.license_key 
      }), { status: 400, headers: corsHeaders });
    }

    // 3. Generate Lisensi 'Free'
    const { data: licenseResult, error: licenseError } = await adminClient.rpc(
      "generate_license",
      { p_user_id: user.id, p_tier: "Free" }
    );

    if (licenseError || !licenseResult?.success) {
      throw new Error(licenseError?.message || "Gagal membuat lisensi");
    }

    const licenseKey = licenseResult.license_key;

    // 4. Catat ke tabel free_trial_claims agar tidak bisa klaim dua kali
    await adminClient.from("free_trial_claims").insert({
      user_id: user.id,
      email: user.email,
      license_key: licenseKey
    });

    // 5. Kirim Email
    await sendFreeLicenseEmail({
      to: user.email!,
      licenseKey: licenseKey
    });

    // 6. Kembalikan lisensi ke Frontend
    return new Response(JSON.stringify({ success: true, license_key: licenseKey }), {
      status: 200, headers: corsHeaders,
    });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), {
      status: 500, headers: corsHeaders,
    });
  }
});

async function sendFreeLicenseEmail(params: {
  to: string;
  licenseKey: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") || "Nextflow Pro <admin@nextflowpro.web.id>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping email.");
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lisensi Free Trial Nextflow Pro</title>
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
                <div class="badge" style="background:#e0f2fe;color:#0284c7;">Free Trial Aktif</div>
                <h1>Lisensi Free Trial Anda Telah Terbit</h1>
                <p>Halo,</p>
                <p>Terima kasih telah mencoba Nextflow Pro. Token lisensi uji coba Anda sudah siap digunakan untuk mengaktifkan fitur otomatisasi.</p>
                <div class="license-card">
                    <div class="license-label">Token Lisensi Free Trial</div>
                    <div class="license-key">${params.licenseKey}</div>
                    <div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">Simpan kode ini dengan aman</div>
                </div>
                <div class="transaction-details">
                    <div class="detail-row">
                        <span class="detail-label">Paket</span>
                        <span class="detail-value">Free Trial (3 Hari)</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Biaya</span>
                        <span class="detail-value" style="color:#10b981;">Gratis (Rp 0)</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Metode Aktivasi</span>
                        <span class="detail-value">Klaim Langsung</span>
                    </div>
                </div>
                <div class="instructions">
                    <div class="instructions-title">💡 Cara Aktivasi</div>
                    <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #92400e;">
                        <li>Buka aplikasi <strong>Nextflow Pro</strong> di laptop Anda.</li>
                        <li>Masuk ke menu <strong>Lisensi/Aktivasi</strong>.</li>
                        <li>Copy & Paste token di atas ke kolom yang tersedia.</li>
                        <li>Klik <strong>Aktifkan</strong> dan nikmati fitur otomatisasi!</li>
                    </ol>
                </div>
                <p style="font-size: 14px; text-align: center; color: #94a3b8; margin: 0;">
                    Jika Anda menyukai fitur kami, jangan ragu untuk upgrade ke paket Pro untuk kuota hits yang lebih besar!
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

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `Token Free Trial Nextflow Pro`,
        html,
      }),
    });
  } catch (err) {
    console.error("Failed to send free license email:", err);
  }
}

