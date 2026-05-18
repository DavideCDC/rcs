/* ===================================
   RCS Srl — Admin Area
   Supabase Auth + Shared Helpers
   =================================== */

const SUPABASE_URL = 'https://vmgomrmxosagwwfpjidm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZ29tcm14b3NhZ3d3ZnBqaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5OTQzMzEsImV4cCI6MjA4OTU3MDMzMX0.SR8N-tgIXV1VfB9tEFB9r6j8sMcyTaNFcqR9ny4HPnc';

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rcs_admin_auth' }
});

// ── Auth guard ──
async function requireAuth(redirectTo = '/admin/login.html') {
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

async function logout() {
  await supabaseAdmin.auth.signOut();
  window.location.href = '/admin/login.html';
}

// ── Helpers ──
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (/^\s*(javascript|vbscript):/i.test(s)) return '';
  if (/^\s*data:/i.test(s) && !/^\s*data:image\//i.test(s)) return '';
  return escapeHtml(s);
}

function formatPrice(p) {
  if (p == null || isNaN(Number(p))) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(p));
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Toast ──
function showToast(message, type = 'success') {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ── Mount user info into header (chiama dopo requireAuth) ──
function mountAdminHeader(session) {
  const emailEl = document.getElementById('admin-user-email');
  if (emailEl && session?.user?.email) emailEl.textContent = session.user.email;
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}
