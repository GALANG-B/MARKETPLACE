// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = "https://ecywogqoyahpbliufwvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeXdvZ3FveWFocGJsaXVmd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTAxMjMsImV4cCI6MjEwOTMyNjEyM30.jzVlvqe6c1hPJzbCqJDtzy6hx1aIzGyFksFFHPytsRU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("tokokita_cart")) || [],
  orders: [],
  selectedCategory: "all"
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
    .channel("buyer-live-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      fetchProducts();
      showToast("Katalog diperbarui oleh Penjual secara live!", "info");
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
  const bg = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-indigo-600";
  
  toast.className = `${bg} text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl animate-fade-in flex items-center gap-2 pointer-events-auto border border-white/20`;
  toast.innerHTML = `<span>${msg}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function fetchProducts() {
  const { data, error } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    state.products = data;
    renderProducts();
  }
}

async function fetchOrders() {
  const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    state.orders = data;
    renderOrders();
  }
}

function renderProducts(filteredList = null) {
  const list = filteredList || state.products;
  const grid = document.getElementById("product-grid");
  const countBadge = document.getElementById("product-count");

  countBadge.innerText = `${list.length} Produk`;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
        <i data-lucide="package-open" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <p class="text-sm font-bold text-slate-600">Tidak ada produk ditemukan</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map(p => {
    const isOut = p.stock <= 0;
    return `
      <div class="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer"
           onclick="openProductDetailModal('${p.id}')">
        <div class="relative h-40 sm:h-48 bg-slate-100 overflow-hidden">
          <img src="${p.image_url}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          ${isOut ? '<span class="absolute top-3 right-3 bg-rose-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Habis</span>' : `<span class="absolute top-3 right-3 bg-slate-900/60 backdrop-blur-md text-white text-[9px] font-bold px-2.5 py-1 rounded-full">Sisa ${p.stock}</span>`}
        </div>
        <div class="p-3.5 sm:p-4 flex-grow flex flex-col justify-between space-y-3">
          <div>
            <h3 class="font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">${p.title}</h3>
            <p class="text-[11px] text-slate-400 line-clamp-1 mt-1 font-medium">${p.description || "Tidak ada deskripsi."}</p>
          </div>
          <div class="pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
            <div>
              <span class="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Harga</span>
              <span class="font-extrabold text-xs sm:text-sm text-indigo-600">${formatRupiah(p.price)}</span>
            </div>
            <button onclick="event.stopPropagation(); addToCart('${p.id}')" ${isOut ? 'disabled' : ''} 
                    class="p-2 sm:px-3 sm:py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white disabled:bg-slate-100 disabled:text-slate-300 rounded-2xl transition-all duration-200">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
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
  document.querySelectorAll(".category-chip").forEach(btn => {
    btn.className = "category-chip px-4 py-2 bg-white text-slate-600 border border-slate-200/80 rounded-2xl text-xs font-bold whitespace-nowrap hover:bg-slate-50 transition";
  });
  event.target.className = "category-chip active px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold whitespace-nowrap shadow-md shadow-indigo-500/20 transition";

  if (cat === "all") renderProducts();
  else renderProducts(state.products.filter(p => (p.description || "").toLowerCase().includes(cat)));
}

