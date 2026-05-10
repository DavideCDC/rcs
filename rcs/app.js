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

// ── Format Price ──
function formatPrice(price) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
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

  card.innerHTML = `
    <div class="product-card-image">
      ${tags.join('')}
      <img src="${product.image_url}" alt="${product.name}" loading="lazy">
    </div>
    <div class="product-card-body">
      <h3>${product.name}</h3>
      <p class="product-desc">${product.description || ''}</p>
      <div class="product-price">
        <span class="price-currency">€</span> ${Number(product.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        <span class="price-vat">+ IVA</span>
      </div>
      <div class="product-actions">
        ${product.is_quote_only
          ? `<button class="btn btn-primary btn-sm btn-quote" data-id="${product.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Richiedi Preventivo
            </button>`
          : `<button class="btn btn-primary btn-sm btn-add-cart" data-id="${product.id}" data-type="${type}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>
              </svg>
              Aggiungi al carrello
            </button>`
        }
        <a href="#" class="details-link" data-slug="${product.slug}">
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
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <h4>${item.name}</h4>
        <span class="cart-item-price">${formatPrice(item.price)}</span>
        <div class="cart-item-qty">
          <button onclick="updateCartQuantity('${item.product_id}', -1)" aria-label="Diminuisci quantità">−</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQuantity('${item.product_id}', 1)" aria-label="Aumenta quantità">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.product_id}')" aria-label="Rimuovi dal carrello">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
        </svg>
      </button>
    `;
    cartBody.insertBefore(el, emptyState);
  });

  cartTotalPrice.textContent = formatPrice(getCartTotal());
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

  // ESC to close cart
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });
}

// ── App Init ──
document.addEventListener('DOMContentLoaded', async () => {
  initHeaderScroll();
  initMobileMenu();
  initSmoothScroll();
  initEvents();
  observeRevealElements();
  loadCart();

  await loadAndRenderProducts();
});
