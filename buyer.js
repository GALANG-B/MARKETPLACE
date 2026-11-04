const SUPABASE_URL = "https://ecywogqoyahpbliufwvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeXdvZ3FveWFocGJsaXVmd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTAxMjMsImV4cCI6MjEwOTMyNjEyM30.jzVlvqe6c1hPJzbCqJDtzy6hx1aIzGyFksFFHPytsRU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = { products: [], cart: [], orders: [] };

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  fetchProducts();
  fetchOrders();
  setupRealtime();
});

function setupRealtime() {
  supabaseClient
    .channel("buyer-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      fetchProducts();
      showToast("Katalog diperbarui oleh penjual!", "info");
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      fetchOrders();
    })
    .subscribe();
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function showToast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `${type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl animate-fade-in`;
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

async function fetchProducts() {
  const { data } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (data) { state.products = data; renderProducts(); }
}

async function fetchOrders() {
  const { data } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (data) { state.orders = data; renderOrders(); }
}

function renderProducts(filtered = null) {
  const list = filtered || state.products;
  const grid = document.getElementById("product-grid");
  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400">Belum ada produk tersedia.</div>`;
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
      <div class="h-40 sm:h-48 bg-slate-100 overflow-hidden relative">
        <img src="${p.image_url}" alt="${p.title}" class="w-full h-full object-cover">
        ${p.stock <= 0 ? '<span class="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Habis</span>' : ''}
      </div>
      <div class="p-4 flex-grow flex flex-col justify-between space-y-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800 line-clamp-1">${p.title}</h3>
          <p class="text-xs text-slate-400 line-clamp-2 mt-1">${p.description || "-"}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-50">
          <div>
            <span class="text-xs text-slate-400 block">Harga</span>
            <span class="font-bold text-sm text-indigo-600">${formatRupiah(p.price)}</span>
          </div>
          <button onclick="addToCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''} class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition">
            + Keranjang
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function filterProducts() {
  const term = document.getElementById("search-input").value.toLowerCase();
  renderProducts(state.products.filter(p => p.title.toLowerCase().includes(term)));
}
function filterProductsMobile() {
  const term = document.getElementById("search-input-mobile").value.toLowerCase();
  renderProducts(state.products.filter(p => p.title.toLowerCase().includes(term)));
}

function switchBuyerTab(tab) {
  if (tab === 'shop') {
    document.getElementById("tab-shop").classList.remove("hidden");
    document.getElementById("tab-orders").classList.add("hidden");
  } else {
    document.getElementById("tab-shop").classList.add("hidden");
    document.getElementById("tab-orders").classList.remove("hidden");
  }
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p || p.stock <= 0) return;
  const ex = state.cart.find(x => x.id === id);
  if (ex) {
    if (ex.qty < p.stock) ex.qty++;
    else { showToast("Stok maksimum tercapai!", "error"); return; }
  } else {
    state.cart.push({ ...p, qty: 1 });
  }
  updateCartUI();
  showToast("Produk masuk keranjang!");
}

function updateCartUI() {
  const badge = document.getElementById("cart-badge");
  const totalQty = state.cart.reduce((s, i) => s + i.qty, 0);
  if (totalQty > 0) { badge.innerText = totalQty; badge.classList.remove("hidden"); }
  else { badge.classList.add("hidden"); }

  const container = document.getElementById("cart-items-container");
  let grandTotal = 0;
  if (state.cart.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm">Keranjang kosong</div>`;
  } else {
    container.innerHTML = state.cart.map(item => {
      grandTotal += item.price * item.qty;
      return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <img src="${item.image_url}" class="w-12 h-12 rounded-lg object-cover">
          <div class="flex-grow">
            <h4 class="font-bold text-xs text-slate-800 line-clamp-1">${item.title}</h4>
            <span class="text-xs text-indigo-600 font-semibold">${formatRupiah(item.price)}</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="changeQty('${item.id}', -1)" class="w-6 h-6 bg-white border border-slate-200 rounded font-bold">-</button>
            <span class="text-xs font-bold">${item.qty}</span>
            <button onclick="changeQty('${item.id}', 1)" class="w-6 h-6 bg-white border border-slate-200 rounded font-bold">+</button>
          </div>
        </div>
      `;
    }).join("");
  }
  document.getElementById("cart-total").innerText = formatRupiah(grandTotal);
}

function changeQty(id, delta) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(i => i.id !== id);
  updateCartUI();
}

function toggleCartModal(open) {
  document.getElementById("modal-cart").classList.toggle("hidden", !open);
}

async function checkout() {
  if (state.cart.length === 0) return;
  const total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const { error } = await supabaseClient.from("orders").insert([{ items: state.cart, total_amount: total, status: "Diproses" }]);
  
  if (!error) {
    for (const item of state.cart) {
      await supabaseClient.from("products").update({ stock: Math.max(0, item.stock - item.qty) }).eq("id", item.id);
    }
    state.cart = [];
    updateCartUI();
    toggleCartModal(false);
    showToast("Checkout berhasil! Pesanan diproses.");
  }
}

function renderOrders() {
  const c = document.getElementById("buyer-orders-list");
  if (state.orders.length === 0) {
    c.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">Belum ada pesanan.</div>`;
    return;
  }
  c.innerHTML = state.orders.map(o => `
    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
      <div>
        <div class="text-xs text-slate-400">ID: #${o.id.substring(0, 8)}</div>
        <div class="text-sm font-bold text-slate-800 mt-1">${formatRupiah(o.total_amount)}</div>
      </div>
      <span class="px-3 py-1 rounded-full text-xs font-bold ${o.status === 'Diproses' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${o.status}</span>
    </div>
  `).join("");
}
