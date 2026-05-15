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
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto;">
      <h2>Token Lisensi Free Trial Nextflow Pro</h2>
      <p>Terima kasih telah mencoba Nextflow Pro.</p>

      <h3>Detail Lisensi</h3>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse;">
        <tr>
          <td><strong>Paket</strong></td>
          <td>Free Trial (3 Hari)</td>
        </tr>
        <tr>
          <td><strong>Token Lisensi</strong></td>
          <td><code style="font-size: 16px;">${params.licenseKey}</code></td>
        </tr>
      </table>

      <p style="margin-top: 20px;">
        Cara aktivasi:
      </p>
      <ol>
        <li>Buka aplikasi Nextflow Pro.</li>
        <li>Masukkan token lisensi di atas.</li>
      </ol>

      <p>
        Jika Anda menyukai fitur kami, jangan ragu untuk upgrade ke paket Pro!
      </p>
    </div>
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

