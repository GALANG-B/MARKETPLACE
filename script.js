// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = "https://ecywogqoyahpbliufwvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeXdvZ3FveWFocGJsaXVmd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTAxMjMsImV4cCI6MjEwOTMyNjEyM30.jzVlvqe6c1hPJzbCqJDtzy6hx1aIzGyFksFFHPytsRU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Aplikasi
let state = {
  products: [],
  cart: [],
  orders: [],
  isSellerMode: false,
  sellerPin: "1234"
};

// ==================== INISIALISASI ====================
document.addEventListener("DOMContentLoaded", () => {
  // Inisialisasi ikon Lucide
  lucide.createIcons();

  // Cek hash URL (#seller)
  if (window.location.hash === "#seller") {
    openSellerAuthModal();
  }

  // Ambil Data Awal
  fetchProducts();
  fetchOrders();

  // Jalankan Real-Time Listener Supabase
  setupRealtimeSubscriptions();
});

// Realtime Listener Postgres Changes
function setupRealtimeSubscriptions() {
  supabaseClient
    .channel("public-db-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      fetchProducts();
      showToast("Katalog produk telah diperbarui secara langsung!", "info");
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
      fetchOrders();
      showToast("Status pesanan telah diperbarui!", "info");
    })
    .subscribe();
}

// ==================== UTILS & TOAST ====================
function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  const bgClass = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-indigo-600";
  
  toast.className = `${bgClass} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl animate-fade-in pointer-events-auto flex items-center gap-2`;
  toast.innerHTML = `<span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== DATA FETCHING ====================
async function fetchProducts() {
  const { data, error } = await supabaseClient.from("products").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    state.products = data;
    renderBuyerProducts();
    renderSellerProducts();
  }
}

async function fetchOrders() {
  const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    state.orders = data;
    renderBuyerOrders();
    renderSellerOrders();
  }
}

// ==================== PORTAL SWITCHING & AUTH ====================
function openSellerAuthModal() {
  document.getElementById("modal-seller-auth").classList.remove("hidden");
}

function closeSellerAuthModal() {
  document.getElementById("modal-seller-auth").classList.add("hidden");
  document.getElementById("seller-pin-input").value = "";
}

function handleSellerLogin(e) {
  e.preventDefault();
  const inputPin = document.getElementById("seller-pin-input").value;
  if (inputPin === state.sellerPin) {
    state.isSellerMode = true;
    closeSellerAuthModal();
    document.getElementById("buyer-view").classList.add("hidden");
    document.getElementById("seller-view").classList.remove("hidden");
    showToast("Selamat Datang, Penjual!");
  } else {
    showToast("PIN Salah! Coba lagi.", "error");
  }
}

function logoutSeller() {
  state.isSellerMode = false;
  document.getElementById("seller-view").classList.add("hidden");
  document.getElementById("buyer-view").classList.remove("hidden");
  window.location.hash = "";
  showToast("Kembali ke mode Pembeli.");
}

// ==================== PEMBELI: PRODUCT & CART LOGIC ====================
function renderBuyerProducts(filteredList = null) {
  const list = filteredList || state.products;
  const grid = document.getElementById("product-grid");

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400">Tidak ada produk ditemukan.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
      <div class="h-40 sm:h-48 bg-slate-100 overflow-hidden relative">
        <img src="${p.image_url}" alt="${p.title}" class="w-full h-full object-cover">
        ${p.stock <= 0 ? `<span class="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Habis</span>` : ""}
      </div>
      <div class="p-4 flex-grow flex flex-col justify-between space-y-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800 line-clamp-1">${p.title}</h3>
          <p class="text-xs text-slate-400 line-clamp-2 mt-1">${p.description || "Tidak ada deskripsi."}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-50">
          <div>
            <span class="text-xs text-slate-400 block">Harga</span>
            <span class="font-bold text-sm text-indigo-600">${formatRupiah(p.price)}</span>
          </div>
          <button onclick="addToCart('${p.id}')" ${p.stock <= 0 ? "disabled" : ""} 
                  class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition">
            + Keranjang
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function filterProducts() {
  const term = document.getElementById("search-input").value.toLowerCase();
  const filtered = state.products.filter(p => p.title.toLowerCase().includes(term));
  renderBuyerProducts(filtered);
}

