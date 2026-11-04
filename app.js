// PasarKita frontend. Kunci Midtrans Server Key TIDAK BOLEH ditaruh di file ini.
const SUPABASE_URL = "https://ecywogqoyahpbliufwvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeXdvZ3FveWFocGJsaXVmd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTAxMjMsImV4cCI6MjEwOTMyNjEyM30.jzVlvqe6c1hPJzbCqJDtzy6hx1aIzGyFksFFHPytsRU";
const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, products:[], category:"all", query:"", cart:JSON.parse(localStorage.getItem("pk_cart")||"[]"), authMode:"login" };
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message){const el=$("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3000)}
function show(id){$(id)?.classList.add("open");$(id)?.setAttribute("aria-hidden","false")}
function hide(id){$(id)?.classList.remove("open");$(id)?.setAttribute("aria-hidden","true")}
function saveCart(){localStorage.setItem("pk_cart",JSON.stringify(state.cart));renderCart()}
function cartTotal(){return state.cart.reduce((n,i)=>n+i.price*i.qty,0)}
function imageUrl(url){return url && /^https:\/\/|^http:\/\//i.test(url) ? url : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80"}
async function init(){
  $("year") && ($("year").textContent=new Date().getFullYear());
  if(!db){toast("Supabase belum dapat dimuat. Periksa koneksi internet.");return}
  const {data:{session}}=await db.auth.getSession();state.user=session?.user||null;
  await loadProfile();renderAuth();
  db.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;setTimeout(async()=>{await loadProfile();renderAuth();if($("sellerProductList"))loadSellerDashboard()},0)});
  if($("productGrid")){await loadProducts();renderCart();bindStore()}
  if($("sellerProductList")){bindSeller();if(!state.user){toast("Silakan masuk terlebih dahulu.");setTimeout(()=>location.href="index.html",900)}else await loadSellerDashboard()}
}
async function loadProfile(){
  state.profile=null;if(!state.user)return;
  const {data}=await db.from("profiles").select("id,full_name,role").eq("id",state.user.id).maybeSingle();
  state.profile=data||{id:state.user.id,full_name:state.user.user_metadata?.full_name||"Pengguna",role:"buyer"};
}
function renderAuth(){
  const logged=!!state.user;
  if($("loginBtn")){$("loginBtn").hidden=logged;$("registerBtn").hidden=logged;$("accountBtn").hidden=!logged;$("sellerLink").hidden=!logged}
  if($("accountBtn"))$("accountBtn").textContent=(state.profile?.full_name||state.user?.email||"Akun").split(" ")[0]+" ▾";
}
async function loadProducts(){
  const grid=$("productGrid");if(!grid)return;grid.innerHTML='<div class="empty-state">Memuat katalog…</div>';
  const {data,error}=await db.from("products").select("id,seller_id,title,description,price,stock,category,image_url,created_at").eq("is_active",true).gt("stock",0).order("created_at",{ascending:false});
  if(error){grid.innerHTML='<div class="empty-state">Katalog belum tersedia. Periksa tabel products dan kebijakan RLS di Supabase.</div>';console.error(error);return}
  state.products=data||[];renderProducts();
}
function renderProducts(){
  const grid=$("productGrid");if(!grid)return;
  const list=state.products.filter(p=>(state.category==="all"||p.category===state.category)&&(`${p.title} ${p.description||""} ${p.category||""}`).toLowerCase().includes(state.query));
  $("resultCount").textContent=`${list.length} produk ditemukan`;
  if(!list.length){grid.innerHTML='<div class="empty-state">Belum ada produk yang cocok dengan pencarianmu.</div>';return}
  grid.innerHTML=list.map(p=>`<article class="product-card"><div class="product-image"><img loading="lazy" src="${esc(imageUrl(p.image_url))}" alt="${esc(p.title)}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'"><span class="product-category">${esc(p.category||"Lainnya")}</span></div><div class="product-info"><h3>${esc(p.title)}</h3><p>${esc(p.description||"Produk pilihan dari penjual PasarKita.")}</p><div class="product-bottom"><div><div class="price">${rupiah(p.price)}</div><div class="stock-note">Stok ${Number(p.stock)}</div></div><button class="add-cart" data-add="${esc(p.id)}" aria-label="Tambah ke keranjang">＋</button></div></div></article>`).join("");
}
function addCart(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const found=state.cart.find(x=>x.id===id);
  if(found){if(found.qty>=p.stock)return toast("Jumlah melebihi stok tersedia.");found.qty++}
  else state.cart.push({id:p.id,title:p.title,price:Number(p.price),stock:Number(p.stock),image_url:p.image_url,qty:1});
  saveCart();toast("Produk ditambahkan ke keranjang.");
}
function changeQty(id,delta){const item=state.cart.find(x=>x.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)state.cart=state.cart.filter(x=>x.id!==id);else if(item.qty>item.stock){item.qty=item.stock;toast("Jumlah dibatasi sesuai stok.")}saveCart()}
function renderCart(){
  if(!$("cartCount"))return;$("cartCount").textContent=state.cart.reduce((n,i)=>n+i.qty,0);$("cartTotal").textContent=rupiah(cartTotal());
  $("cartItems").innerHTML=state.cart.length?state.cart.map(i=>`<div class="cart-row"><img src="${esc(imageUrl(i.image_url))}" alt=""><div><strong>${esc(i.title)}</strong><small>${rupiah(i.price)}</small></div><div class="qty-control"><button data-qty="${esc(i.id)}" data-delta="-1">−</button><b>${i.qty}</b><button data-qty="${esc(i.id)}" data-delta="1">+</button></div></div>`).join(""):'<div class="empty-state">Keranjangmu masih kosong.</div>';
}
function bindStore(){
  $("loginBtn").onclick=()=>openAuth("login");$("registerBtn").onclick=()=>openAuth("register");
  $("accountBtn").onclick=async()=>{if(confirm("Keluar dari akun PasarKita?")){await db.auth.signOut();toast("Kamu sudah keluar.")}};
  $("cartOpen").onclick=()=>show("cartDrawer");
  $("searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();renderProducts()});
  $("categoryRow").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;state.category=b.dataset.category;document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
  $("productGrid").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(b)addCart(b.dataset.add)});
  $("cartItems").addEventListener("click",e=>{const b=e.target.closest("[data-qty]");if(b)changeQty(b.dataset.qty,Number(b.dataset.delta))});
  $("checkoutBtn").onclick=beginCheckout;
  $("checkoutForm").onsubmit=submitCheckout;
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(b.dataset.close));
  document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)hide(o.id)}));
  $("authSwitch").onclick=()=>openAuth(state.authMode==="login"?"register":"login");
  $("authForm").onsubmit=submitAuth;
}
function openAuth(mode){state.authMode=mode;$("authTitle").textContent=mode==="login"?"Masuk ke PasarKita":"Buat akun PasarKita";$("authDescription").textContent=mode==="login"?"Gunakan akunmu untuk melanjutkan.":"Daftar untuk mulai berbelanja dan berjualan."; $("nameField").hidden=mode==="login";$("authName").required=mode==="register";$("authSubmit").textContent=mode==="login"?"Masuk":"Daftar";$("authSwitchText").textContent=mode==="login"?"Belum punya akun?":"Sudah punya akun?";$("authSwitch").textContent=mode==="login"?"Daftar":"Masuk";show("authModal")}
async function submitAuth(e){e.preventDefault();const email=$("authEmail").value.trim(),password=$("authPassword").value;
  try{let result;if(state.authMode==="login")result=await db.auth.signInWithPassword({email,password});else result=await db.auth.signUp({email,password,options:{data:{full_name:$("authName").value.trim()}}});
    if(result.error)throw result.error;hide("authModal");toast(state.authMode==="login"?"Berhasil masuk.":"Pendaftaran berhasil. Periksa email jika konfirmasi diaktifkan.");if(state.authMode==="register"&&!result.data.session)return;
  }catch(err){toast(err.message||"Autentikasi gagal.")}}
