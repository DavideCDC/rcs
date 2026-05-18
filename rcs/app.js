/* ===================================
   RCS Srl — E-Commerce App Logic
   Supabase Integration + Cart + UI
   =================================== */

// ── Supabase Config ──
const supabaseUrl = 'https://vmgomrmxosagwwfpjidm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZ29tcm14b3NhZ3d3ZnBqaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5OTQzMzEsImV4cCI6MjA4OTU3MDMzMX0.SR8N-tgIXV1VfB9tEFB9r6j8sMcyTaNFcqR9ny4HPnc';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ── Session & Cart State ──
function getSessionId() {
  let sid = localStorage.getItem('rcs_session_id');
  if (!sid) {
    sid = 'sess_' + crypto.randomUUID();
    localStorage.setItem('rcs_session_id', sid);
  }
  return sid;
}

const sessionId = getSessionId();
let cart = [];
const productsById = new Map();

// ── Format Price ──
function formatPrice(price) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}

// ── HTML/Attr Escape (anti-XSS per dati da Supabase) ──
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Per URL in attributi src/href: blocca javascript: e data: non-image
function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (/^\s*(javascript|vbscript):/i.test(s)) return '';
  if (/^\s*data:/i.test(s) && !/^\s*data:image\//i.test(s)) return '';
  return escapeHtml(s);
}

// ── Toast Notification ──
function showToast(message, icon = 'check') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';

  const icons = {
    check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
    cart: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg>`
  };

  toast.innerHTML = `${icons[icon] || icons.check}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ── Render Product Card ──
function renderProductCard(product, type = 'serbatoio') {
  const card = document.createElement('div');
  card.className = 'product-card reveal';
  card.style.position = 'relative'; // needed for ::before shimmer

  const tags = [];
  if (type === 'serbatoio') {
    if (product.is_patented) tags.push('<span class="product-tag patented">Brevettato</span>');
    if (!product.requires_vvf) tags.push('<span class="product-tag no-vvf">No VVF</span>');
  }

  const safeName = escapeHtml(product.name);
  const safeDesc = escapeHtml(product.description || '');
  const safeImg = safeUrl(product.image_url);
  const safeId = escapeHtml(product.id);
  const safeType = escapeHtml(type);
  const safePrice = escapeHtml(product.price);
  const safeSlug = escapeHtml(product.slug);

  card.innerHTML = `
    <div class="product-card-image">
      ${tags.join('')}
      <img src="${safeImg}" alt="${safeName}" loading="lazy">
    </div>
    <div class="product-card-body">
      <h3>${safeName}</h3>
      <p class="product-desc">${safeDesc}</p>
      <div class="product-price">
        <span class="price-currency">€</span> ${Number(product.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        <span class="price-vat">+ IVA</span>
      </div>
      <div class="product-actions">
        ${product.is_quote_only
          ? `<button class="btn btn-primary btn-sm btn-quote" data-id="${safeId}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Richiedi Preventivo
            </button>`
          : `<button class="btn btn-primary btn-sm btn-add-cart" data-id="${safeId}" data-type="${safeType}" data-name="${safeName}" data-price="${safePrice}" data-image="${safeImg}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>
              </svg>
              Aggiungi al carrello
            </button>`
        }
        <a href="#" class="details-link" data-id="${safeId}" data-slug="${safeSlug}">
          Vedi dettagli
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
          </svg>
        </a>
      </div>
    </div>
  `;

  return card;
}

// ── Load Products from Supabase ──
async function loadAndRenderProducts() {
  const serbatoiGrid = document.getElementById('products-grid');
  const accessoriGrid = document.getElementById('accessories-grid');

  if (serbatoiGrid) serbatoiGrid.innerHTML = '';
  if (accessoriGrid) accessoriGrid.innerHTML = '';

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select(`
        *,
        categories ( name, slug )
      `)
      .eq('is_active', true)
      .order('price', { ascending: true }); // optional ordering

    if (error) throw error;

    let hasSerbatoi = false;
    let hasAccessori = false;

    data.forEach((product, i) => {
      // Determina il tipo in base alla categoria
      const isSerbatoio = product.categories?.slug === 'serbatoi';
      const isAccessorio = product.categories?.slug === 'accessori';

      productsById.set(product.id, { ...product, _type: isSerbatoio ? 'serbatoio' : 'accessorio' });

      const card = renderProductCard(product, isSerbatoio ? 'serbatoio' : 'accessorio');

      // Stagger delay: position within its own grid (1-based, max 8)
      let gridPos = isSerbatoio
        ? (serbatoiGrid ? serbatoiGrid.childElementCount + 1 : 1)
        : (accessoriGrid ? accessoriGrid.childElementCount + 1 : 1);
      card.setAttribute('data-delay', Math.min(gridPos, 8));

      if (isSerbatoio && serbatoiGrid) {
        serbatoiGrid.appendChild(card);
        hasSerbatoi = true;
      } else if (isAccessorio && accessoriGrid) {
        accessoriGrid.appendChild(card);
        hasAccessori = true;
      }
    });

    if (!hasSerbatoi && serbatoiGrid) {
      serbatoiGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted); grid-column: 1/-1; padding: 40px;">Nessun serbatoio disponibile al momento.</p>';
    }
    if (!hasAccessori && accessoriGrid) {
      accessoriGrid.innerHTML = '<p style="text-align:center; color: var(--text-muted); grid-column: 1/-1; padding: 40px;">Nessun accessorio disponibile al momento.</p>';
    }

    observeRevealElements();
    attachCartListeners();
  } catch (err) {
    console.error('Error loading catalogs:', err);
    if (serbatoiGrid) serbatoiGrid.innerHTML = '<p style="text-align:center; color: var(--danger); grid-column: 1/-1; padding: 40px;">Errore nel caricamento del catalogo.</p>';
  }
}