function filterProductsMobile() {
  const term = document.getElementById("search-input-mobile").value.toLowerCase();
  const filtered = state.products.filter(p => p.title.toLowerCase().includes(term));
  renderBuyerProducts(filtered);
}

function switchBuyerTab(tab) {
  if (tab === "shop") {
    document.getElementById("tab-shop").classList.remove("hidden");
    document.getElementById("tab-orders").classList.add("hidden");
  } else {
    document.getElementById("tab-shop").classList.add("hidden");
    document.getElementById("tab-orders").classList.remove("hidden");
  }
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    if (existing.qty < product.stock) existing.qty++;
    else showToast("Stok maksimum dicapai!", "error");
  } else {
    state.cart.push({ ...product, qty: 1 });
  }
  updateCartUI();
  showToast("Berhasil masuk keranjang!");
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
  let grandTotal = 0;

  if (state.cart.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm">Keranjang belanja kosong</div>`;
  } else {
    container.innerHTML = state.cart.map(item => {
      const subtotal = item.price * item.qty;
      grandTotal += subtotal;
      return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <img src="${item.image_url}" class="w-12 h-12 rounded-lg object-cover">
          <div class="flex-grow">
            <h4 class="font-bold text-xs text-slate-800 line-clamp-1">${item.title}</h4>
            <span class="text-xs text-indigo-600 font-semibold">${formatRupiah(item.price)}</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="changeQty('${item.id}', -1)" class="w-6 h-6 bg-white border border-slate-200 rounded text-xs font-bold">-</button>
            <span class="text-xs font-bold">${item.qty}</span>
            <button onclick="changeQty('${item.id}', 1)" class="w-6 h-6 bg-white border border-slate-200 rounded text-xs font-bold">+</button>
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
  if (item.qty <= 0) {
    state.cart = state.cart.filter(i => i.id !== id);
  }
  updateCartUI();
}

function toggleCartModal(open) {
  const modal = document.getElementById("modal-cart");
  if (open) modal.classList.remove("hidden");
  else modal.classList.add("hidden");
}

async function checkout() {
  if (state.cart.length === 0) return showToast("Keranjang kosong!", "error");

  const totalAmount = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const newOrder = {
    items: state.cart,
    total_amount: totalAmount,
    status: "Diproses"
  };

  const { error } = await supabaseClient.from("orders").insert([newOrder]);

  if (!error) {
    // Kurangi Stok Produk
    for (const item of state.cart) {
      const updatedStock = item.stock - item.qty;
      await supabaseClient.from("products").update({ stock: Math.max(0, updatedStock) }).eq("id", item.id);
    }

    state.cart = [];
    updateCartUI();
    toggleCartModal(false);
    showToast("Pesanan berhasil dibuat!");
  } else {
    showToast("Gagal melakukan checkout.", "error");
  }
}

function renderBuyerOrders() {
  const container = document.getElementById("buyer-orders-list");
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">Belum ada riwayat pesanan.</div>`;
    return;
  }

  container.innerHTML = state.orders.map(o => `
    <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
      <div class="flex justify-between items-center text-xs">
        <span class="text-slate-400">ID Pesanan: #${o.id.substring(0, 8)}</span>
        <span class="px-2 py-0.5 rounded-full font-bold ${o.status === 'Diproses' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${o.status}</span>
      </div>
      <div class="text-sm font-bold text-slate-800">Total: ${formatRupiah(o.total_amount)}</div>
    </div>
  `).join("");
}

// ==================== PENJUAL (ADMIN) LOGIC ====================
function switchSellerTab(tab) {
  if (tab === "products") {
    document.getElementById("seller-tab-products").classList.remove("hidden");
    document.getElementById("seller-tab-orders").classList.add("hidden");
    document.getElementById("btn-seller-tab-products").className = "pb-3 border-b-2 border-indigo-500 text-indigo-400 font-bold text-sm flex items-center gap-2";
    document.getElementById("btn-seller-tab-orders").className = "pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200 font-semibold text-sm flex items-center gap-2";
  } else {
    document.getElementById("seller-tab-products").classList.add("hidden");
    document.getElementById("seller-tab-orders").classList.remove("hidden");
    document.getElementById("btn-seller-tab-orders").className = "pb-3 border-b-2 border-indigo-500 text-indigo-400 font-bold text-sm flex items-center gap-2";
    document.getElementById("btn-seller-tab-products").className = "pb-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200 font-semibold text-sm flex items-center gap-2";
  }
}

function renderSellerProducts() {
  const table = document.getElementById("seller-product-table");
  if (state.products.length === 0) {
    table.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Belum ada produk di database.</td></tr>`;
    return;
  }

  table.innerHTML = state.products.map(p => `
    <tr class="hover:bg-slate-800/50">
      <td class="p-4 flex items-center gap-3">
        <img src="${p.image_url}" class="w-10 h-10 rounded-lg object-cover">
        <div>
          <div class="font-bold text-white">${p.title}</div>
          <div class="text-xs text-slate-400 line-clamp-1">${p.description || "-"}</div>
        </div>
      </td>
      <td class="p-4 font-semibold text-indigo-400">${formatRupiah(p.price)}</td>
      <td class="p-4 font-semibold">${p.stock}</td>
      <td class="p-4 text-right space-x-2">
        <button onclick="editProduct('${p.id}')" class="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-semibold">Edit</button>
        <button onclick="deleteProduct('${p.id}')" class="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 rounded text-xs font-semibold">Hapus</button>
      </td>
    </tr>
  `).join("");
}

function openProductModal(productId = null) {
  const modal = document.getElementById("modal-product-form");
  const title = document.getElementById("product-form-title");

  if (productId) {
    const product = state.products.find(p => p.id === productId);
    document.getElementById("form-product-id").value = product.id;
    document.getElementById("form-product-name").value = product.title;
    document.getElementById("form-product-price").value = product.price;
    document.getElementById("form-product-stock").value = product.stock;
    document.getElementById("form-product-image").value = product.image_url;
    document.getElementById("form-product-desc").value = product.description || "";
    title.innerText = "Edit Produk";
  } else {
    document.getElementById("form-product-id").value = "";
    document.getElementById("form-product-name").value = "";
    document.getElementById("form-product-price").value = "";
    document.getElementById("form-product-stock").value = "";
    document.getElementById("form-product-image").value = "";
    document.getElementById("form-product-desc").value = "";
    title.innerText = "Tambah Produk Baru";
  }

  modal.classList.remove("hidden");
}

function closeProductModal() {
  document.getElementById("modal-product-form").classList.add("hidden");
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById("form-product-id").value;
  const payload = {
    title: document.getElementById("form-product-name").value,
    price: parseFloat(document.getElementById("form-product-price").value),
    stock: parseInt(document.getElementById("form-product-stock").value),
    image_url: document.getElementById("form-product-image").value,
    description: document.getElementById("form-product-desc").value
  };

  if (id) {
    const { error } = await supabaseClient.from("products").update(payload).eq("id", id);
    if (!error) showToast("Produk berhasil diperbarui!");
  } else {
    const { error } = await supabaseClient.from("products").insert([payload]);
    if (!error) showToast("Produk baru berhasil ditambahkan!");
  }

  closeProductModal();
}

async function deleteProduct(id) {
  if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
    const { error } = await supabaseClient.from("products").delete().eq("id", id);
    if (!error) showToast("Produk berhasil dihapus!");
  }
}

function editProduct(id) {
  openProductModal(id);
}

function renderSellerOrders() {
  const container = document.getElementById("seller-orders-list");
  if (state.orders.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-slate-500">Belum ada pesanan masuk.</div>`;
    return;
  }

  container.innerHTML = state.orders.map(o => `
    <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="text-xs text-slate-400">ID Pesanan: #${o.id}</div>
        <div class="text-sm font-bold text-white mt-1">Total: ${formatRupiah(o.total_amount)}</div>
        <div class="text-xs text-slate-400 mt-1">Status: <span class="text-amber-400 font-semibold">${o.status}</span></div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="updateOrderStatus('${o.id}', 'Selesai')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">
          Selesaikan Pesanan
        </button>
      </div>
    </div>
  `).join("");
}

async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient.from("orders").update({ status }).eq("id", id);
  if (!error) showToast("Status pesanan diperbarui!");
}
