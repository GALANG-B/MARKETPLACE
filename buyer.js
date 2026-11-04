const SUPABASE_URL = "https://ecywogqoyahpbliufwvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeXdvZ3FveWFocGJsaXVmd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTAxMjMsImV4cCI6MjEwOTMyNjEyM30.jzVlvqe6c1hPJzbCqJDtzy6hx1aIzGyFksFFHPytsRU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("tokokita_cart")) || [],
  orders: []
};

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  fetchProducts();
  fetchOrders();
  updateCartUI();
  setupRealtime();
});

function setupRealtime() {
  supabaseClient
    .channel("shopee-buyer-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      fetchProducts();
      showToast("Katalog produk diperbarui penjual!", "info");
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
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const bg = type === "success" ? "bg-slate-900 text-white" : "bg-orange-600 text-white";
  
  toast.className = `${bg} text-xs font-bold px-4 py-3 rounded-xl shadow-xl animate-fade-in flex items-center gap-2 pointer-events-none`;
  toast.innerHTML = `<span>${msg}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

async function fetchProducts() {
  const { data } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (data) {
    state.products = data;
    renderProducts();
  }
}

async function fetchOrders() {
  const { data } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (data) {
    state.orders = data;
    renderOrders();
  }
}

function renderProducts(filtered = null) {
  const list = filtered || state.products;
  const grid = document.getElementById("product-grid");
  document.getElementById("product-count").innerText = `${list.length} Produk`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-16 bg-white rounded-2xl text-slate-400 text-xs font-bold">Tidak ada produk ditemukan.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
      <div class="relative h-36 sm:h-44 bg-slate-100">
        <img src="${p.image_url}" class="w-full h-full object-cover">
        ${p.stock <= 0 ? '<span class="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">Habis</span>' : ''}
      </div>
      <div class="p-3 flex-grow flex flex-col justify-between space-y-2">
        <div>
          <h4 class="font-bold text-xs text-slate-800 line-clamp-2">${p.title}</h4>
          <span class="text-[10px] text-slate-400">Stok: ${p.stock}</span>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-50">
          <span class="font-black text-xs text-orange-600">${formatRupiah(p.price)}</span>
          <button onclick="addToCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''} class="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white disabled:bg-slate-100 disabled:text-slate-300 rounded-xl text-xs font-bold transition">
            + Keranjang
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function filterProducts() {
  const query = document.getElementById("search-input").value.toLowerCase();
  renderProducts(state.products.filter(p => p.title.toLowerCase().includes(query)));
}

function filterProductsMobile() {
  const query = document.getElementById("search-input-mobile").value.toLowerCase();
  renderProducts(state.products.filter(p => p.title.toLowerCase().includes(query)));
}

function filterCategory(cat) {
  document.querySelectorAll(".category-chip").forEach(b => b.className = "category-chip px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold whitespace-nowrap");
  event.target.className = "category-chip px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm";
  
  if (cat === 'all') renderProducts();
  else renderProducts(state.products.filter(p => (p.description || "").toLowerCase().includes(cat)));
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p || p.stock <= 0) return;

  const ex = state.cart.find(x => x.id === id);
  if (ex) {
    if (ex.qty < p.stock) ex.qty++;
    else { showToast("Stok maksimum!", "error"); return; }
  } else {
    state.cart.push({ ...p, qty: 1 });
  }

  localStorage.setItem("tokokita_cart", JSON.stringify(state.cart));
  updateCartUI();
  showToast("Berhasil ditambah ke keranjang!");
}

function updateCartUI() {
  const badge = document.getElementById("cart-badge");
  const totalQty = state.cart.reduce((s, i) => s + i.qty, 0);
  
  if (totalQty > 0) { badge.innerText = totalQty; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  const container = document.getElementById("cart-items-container");
  let total = 0;

  if (state.cart.length === 0) {
    container.innerHTML = `<div class="text-center py-16 text-slate-400 text-xs font-bold">Keranjang belanja kosong</div>`;
  } else {
    container.innerHTML = state.cart.map(item => {
      total += item.price * item.qty;
      return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <img src="${item.image_url}" class="w-12 h-12 rounded-lg object-cover">
          <div class="flex-grow">
            <h4 class="font-bold text-xs text-slate-800 line-clamp-1">${item.title}</h4>
            <span class="text-xs text-orange-600 font-extrabold">${formatRupiah(item.price)}</span>
          </div>
          <div class="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
            <button onclick="changeQty('${item.id}', -1)" class="w-5 h-5 text-xs font-bold">-</button>
            <span class="text-xs font-bold w-4 text-center">${item.qty}</span>
            <button onclick="changeQty('${item.id}', 1)" class="w-5 h-5 text-xs font-bold">+</button>
          </div>
        </div>
      `;
    }).join("");
  }

  document.getElementById("cart-total").innerText = formatRupiah(total);
}

function changeQty(id, delta) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(i => i.id !== id);

  localStorage.setItem("tokokita_cart", JSON.stringify(state.cart));
  updateCartUI();
}

function toggleCartModal(open) {
  document.getElementById("modal-cart").classList.toggle("hidden", !open);
}

async function checkout() {
  if (state.cart.length === 0) return showToast("Keranjang kosong!", "error");

  const total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const { error } = await supabaseClient.from("orders").insert([{ items: state.cart, total_amount: total, status: "Diproses" }]);

  if (!error) {
    for (const item of state.cart) {
      await supabaseClient.from("products").update({ stock: Math.max(0, item.stock - item.qty) }).eq("id", item.id);
    }
    state.cart = [];
    localStorage.removeItem("tokokita_cart");
    updateCartUI();
    toggleCartModal(false);
    showToast("Checkout berhasil! Pesanan diproses.");
    switchBuyerTab('orders');
  }
}

function renderOrders() {
  const container = document.getElementById("buyer-orders-list");
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl text-slate-400 text-xs font-bold">Belum ada pesanan aktif.</div>`;
    return;
  }

  container.innerHTML = state.orders.map(o => `
    <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
      <div class="flex justify-between items-center text-xs">
        <span class="text-slate-400 font-mono">ID: #${o.id.substring(0, 8)}</span>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${o.status === 'Diproses' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}">${o.status}</span>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-50 text-sm font-bold">
        <span class="text-slate-600">Total Belanja</span>
        <span class="text-orange-600">${formatRupiah(o.total_amount)}</span>
      </div>
    </div>
  `).join("");
}

function switchBuyerTab(tab) {
  const shopTab = document.getElementById("tab-shop");
  const ordersTab = document.getElementById("tab-orders");
  const btnShop = document.getElementById("nav-mobile-shop");
  const btnOrders = document.getElementById("nav-mobile-orders");

  if (tab === 'shop') {
    shopTab.classList.remove("hidden");
    ordersTab.classList.add("hidden");
    btnShop.className = "flex flex-col items-center gap-1 text-orange-500 font-bold text-[10px]";
    btnOrders.className = "flex flex-col items-center gap-1 text-slate-400 font-bold text-[10px]";
  } else {
    shopTab.classList.add("hidden");
    ordersTab.classList.remove("hidden");
    btnOrders.className = "flex flex-col items-center gap-1 text-orange-500 font-bold text-[10px]";
    btnShop.className = "flex flex-col items-center gap-1 text-slate-400 font-bold text-[10px]";
  }
}