// ── Cart Logic ──
function addToCart(productId, productType, name, price, image) {
  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: productId,
      product_type: productType,
      name: name,
      price: parseFloat(price),
      image: image,
      quantity: 1
    });
  }
  saveCart();
  updateCartUI();
  showToast(`${name} aggiunto al carrello`, 'cart');
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product_id !== productId);
  saveCart();
  updateCartUI();
}

function updateCartQuantity(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart();
  updateCartUI();
}

// Export for inline HTML event handlers
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

// ── Integrazione Checkout Stripe (Vercel) ──
window.checkoutCart = async function(btnElement) {
  if (cart.length === 0) return;

  try {
    if (btnElement) {
      btnElement.innerHTML = '<span class="loader"></span> Attendere...';
      btnElement.disabled = true;
    }
    
    // Chiama l'API su Vercel inviando l'intero array del carrello
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cart: cart })
    });

    const session = await response.json();

    // Reindirizza l'utente alla pagina di pagamento sicura di Stripe
    if (session.url) {
      window.location.href = session.url;
    } else {
      console.error("Errore dal server:", session.error);
      alert("Errore nell'avvio del pagamento.");
      if (btnElement) {
        btnElement.innerHTML = 'Procedi all\'ordine';
        btnElement.disabled = false;
      }
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    alert("Errore di connessione al server.");
    if (btnElement) {
      btnElement.innerHTML = 'Procedi all\'ordine';
      btnElement.disabled = false;
    }
  }
}

// ── Richiesta Preventivo Stub ──
function richiediPreventivo(productId) {
  alert('Funzionalità Richiedi Preventivo non ancora implementata. (Product ID: ' + productId + ')');
}
window.richiediPreventivo = richiediPreventivo;

function saveCart() {
  localStorage.setItem('rcs_cart', JSON.stringify(cart));
}