function openProductDetailModal(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  document.getElementById("detail-img").src = p.image_url;
  document.getElementById("detail-title").innerText = p.title;
  document.getElementById("detail-price").innerText = formatRupiah(p.price);
  document.getElementById("detail-desc").innerText = p.description || "Tidak ada deskripsi detail produk.";
  
  const btn = document.getElementById("detail-add-btn");
  if (p.stock <= 0) {
    btn.disabled = true;
    btn.innerText = "Stok Habis";
    btn.className = "w-full py-3.5 bg-slate-200 text-slate-400 rounded-2xl font-bold text-sm cursor-not-allowed";
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="shopping-cart" class="w-4 h-4"></i> Tambah Ke Keranjang`;
    btn.className = "w-full py-3.5 btn-gradient text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2";
    btn.onclick = () => { addToCart(p.id); closeProductDetailModal(); };
  }

  document.getElementById("modal-product-detail").classList.remove("hidden");
  lucide.createIcons();
}

function closeProductDetailModal() {
  document.getElementById("modal-product-detail").classList.add("hidden");
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p || p.stock <= 0) return;

  const existing = state.cart.find(x => x.id === id);
  if (existing) {
    if (existing.qty < p.stock) existing.qty++;
    else { showToast("Stok maksimum tercapai!", "error"); return; }
  } else {
    state.cart.push({ ...p, qty: 1 });
  }

  saveCart();
  updateCartUI();
  showToast("Ditambahkan ke keranjang!");
}

function saveCart() {
  localStorage.setItem("tokokita_cart", JSON.stringify(state.cart));
}

function updateCartUI() {
  const badge = document.getElementById("cart-badge");
  const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);

  if (totalQty > 0) {
    badge.innerText = totalQty;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  const container = document.getElementById("cart-items-container");
  let total = 0;

  if (state.cart.length === 0) {
    container.innerHTML = `<div class="text-center py-16 text-slate-400 space-y-2"><p class="text-xs font-bold text-slate-500">Keranjang masih kosong</p></div>`;
  } else {
    container.innerHTML = state.cart.map(item => {
      total += item.price * item.qty;
      return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <img src="${item.image_url}" class="w-14 h-14 rounded-xl object-cover bg-white">
          <div class="flex-grow">
            <h4 class="font-bold text-xs text-slate-800 line-clamp-1">${item.title}</h4>
            <span class="text-xs text-indigo-600 font-extrabold">${formatRupiah(item.price)}</span>
          </div>
          <div class="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200">
            <button onclick="changeQty('${item.id}', -1)" class="w-5 h-5 flex items-center justify-center text-xs font-black text-slate-600">-</button>
            <span class="text-xs font-bold w-4 text-center">${item.qty}</span>
            <button onclick="changeQty('${item.id}', 1)" class="w-5 h-5 flex items-center justify-center text-xs font-black text-slate-600">+</button>
          </div>
        </div>
      `;
    }).join("");
  }

  document.getElementById("cart-subtotal").innerText = formatRupiah(total);
  document.getElementById("cart-total").innerText = formatRupiah(total);
  lucide.createIcons();
}

function changeQty(id, delta) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter(i => i.id !== id);

  saveCart();
  updateCartUI();
}

function toggleCartModal(open) {
  document.getElementById("modal-cart").classList.toggle("hidden", !open);
}

async function checkout() {
  if (state.cart.length === 0) return showToast("Keranjang belanja kosong!", "error");

  const totalAmount = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const newOrder = { items: state.cart, total_amount: totalAmount, status: "Diproses" };

  const { error } = await supabaseClient.from("orders").insert([newOrder]);

  if (!error) {
    for (const item of state.cart) {
      await supabaseClient.from("products").update({ stock: Math.max(0, item.stock - item.qty) }).eq("id", item.id);
    }

    state.cart = [];
    saveCart();
    updateCartUI();
    toggleCartModal(false);
    showToast("Checkout Berhasil! Pesanan diproses.");
    switchBuyerTab('orders');
  } else {
    showToast("Gagal melakukan checkout.", "error");
  }
}

function renderOrders() {
  const container = document.getElementById("buyer-orders-list");

  if (state.orders.length === 0) {
    container.innerHTML = `<div class="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200"><p class="text-xs font-bold text-slate-500">Belum ada riwayat pesanan</p></div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.orders.map(o => `
    <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
      <div class="flex justify-between items-center text-xs">
        <span class="font-mono text-slate-400">ID: #${o.id.substring(0, 8)}</span>
        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${o.status === 'Diproses' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${o.status}</span>
      </div>
      <div class="flex justify-between items-center pt-2 border-t border-slate-50">
        <span class="text-xs text-slate-400 font-medium">Total Tagihan</span>
        <span class="text-sm font-black text-indigo-600">${formatRupiah(o.total_amount)}</span>
      </div>
    </div>
  `).join("");

  lucide.createIcons();
}

function switchBuyerTab(tab) {
  const shopTab = document.getElementById("tab-shop");
  const ordersTab = document.getElementById("tab-orders");
  const btnShop = document.getElementById("nav-mobile-shop");
  const btnOrders = document.getElementById("nav-mobile-orders");

  if (tab === 'shop') {
    shopTab.classList.remove("hidden");
    ordersTab.classList.add("hidden");
    if(btnShop && btnOrders) {
      btnShop.className = "flex flex-col items-center gap-1 text-indigo-600 font-bold text-[10px]";
      btnOrders.className = "flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 font-bold text-[10px]";
    }
  } else {
    shopTab.classList.add("hidden");
    ordersTab.classList.remove("hidden");
    if(btnShop && btnOrders) {
      btnOrders.className = "flex flex-col items-center gap-1 text-indigo-600 font-bold text-[10px]";
      btnShop.className = "flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 font-bold text-[10px]";
    }
  }
}