async function beginCheckout(){
  if(!state.cart.length)return toast("Keranjang masih kosong.");
  if(!state.user){hide("cartDrawer");openAuth("login");return}
  $("shipName").value=state.profile?.full_name||state.user.user_metadata?.full_name||"";
  $("checkoutSubtotal").textContent=rupiah(cartTotal());$("checkoutShipping").textContent="Dikonfirmasi penjual";$("checkoutGrand").textContent=rupiah(cartTotal())+" + ongkir";
  hide("cartDrawer");show("checkoutModal");
}
async function submitCheckout(e){
  e.preventDefault();if(!state.user||!state.cart.length)return;
  const btn=$("payBtn");btn.disabled=true;btn.textContent="Membuat pesanan…";
  try{
    const payload={p_items:state.cart.map(i=>({product_id:i.id,quantity:i.qty})),p_shipping_name:$("shipName").value.trim(),p_shipping_phone:$("shipPhone").value.trim(),p_shipping_address:$("shipAddress").value.trim(),p_shipping_method:$("shippingMethod").value,p_note:$("orderNote").value.trim()};
    const {data:orderId,error}=await db.rpc("create_marketplace_order",payload);if(error)throw error;
    const {data:payment,error:payError}=await db.functions.invoke("create-snap-transaction",{body:{order_id:orderId}});
    if(payError)throw payError;if(!payment?.token)throw new Error("Token pembayaran tidak diterima.");
    hide("checkoutModal");state.cart=[];saveCart();
    if(window.snap?.pay){window.snap.pay(payment.token,{onSuccess:()=>{toast("Pembayaran diterima. Status pesanan sedang diperbarui.");},onPending:()=>toast("Menunggu pembayaran. Kamu dapat memantau status pesanan di dashboard."),onError:()=>toast("Pembayaran belum berhasil. Coba lagi dari riwayat pesanan."),onClose:()=>toast("Jendela pembayaran ditutup. Pesanan tetap tersimpan.")})}
    else if(payment.redirect_url)window.location.href=payment.redirect_url;
    else toast("Pesanan dibuat, tetapi Snap belum termuat. Periksa Client Key Midtrans.");
  }catch(err){console.error(err);toast(err.message||"Checkout gagal. Periksa konfigurasi backend.");}
  finally{btn.disabled=false;btn.textContent="Buat pesanan & lanjut bayar"}
}
function bindSeller(){
  $("logoutBtn").onclick=async()=>{await db.auth.signOut();location.href="index.html"};
  $("addProductBtn").onclick=()=>openProductForm();
  $("productForm").onsubmit=saveProduct;
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(b.dataset.close));
  $("sellerProductList").addEventListener("click",async e=>{const b=e.target.closest("[data-action]");if(!b)return;const p=state.products.find(x=>x.id===b.dataset.id);if(b.dataset.action==="edit")openProductForm(p);if(b.dataset.action==="delete"&&confirm("Hapus produk ini?")){const {error}=await db.from("products").delete().eq("id",p.id);if(error)toast(error.message);else{toast("Produk dihapus.");loadSellerDashboard()}}});
  $("adminUserList")?.addEventListener("change",async e=>{if(!e.target.matches("[data-role]"))return;const {error}=await db.from("profiles").update({role:e.target.value}).eq("id",e.target.dataset.role);if(error)toast(error.message);else toast("Peran diperbarui.")});
}
async function loadSellerDashboard(){
  if(!state.user)return;
  $("sellerIdentity").textContent=state.user.email||"";
  $("statRole").textContent=state.profile?.role||"buyer";
  const isAdmin=state.profile?.role==="admin";
  if(!isAdmin && state.profile?.role!=="seller"){toast("Akun ini belum memiliki peran penjual. Minta admin mengaktifkan akses penjual.");setTimeout(()=>location.href="index.html",1400);return}
  $("adminPanel").hidden=!isAdmin;
  let query=db.from("products").select("*").order("created_at",{ascending:false});if(!isAdmin)query=query.eq("seller_id",state.user.id);
  const {data:products,error}=await query;if(error){toast(error.message);return}state.products=products||[];
  $("statProducts").textContent=state.products.length;
  $("sellerProductList").innerHTML=state.products.length?state.products.map(p=>`<tr><td><div class="table-product"><img src="${esc(imageUrl(p.image_url))}" alt=""><span>${esc(p.title)}</span></div></td><td>${esc(p.category||"Lainnya")}</td><td>${rupiah(p.price)}</td><td>${p.stock}</td><td><span class="status-pill">${p.is_active?"Aktif":"Nonaktif"}</span></td><td><button class="table-action" data-action="edit" data-id="${esc(p.id)}">Edit</button><button class="table-action danger" data-action="delete" data-id="${esc(p.id)}">Hapus</button></td></tr>`).join(""):'<tr><td colspan="6">Belum ada produk.</td></tr>';
  const {data:items}=await db.from("order_items").select("order_id,product_id,quantity,orders(id,created_at,payment_status,order_status)").in("product_id",state.products.map(p=>p.id).length?state.products.map(p=>p.id):["00000000-0000-0000-0000-000000000000"]);
  const unique=[...new Map((items||[]).map(i=>[i.order_id,i.orders])).values()].filter(Boolean);
  $("statOrders").textContent=unique.length;
  $("sellerOrderList").innerHTML=unique.length?unique.map(o=>`<tr><td>${esc(o.id.slice(0,8))}…</td><td>${new Date(o.created_at).toLocaleDateString("id-ID")}</td><td>Pesanan tokomu</td><td><span class="status-pill">${esc(o.payment_status)}</span></td><td>${esc(o.order_status)}</td></tr>`).join(""):'<tr><td colspan="5">Belum ada pesanan.</td></tr>';
  if(isAdmin)await loadAdmin();
}
function openProductForm(p=null){$("productModalTitle").textContent=p?"Edit produk":"Tambah produk";$("prodId").value=p?.id||"";$("prodTitle").value=p?.title||"";$("prodPrice").value=p?.price||"";$("prodStock").value=p?.stock??"";$("prodCategory").value=p?.category||"Elektronik";$("prodImage").value=p?.image_url||"";$("prodDesc").value=p?.description||"";show("productModal")}
async function saveProduct(e){e.preventDefault();const id=$("prodId").value;const row={title:$("prodTitle").value.trim(),price:Number($("prodPrice").value),stock:Number($("prodStock").value),category:$("prodCategory").value,image_url:$("prodImage").value.trim()||null,description:$("prodDesc").value.trim(),seller_id:state.user.id,is_active:true};
  if(!Number.isSafeInteger(row.price)||row.price<1||!Number.isSafeInteger(row.stock)||row.stock<0)return toast("Harga atau stok tidak valid.");
  const result=id?await db.from("products").update(row).eq("id",id):await db.from("products").insert(row);
  if(result.error){toast(result.error.message);return}hide("productModal");toast("Produk berhasil disimpan.");await loadSellerDashboard()}
async function loadAdmin(){
  const [{count:users},{count:orders},{count:products}]=await Promise.all([db.from("profiles").select("*",{count:"exact",head:true}),db.from("orders").select("*",{count:"exact",head:true}),db.from("products").select("*",{count:"exact",head:true})]);
  $("adminUsers").textContent=users??"—";$("adminOrders").textContent=orders??"—";$("adminProducts").textContent=products??"—";
  const {data}=await db.from("profiles").select("id,full_name,role").order("created_at",{ascending:false}).limit(50);
  $("adminUserList").innerHTML=(data||[]).map(u=>`<tr><td>${esc(u.id.slice(0,8))}…</td><td>${esc(u.full_name||"—")}</td><td>${esc(u.role)}</td><td><select data-role="${esc(u.id)}"><option value="buyer" ${u.role==="buyer"?"selected":""}>buyer</option><option value="seller" ${u.role==="seller"?"selected":""}>seller</option><option value="admin" ${u.role==="admin"?"selected":""}>admin</option></select></td></tr>`).join("");
}
document.addEventListener("DOMContentLoaded",init);