function loadCart() {
  try {
    const saved = localStorage.getItem('rcs_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }
  updateCartUI();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// ── Cart UI ──
function updateCartUI() {
  const badge = document.getElementById('cart-badge');
  const cartBody = document.getElementById('cart-body');
  const cartFooter = document.getElementById('cart-footer');
  const cartTotalPrice = document.getElementById('cart-total-price');
  const emptyState = document.getElementById('cart-empty');

  const count = getCartCount();

  // Badge
  badge.textContent = count;
  if (count > 0) {
    badge.classList.add('active');
  } else {
    badge.classList.remove('active');
  }

  // Cart items
  const existingItems = cartBody.querySelectorAll('.cart-item');
  existingItems.forEach(el => el.remove());

  if (cart.length === 0) {
    emptyState.style.display = 'flex';
    cartFooter.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  cartFooter.style.display = 'block';

  cart.forEach(item => {
    const safeId = escapeHtml(item.product_id);
    const safeName = escapeHtml(item.name);
    const safeImage = safeUrl(item.image);

    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="cart-item-image">
        <img src="${safeImage}" alt="${safeName}">
      </div>
      <div class="cart-item-details">
        <h4>${safeName}</h4>
        <span class="cart-item-price">${formatPrice(item.price)}</span>
        <div class="cart-item-qty">
          <button type="button" data-action="qty-dec" data-id="${safeId}" aria-label="Diminuisci quantità">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="qty-inc" data-id="${safeId}" aria-label="Aumenta quantità">+</button>
        </div>
      </div>
      <button type="button" class="cart-item-remove" data-action="remove" data-id="${safeId}" aria-label="Rimuovi dal carrello">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
        </svg>
      </button>
    `;
    cartBody.insertBefore(el, emptyState);
  });

  cartTotalPrice.textContent = formatPrice(getCartTotal());
}

// ── Product Detail Modal ──
function openProductModal(product) {
  const modal = document.getElementById('product-modal');
  const overlay = document.getElementById('product-modal-overlay');
  const body = document.getElementById('product-modal-body');
  if (!modal || !overlay || !body) return;

  const type = product._type || 'serbatoio';
  const safeName = escapeHtml(product.name);
  const safeDesc = escapeHtml(product.description || 'Descrizione non disponibile.');
  const safeImg = safeUrl(product.image_url);
  const safeId = escapeHtml(product.id);
  const safePrice = escapeHtml(product.price);

  const tags = [];
  if (type === 'serbatoio') {
    if (product.is_patented) tags.push('<span class="product-tag patented">Brevettato</span>');
    if (!product.requires_vvf) tags.push('<span class="product-tag no-vvf">No VVF</span>');
  }

  const priceFormatted = (product.price != null && !isNaN(Number(product.price)))
    ? `<span class="price-currency">€</span> ${Number(product.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })} <span class="price-vat">+ IVA</span>`
    : 'Su richiesta';

  const actionBtn = product.is_quote_only
    ? `<button class="btn btn-primary btn-modal-quote" data-id="${safeId}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
        </svg>
        Richiedi Preventivo
      </button>`
    : `<button class="btn btn-primary btn-modal-add-cart" data-id="${safeId}" data-type="${escapeHtml(type)}" data-name="${safeName}" data-price="${safePrice}" data-image="${safeImg}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>
        </svg>
        Aggiungi al carrello
      </button>`;

  body.innerHTML = `
    <div class="product-modal-image">
      ${tags.length ? `<div class="product-modal-tags">${tags.join('')}</div>` : ''}
      <img src="${safeImg}" alt="${safeName}">
    </div>
    <div class="product-modal-info">
      <div class="product-modal-eyebrow">${type === 'serbatoio' ? 'Serbatoio GPL' : 'Accessorio'}</div>
      <h2 class="product-modal-title" id="product-modal-title">${safeName}</h2>
      <p class="product-modal-desc">${safeDesc}</p>
      <div class="product-modal-price">${priceFormatted}</div>
      <div class="product-modal-actions">
        ${actionBtn}
        <a href="#contatti" class="btn btn-secondary btn-modal-contact">Hai domande?</a>
      </div>
    </div>
  `;

  // Wire CTA actions
  const addBtn = body.querySelector('.btn-modal-add-cart');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const { id, type: t, name, price, image } = addBtn.dataset;
      addToCart(id, t, name, price, image);
      closeProductModal();
      openCart();
    });
  }
  const quoteBtn = body.querySelector('.btn-modal-quote');
  if (quoteBtn) {
    quoteBtn.addEventListener('click', () => {
      richiediPreventivo(quoteBtn.dataset.id);
    });
  }
  const contactBtn = body.querySelector('.btn-modal-contact');
  if (contactBtn) {
    contactBtn.addEventListener('click', () => {
      closeProductModal();
    });
  }

  overlay.classList.add('open');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  const overlay = document.getElementById('product-modal-overlay');
  if (!modal || !overlay) return;
  modal.classList.remove('open');
  overlay.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  // Solo se anche il cart è chiuso ripristino lo scroll
  const cartOpen = document.getElementById('cart-sidebar')?.classList.contains('open');
  if (!cartOpen) document.body.style.overflow = '';
}

// ── Cart Sidebar Toggle ──
function openCart() {
  document.getElementById('cart-sidebar').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-sidebar').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Attach Add-to-Cart Event Listeners ──
function attachCartListeners() {
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const { id, type, name, price, image } = btn.dataset;
      addToCart(id, type, name, price, image);
      
      // Button micro-animation
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => { btn.style.transform = ''; }, 150);
    });
  });

  document.querySelectorAll('.btn-quote').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      richiediPreventivo(btn.dataset.id);

      btn.style.transform = 'scale(0.95)';
      setTimeout(() => { btn.style.transform = ''; }, 150);
    });
  });

  document.querySelectorAll('.details-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const product = productsById.get(link.dataset.id);
      if (product) openProductModal(product);
    });
  });
}

// ── Lazy-load + Play/Pause Video Showcase ──
// I video showcase pesano ~20MB combinati: li attiviamo solo quando
// stanno per entrare nel viewport, e li mettiamo in pausa quando escono.
function initLazyVideos() {
  const videos = document.querySelectorAll('video[data-src]');
  if (!videos.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.load();
        }
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => { /* autoplay bloccato dal browser, ok */ });
        }
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.01 });

  videos.forEach(v => io.observe(v));
}

// ── Scroll Reveal (Intersection Observer) ──
function observeRevealElements() {
  // Observer for section headers and generic reveal elements
  const genericObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        genericObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px'
  });

  // Dedicated observer for product cards with per-card stagger
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Small extra JS delay layered on top of CSS transition-delay
        // so cards that load after observer setup still animate correctly
        const delay = parseInt(entry.target.getAttribute('data-delay') || '1');
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, (delay - 1) * 60); // 0ms, 60ms, 120ms …
        cardObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.product-card.reveal:not(.visible)').forEach(el => cardObserver.observe(el));
  document.querySelectorAll('.reveal:not(.product-card):not(.visible)').forEach(el => genericObserver.observe(el));
}

// ── Header Scroll Effect ──
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ── Mobile Menu ──
function initMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const nav = document.getElementById('main-nav');

  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
    const isOpen = nav.classList.contains('open');
    toggle.setAttribute('aria-expanded', isOpen);

    // Update icon
    toggle.innerHTML = isOpen
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>`;
  });

  // Close mobile nav on link click
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>`;
    });
  });
}

// ── Smooth Scroll for Anchors ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ── Init Events ──
function initEvents() {
  // Cart toggle
  document.getElementById('btn-cart').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);

  // Checkout Button
  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', (e) => {
      e.preventDefault();
      window.checkoutCart(btnCheckout);
    });
  }

  // Event delegation per qty +/-/remove del carrello (anti-XSS: niente onclick inline)
  const cartBody = document.getElementById('cart-body');
  if (cartBody) {
    cartBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;
      if (action === 'qty-dec') updateCartQuantity(id, -1);
      else if (action === 'qty-inc') updateCartQuantity(id, 1);
      else if (action === 'remove') removeFromCart(id);
    });
  }

  // ESC to close cart + product modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeProductModal();
    }
  });

  // Product modal close + overlay click
  const modalClose = document.getElementById('product-modal-close');
  const modalOverlay = document.getElementById('product-modal-overlay');
  if (modalClose) modalClose.addEventListener('click', closeProductModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeProductModal);
}

// ── FAQ Accordion ──
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

// ── Contact Form ──
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('contact-submit');
    const successEl = document.getElementById('contact-success');

    const name = form.querySelector('#contact-name').value.trim();
    const email = form.querySelector('#contact-email').value.trim();
    const subject = form.querySelector('#contact-subject').value;
    const message = form.querySelector('#contact-message').value.trim();

    if (!name || !email || !subject || !message) {
      showToast('Compila tutti i campi obbligatori.', 'check');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Invio in corso...';

    try {
      await supabaseClient.from('contact_requests').insert([{
        name, email,
        phone: form.querySelector('#contact-phone').value.trim() || null,
        subject, message,
        created_at: new Date().toISOString()
      }]);
    } catch (_) {}

    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/></svg>Invia messaggio`;
    form.reset();
    successEl.style.display = 'flex';
    setTimeout(() => { successEl.style.display = 'none'; }, 5000);
  });
}

// ── App Init ──
document.addEventListener('DOMContentLoaded', async () => {
  initHeaderScroll();
  initMobileMenu();
  initSmoothScroll();
  initEvents();
  observeRevealElements();
  initLazyVideos();
  loadCart();
  initFAQ();
  initContactForm();

  await loadAndRenderProducts();
});
