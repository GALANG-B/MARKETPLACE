# PasarKita — panduan pemasangan

## Isi paket
- `index.html`, `seller.html`, `style.css`, `app.js`: frontend.
- `supabase/schema.sql`: tabel, trigger profil, RPC checkout, dan RLS.
- `supabase/functions/create-snap-transaction/index.ts`: membuat Snap token dari backend.
- `supabase/functions/midtrans-webhook/index.ts`: verifikasi notifikasi pembayaran.

## 1. Backup dan database
1. Backup project Supabase yang sudah ada.
2. Buka Supabase Dashboard → SQL Editor.
3. Jalankan `supabase/schema.sql`.
4. Jika tabel `products` lama memiliki struktur/constraint berbeda, sesuaikan migrasi sebelum menjalankan SQL. Jangan jalankan di production tanpa backup.
5. Daftarkan akun pertama, lalu ubah role akun pemilik menjadi `seller` atau `admin` lewat SQL Editor. Contoh admin:
   `update public.profiles set role='admin' where id=(select id from auth.users where email='EMAIL_ADMIN_KAMU');`
6. Berikan role `seller` kepada akun yang boleh menerbitkan produk. Pendaftaran publik otomatis menjadi `buyer`.

## 2. Frontend
1. Isi `SUPABASE_URL` dan publishable/anon key pada `app.js` dengan nilai dari Project Settings → API.
2. Ganti `GANTI_DENGAN_MIDTRANS_CLIENT_KEY` pada `index.html` dengan Client Key Midtrans Sandbox.
3. Pastikan file frontend di-host melalui HTTPS.
4. Jangan masukkan Midtrans Server Key atau Supabase service-role key ke frontend.

## 3. Edge Functions
Deploy kedua folder function ke project Supabase (CLI):
- `supabase functions deploy create-snap-transaction`
- `supabase functions deploy midtrans-webhook`

Set secrets melalui Supabase Dashboard → Edge Functions → Secrets:
- `MIDTRANS_SERVER_KEY` = Server Key sandbox.
- `MIDTRANS_IS_PRODUCTION` = `false` untuk sandbox.
- `PAYMENT_FINISH_URL` = URL halaman toko yang valid (opsional; mis. URL index.html yang sudah di-host).
Supabase menyediakan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` pada runtime Edge Function. Jangan pernah menaruh service-role key di browser.

`create-snap-transaction` membutuhkan JWT pengguna; biarkan verifikasi JWT aktif. Fungsi webhook menggunakan RPC terbatas `apply_midtrans_status` untuk pembaruan status dan pengembalian stok.
`midtrans-webhook` harus dapat menerima callback Midtrans tanpa login, jadi nonaktifkan JWT verification hanya untuk function webhook (mis. konfigurasi `verify_jwt = false` pada `supabase/config.toml` untuk function ini). Function tetap memverifikasi signature SHA-512 Midtrans.

## 4. Midtrans
1. Gunakan Sandbox dulu.
2. Masukkan Client Key di frontend dan Server Key sebagai secret Edge Function.
3. Atur Payment Notification URL di dashboard merchant ke URL function:
   `https://PROJECT_REF.supabase.co/functions/v1/midtrans-webhook`
4. Uji pembayaran menggunakan skenario dan instrumen sandbox resmi.
5. Pindah ke production hanya setelah akun merchant, domain, webhook, dan seluruh pengujian diverifikasi. Jangan membagikan Server Key.

## 5. Pengiriman
Pilihan `manual` sudah tersimpan di order. Pilihan `courier` disediakan sebagai titik integrasi, tetapi tarif otomatis belum aktif. Untuk ongkir live, pilih penyedia logistik, dapatkan API credential melalui akun yang sah, lalu implementasikan quote dan tracking pada Edge Function. Jangan menganggap pilihan courier saat ini sudah menghitung tarif.

## 6. Status & keterbatasan versi ini
- Checkout membuat order di database dan mengurangi stok secara atomik.
- Integrasi Midtrans Snap memulai pembayaran dan webhook memperbarui status.
- Ongkir belum ditambahkan ke total; order disimpan dengan shipping_cost = 0 sampai modul ongkir dikembangkan.
- Stok dikembalikan sekali ketika webhook terverifikasi memberi status failed/expired. Tetap siapkan rekonsiliasi untuk callback yang gagal terkirim.
- Dashboard admin menampilkan ringkasan dan daftar role. Promosi admin harus dilakukan langsung oleh pemilik database, bukan melalui registrasi publik.
- Seller dashboard menampilkan pesanan terkait produknya; alur pengiriman dan penyelesaian pesanan masih perlu endpoint khusus.
- Perlu uji RLS, validasi, webhook idempotency, dan uji beban sebelum menerima transaksi sungguhan.

## 7. Keamanan penting
- Anon/publishable key memang dipakai di frontend, tetapi semua tabel exposed wajib RLS.
- Server Key Midtrans dan service-role key hanya boleh berada di secrets server.
- Gunakan sandbox untuk pengujian; jangan aktifkan transaksi live sampai pemilik akun merchant yang memenuhi persyaratan penyedia menyelesaikan verifikasi dan pengujian.
