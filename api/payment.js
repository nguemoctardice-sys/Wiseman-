// api/payment.js
// Backend d'initiation de paiement CinetPay pour l'achat de crédits Wiseman AI
// Nécessite les variables d'environnement sur Vercel :
//   CINETPAY_API_KEY
//   CINETPAY_SITE_ID

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { amount, currency, description, customer_email, user_id, transaction_id } = req.body;

    if (!amount || !user_id || !transaction_id) {
      return res.status(400).json({ error: 'Paramètres manquants (amount, user_id, transaction_id)' });
    }

    const payload = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: transaction_id,
      amount: amount,
      currency: currency || 'XAF',
      description: description || 'Recharge de crédits Wiseman AI',
      customer_email: customer_email || '',
      notify_url: 'https://wiseman-pearl.vercel.app/api/payment-notify',
      return_url: 'https://wiseman-pearl.vercel.app/',
      channels: 'ALL',
      metadata: user_id // permet de retrouver l'utilisateur lors de la confirmation
    };

    const r = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', message: e.message });
  }
}
