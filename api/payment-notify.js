// api/payment-notify.js
// Webhook appelé automatiquement par CinetPay quand un paiement est confirmé.
// Ajoute les crédits correspondants au compte de l'utilisateur dans Supabase.
//
// Variables d'environnement nécessaires sur Vercel :
//   CINETPAY_API_KEY
//   CINETPAY_SITE_ID
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY  (clé service_role, PAS la clé publique)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { cpm_trans_id, cpm_site_id } = req.body;
    if (!cpm_trans_id) return res.status(400).json({ error: 'transaction_id manquant' });

    // 1. Vérifier le statut réel du paiement auprès de CinetPay (ne jamais faire confiance au webhook brut)
    const checkPayload = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: cpm_trans_id
    };

    const checkRes = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkPayload)
    });
    const checkData = await checkRes.json();

    if (checkData.code !== '00' || checkData.data?.status !== 'ACCEPTED') {
      return res.status(200).json({ status: 'ignored', reason: 'Paiement non confirmé' });
    }

    const userId = checkData.data.metadata; // récupéré depuis le payload initial
    const amountPaid = parseInt(checkData.data.amount, 10);

    // Table de correspondance montant -> crédits (à ajuster selon tes tarifs)
    const creditPacks = {
      500: 20,
      1000: 50,
      2000: 120,
      5000: 350
    };
    const creditsToAdd = creditPacks[amountPaid] || Math.floor(amountPaid / 25);

    // 2. Créditer le compte utilisateur dans Supabase via l'API REST (clé service_role, écriture directe)
    const supaRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const profiles = await supaRes.json();
    const currentCredits = profiles[0]?.credits || 0;

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ credits: currentCredits + creditsToAdd })
    });

    res.status(200).json({ status: 'ok', credited: creditsToAdd });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', message: e.message });
  }
}
