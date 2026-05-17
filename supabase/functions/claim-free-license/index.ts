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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', Helvetica, Arial, sans-serif;
      background-color: #0a1628;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a1628;">

  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0a1628; padding: 40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #122851; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <img src="https://nextflowpro.github.io/nextflowpro.web/assets/text_only.png" alt="NextFlow Pro" style="height: 36px; width: auto; display: block; margin: 0 auto; border: none;">
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
              
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #07153b 0%, #1a3a6e 100%); background-color: #0f2557;">
                <tr>
                  <td align="center" style="padding: 48px 32px;">
                    
                    <div style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.15); border-radius: 50%; margin: 0 auto 20px; display: inline-block; text-align: center;">
                      <div style="width: 52px; height: 52px; background: linear-gradient(135deg, #0d9488, #14b8a6); background-color: #0d9488; border-radius: 50%; display: inline-block; margin-top: 8px; line-height: 52px; font-size: 24px;">
                        🎁
                      </div>
                    </div>

                    <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0 0 8px; letter-spacing: -0.5px; line-height: 1.3;">
                      Lisensi Free Trial Terbit!
                    </h1>
                    <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0; line-height: 1.5;">
                      Token lisensi uji coba gratis untuk mencoba<br>aplikasi NextFlow Pro Anda
                    </p>

                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto 0;">
                      <tr>
                        <td style="background-color: rgba(13,148,136,0.2); border: 1px solid rgba(13,148,136,0.5); border-radius: 50px; padding: 4px 12px; color: #5eead4; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;">
                          ● SECURE
                        </td>
                        <td width="8"></td>
                        <td style="background-color: rgba(212,168,71,0.15); border: 1px solid rgba(212,168,71,0.5); border-radius: 50px; padding: 4px 12px; color: #f0c85a; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;">
                          ★ FREE TRIAL
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 40px 32px 32px;">
                    
                    <p style="color:#374151; font-size:16px; font-weight:600; margin:0 0 8px;">
                      Halo Operator Hebat Puskesmas! 👋
                    </p>
                    <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 32px;">
                      Terima kasih telah mencoba <strong style="color:#0f2557;">NextFlow Pro</strong> — platform otomasi entri data terdepan untuk operator puskesmas modern. Token lisensi uji coba gratis Anda sudah siap digunakan.
                    </p>

                    <div style="background-color: #0f172a; border-radius: 20px; padding: 32px; color: #ffffff; text-align: center; margin: 32px 0;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 12px;">Token Lisensi Free Trial</div>
                      <div style="font-family: 'Monaco', 'Consolas', monospace; font-size: 24px; font-weight: 700; color: #fbbf24; letter-spacing: 2px;">${params.licenseKey}</div>
                      <div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">Simpan kode ini dengan aman</div>
                    </div>

                    <table class="transaction-details" style="width: 100%; border-collapse: collapse; margin: 32px 0; border: 1px solid #f1f5f9; border-radius: 16px; display: table;">
                      <tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Paket</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">Free Trial (3 Hari)</td>
                      </tr>
                      <tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Total Biaya</td>
                        <td class="detail-value" style="font-weight: 600; color: #10b981; font-size: 14px; padding: 12px 16px; text-align: right;">Gratis (Rp 0)</td>
                      </tr>
                      <tr class="detail-row">
                        <td class="detail-label" style="color: #475569; font-size: 14px; padding: 12px 16px; text-align: left;">Metode Aktivasi</td>
                        <td class="detail-value" style="font-weight: 600; color: #0f172a; font-size: 14px; padding: 12px 16px; text-align: right;">Klaim Langsung</td>
                      </tr>
                    </table>

                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-left: 4px solid #fbbf24; border-radius: 0 8px 8px 0; margin-bottom: 32px;">
                      <tr>
                        <td style="padding: 16px;">
                          <p style="color:#92400e; font-size:13px; font-weight:700; margin:0 0 4px;">
                            💡 &nbsp;Cara Aktivasi
                          </p>
                          <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height:1.6; color: #4b5563;">
                            <li>Buka aplikasi <strong>Nextflow Pro</strong> di laptop Anda.</li>
                            <li>Masuk ke menu <strong>Lisensi/Aktivasi</strong>.</li>
                            <li>Copy & Paste token di atas ke kolom yang tersedia.</li>
                            <li>Klik <strong>Aktifkan</strong> dan nikmati fitur otomatisasi!</li>
                          </ol>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">

              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 24px 32px 32px;">
                    <p style="color:#9ca3af; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin:0 0 24px;">
                      Fitur Yang Bisa Anda Coba
                    </p>
                    
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" align="center" valign="top" style="padding: 0 8px;">
                          <div style="background-color: #eff6ff; width: 44px; height: 44px; border-radius: 12px; line-height: 44px; font-size: 20px; margin: 0 auto 10px;">⚡</div>
                          <p style="color:#1e40af; font-size:12px; font-weight:700; margin:0 0 4px;">Entri Otomatis</p>
                          <p style="color:#9ca3af; font-size:11px; margin:0; line-height:1.4;">Hemat 80% waktu</p>
                        </td>
                        
                        <td width="33%" align="center" valign="top" style="padding: 0 8px;">
                          <div style="background-color: #f0fdf4; width: 44px; height: 44px; border-radius: 12px; line-height: 44px; font-size: 20px; margin: 0 auto 10px;">🔐</div>
                          <p style="color:#166534; font-size:12px; font-weight:700; margin:0 0 4px;">Data Aman</p>
                          <p style="color:#9ca3af; font-size:11px; margin:0; line-height:1.4;">Enkripsi AES-256</p>
                        </td>
                        
                        <td width="33%" align="center" valign="top" style="padding: 0 8px;">
                          <div style="background-color: #fff7ed; width: 44px; height: 44px; border-radius: 12px; line-height: 44px; font-size: 20px; margin: 0 auto 10px;">📊</div>
                          <p style="color:#c2410c; font-size:12px; font-weight:700; margin:0 0 4px;">Laporan Instan</p>
                          <p style="color:#9ca3af; font-size:11px; margin:0; line-height:1.4;">Export PDF & Excel</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 24px 16px;">
              <p style="color:#6b7280; font-size:12px; margin:0 0 6px;">
                Butuh bantuan? &nbsp;
                <a href="mailto:nextflow.auto@gmail.com" style="color:#0d9488; text-decoration:none; font-weight:600;">nextflow.auto@gmail.com</a>
                &nbsp;·&nbsp;
                <a href="https://wa.me/6281234899273" style="color:#0d9488; text-decoration:none; font-weight:600;">+62 812-3489-9273</a>
              </p>
              <p style="color:#4b5563; font-size:11px; margin:0;">
                © 2026 <strong>NextFlow Pro</strong> · Hak Cipta Dilindungi
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

