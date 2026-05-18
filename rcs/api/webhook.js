import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Inizializza Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// L'inizializzazione di Supabase verrà fatta all'interno dell'handler
// per garantire che Vercel abbia caricato le variabili d'ambiente.

// Disabilita il body parser predefinito di Next.js/Vercel
// Questo è NECESSARIO per leggere il raw body e validare la firma di Stripe
export const config = {
    api: {
        bodyParser: false,
    },
};

// Funzione helper per leggere il raw body della richiesta (senza moduli esterni)
const buffer = async (req) => {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    let event;

    try {
        // Leggi il raw body e la firma di Stripe dagli headers
        const rawBody = await buffer(req);
        const signature = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        // Valida la firma per assicurarti che l'evento provenga veramente da Stripe
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gestisci l'evento checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Estrai le informazioni del cliente e ordine
        const customerName = session.customer_details?.name || 'Cliente Sconosciuto';
        const customerEmail = session.customer_details?.email || '';
        const amountTotal = session.amount_total / 100; // Da centesimi a euro

        // Estrai l'indirizzo di spedizione (se presente)
        const shipping = session.shipping_details?.address || {};
        // Mantengo fullAddress casomai servisse, ma a Supabase passiamo un oggetto JSON dato che si aspetta jsonb
        const fullAddress = `${shipping.line1 || ''} ${shipping.line2 || ''}, ${shipping.postal_code || ''} ${shipping.city || ''}, ${shipping.country || ''}`.trim() || 'Indirizzo non fornito';

        // Estrai il Codice Fiscale (dai custom_fields)
        const customFields = session.custom_fields || [];
        const cfField = customFields.find(field => field.key === 'codice_fiscale');
        const codiceFiscale = cfField && cfField.text ? cfField.text.value : null;

        // Recupera line items dalla sessione Stripe (non inclusi di default nell'event)
        let items = null;
        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ['data.price.product'] });
            items = lineItems.data.map(li => ({
                name: li.description || li.price?.product?.name || 'Articolo',
                quantity: li.quantity,
                unit_amount: (li.price?.unit_amount ?? 0) / 100,
                amount_subtotal: (li.amount_subtotal ?? 0) / 100,
                amount_total: (li.amount_total ?? 0) / 100,
                product_id: li.price?.product?.id || null
            }));
        } catch (e) {
            console.warn('Impossibile recuperare line_items dalla sessione Stripe:', e.message);
        }

        try {
            // Recupera le variabili d'ambiente (spostato qui per sicurezza su Vercel)
            const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) {
                console.error("ERRORE CRITICO: Variabili d'ambiente Supabase mancanti in Vercel!");
                throw new Error("Variabili Supabase non configurate.");
            }

            const supabase = createClient(supabaseUrl, supabaseKey);

            // Salva nel database Supabase
            const { data, error } = await supabase
                .from('orders')
                .insert([
                    {
                        stripe_session_id: session.id,
                        customer_name: customerName,
                        customer_email: customerEmail,
                        tax_id: codiceFiscale,
                        // Su Supabase shipping_address è di tipo JSONB, per cui passiamo un oggetto
                        shipping_address: { testo_completo: fullAddress, ...shipping },
                        items,
                        total_amount: amountTotal,
                        status: 'paid'
                        // Nota: rimosso payment_status poiché la colonna non esiste nel database
                    }
                ]);

            if (error) {
                console.error('Supabase Error saving order:', error);
                // Non tiriamo l'errore per non far ritentare Stripe se è un problema del nostro DB
            } else {
                console.log('✅ Ordine salvato con successo nel DB!');
            }
        } catch (dbErr) {
            console.error('Errore durante il salvataggio nel database:', dbErr);
        }
    } else {
        console.log(`Evento ignorato: ${event.type}`);
    }

    // Restituisci 200 OK a Stripe per confermare la ricezione
    res.status(200).json({ received: true });
}
