import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

    try {
        const { cart } = req.body || {};

        // ── Validazione input client ──
        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: "Il carrello è vuoto" });
        }
        if (cart.length > 50) {
            return res.status(400).json({ error: "Carrello troppo grande" });
        }

        // Mappa quantità per id (deduplica eventuali doppioni dal client)
        const quantitiesById = new Map();
        for (const item of cart) {
            const id = item && item.product_id ? String(item.product_id) : null;
            const qty = Number(item && item.quantity);
            if (!id || !Number.isInteger(qty) || qty <= 0 || qty > 999) {
                return res.status(400).json({ error: "Voce carrello non valida" });
            }
            quantitiesById.set(id, (quantitiesById.get(id) || 0) + qty);
        }

        // ── Carica prezzi REALI da Supabase (server-side, non si fida del client) ──
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            console.error("ERRORE: variabili d'ambiente Supabase mancanti per checkout");
            return res.status(500).json({ error: "Configurazione server incompleta" });
        }
        const supabase = createClient(supabaseUrl, supabaseKey);

        const ids = Array.from(quantitiesById.keys());
        const { data: products, error: dbErr } = await supabase
            .from('products')
            .select('id, name, price, is_active, is_quote_only')
            .in('id', ids);

        if (dbErr) {
            console.error('Supabase error fetching products:', dbErr);
            return res.status(500).json({ error: "Errore nel caricamento prodotti" });
        }
        if (!products || products.length === 0) {
            return res.status(400).json({ error: "Prodotti non trovati" });
        }

        // ── Costruisci line_items con prezzi server-side ──
        const line_items = [];
        for (const p of products) {
            if (!p.is_active || p.is_quote_only) continue;
            const price = Number(p.price);
            if (!Number.isFinite(price) || price <= 0) continue;
            const qty = quantitiesById.get(String(p.id));
            if (!qty) continue;
            line_items.push({
                price_data: {
                    currency: 'eur',
                    product_data: { name: String(p.name).slice(0, 250) },
                    unit_amount: Math.round(price * 100),
                },
                quantity: qty,
            });
        }
        if (line_items.length === 0) {
            return res.status(400).json({ error: "Nessun prodotto valido nel carrello" });
        }

        // ── URL forwarding header sanitization ──
        // req.headers.host può essere spoofato; restringo a host noti
        const ALLOWED_HOSTS = new Set([
            'rcs-davidegasbarri6-9643s-projects.vercel.app',
            'rcs.vercel.app',
        ]);
        const rawHost = String(req.headers.host || '').toLowerCase();
        const host = ALLOWED_HOSTS.has(rawHost) ? rawHost : 'rcs-davidegasbarri6-9643s-projects.vercel.app';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            shipping_address_collection: { allowed_countries: ['IT'] },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 1000, currency: 'eur' },
                        display_name: 'Spedizione Standard in Italia',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 3 },
                            maximum: { unit: 'business_day', value: 5 },
                        },
                    },
                },
            ],
            custom_fields: [
                {
                    key: 'codice_fiscale',
                    label: { type: 'custom', custom: 'Codice Fiscale (per fattura)' },
                    type: 'text',
                    optional: false,
                }
            ],
            success_url: `https://${host}/success.html`,
            cancel_url: `https://${host}/index.html`,
        });

        return res.status(200).json({ url: session.url });

    } catch (err) {
        console.error('Checkout error:', err);
        return res.status(500).json({ error: "Errore nell'avvio del pagamento" });
    }
}
