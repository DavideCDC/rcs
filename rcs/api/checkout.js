import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    try {
        // 1. Ricevi l'array del carrello dal frontend
        const { cart } = req.body;
        
        if (!cart || cart.length === 0) {
            return res.status(400).json({ error: "Il carrello è vuoto" });
        }

        // ATTENZIONE: In produzione, dovresti mappare gli ID e scaricare i 
        // prezzi reali dal database Supabase qui sul server per sicurezza!
        // Per ora, utilizziamo il prezzo temporaneo passato dal frontend.
        const line_items = cart.map(item => {
            const unitAmountCents = Math.round(item.price * 100);
            return {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: item.name,
                    },
                    unit_amount: unitAmountCents,
                },
                quantity: item.quantity,
            };
        });

        // 2. Crea la sessione di Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items,
            mode: 'payment',
            success_url: `https://${req.headers.host}/success.html`, // Pagina se paga
            cancel_url: `https://${req.headers.host}/index.html`, // Pagina se annulla
        });

        // 3. Restituisci l'URL di Stripe al frontend
        res.status(200).json({ url: session.url });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}