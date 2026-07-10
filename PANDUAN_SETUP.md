PANDUAN SETUP — AdminFisio
Aplikasi pendaftaran & antrian pasien poli fisioterapi. Container-bound Google Apps Script — artinya kode ini HARUS dibuat dari dalam Google Sheet-nya langsung (Extensions > Apps Script), bukan project Apps Script berdiri sendiri.
________________________________________
1. Struktur Google Sheet yang dibutuhkan
Buat 1 Google Sheet baru, lalu buat 3 tab (sheet) dengan nama PERSIS seperti ini (case-sensitive):
Tab Patients
Header di baris 1, kolom A–J:
A	B	C	D	E	F	G	H	I	J
ID	Timestamp	Nama	No RM	No Telepon	Kategori	Sub Kategori	Status	Catatan	Dicatat Oleh
Kolom "Sub Kategori" tetap ada untuk kompatibilitas data lama, tapi sistem sekarang selalu mengisi - di kolom ini (tidak dipakai aktif).
Tab AdminUsers
Header di baris 1, kolom A–C:
A	B	C
Email	Nama	Role
Role harus persis Admin atau Supervisor (case-sensitive).
•	Admin: bisa daftar pasien, ubah status, lihat audit log
•	Supervisor: bisa daftar pasien & lihat antrian, TIDAK bisa ubah status atau lihat audit log
Tambahkan minimal 1 baris admin di sini sebelum pertama kali pakai aplikasi, contoh:
mirantyramadhani11@gmail.com | Miranty | Admin
Tab AuditLog
Header di baris 1, kolom A–D:
A	B	C	D
Timestamp	Email	Aksi	Detail
Tab ini diisi otomatis oleh sistem — tidak perlu diisi manual.
________________________________________
2. Pasang kode
1.	Buka Sheet yang sudah dibuat di atas
2.	Klik Extensions > Apps Script
3.	Hapus isi default Code.gs, paste kode Code.gs AdminFisio
4.	Klik + di samping "Files" > HTML > beri nama Index (harus persis "Index", tanpa .html saat dikasih nama)
5.	Paste kode Index.html AdminFisio ke file itu
6.	Simpan semua (Ctrl+S)
________________________________________
3. Deploy sebagai Web App
1.	Klik tombol Deploy (kanan atas) > New deployment
2.	Klik ikon gerigi ⚙️ di samping "Select type" > pilih Web app
3.	Isi: 
o	Execute as: User accessing the web app
o	Who has access: Anyone with Google account (atau Anyone within [organisasi] kalau pakai Google Workspace domain resmi)
4.	Klik Deploy
5.	Copy Web app URL yang muncul — ini link yang dipakai staff untuk membuka aplikasi sehari-hari. Bookmark link ini.
Setiap kali kode diubah, ulangi: Deploy > Manage deployments > pensil (edit) > New version > Deploy — kalau cuma disimpan tanpa versi baru, web app tetap menjalankan kode versi lama.
________________________________________
4. Aktifkan auto-archive bulanan (sekali saja)
1.	Di Apps Script editor, pilih fungsi setupMonthlyArchiveTrigger di dropdown sebelah tombol Run
2.	Klik Run, approve izin tambahan yang diminta
3.	Selesai — mulai tanggal 1 tiap bulan jam 01:00, data bulan sebelumnya otomatis dipindah ke sheet arsip baru bernama Patients_YYYY-MM (contoh: Patients_2026-06), dan sheet Patients hanya menyisakan data bulan berjalan.
Cek status trigger: ikon jam ⏰ di sidebar kiri Apps Script editor.
________________________________________
5. Kategori / Pos Terapi yang tersedia
Terapi Elektro, Terapi Latihan, Terapi Anak, Hydro Terapi,
Exo, C-Mill, CX, Robotic
Untuk menambah/mengubah pos, edit array CATEGORIES di baris atas Code.gs, lalu deploy ulang (lihat langkah 3).
________________________________________
6. Menambah admin/supervisor baru
Cukup tambah baris baru di tab AdminUsers (Email, Nama, Role) — tidak perlu deploy ulang, perubahan langsung berlaku begitu orang tersebut membuka web app.
________________________________________
7. Catatan keamanan data
•	Aplikasi ini menyimpan data administratif pendaftaran (nama, No RM, No Telepon, kategori terapi) — bukan rekam medis lengkap.
•	Siapa pun yang punya link web app tetap harus terdaftar di AdminUsers untuk bisa memakai fitur apa pun.
•	Untuk skala penggunaan resmi rumah sakit, pertimbangkan memindahkan kepemilikan Sheet ini ke akun Google Workspace institusi (bukan akun Gmail pribadi), dan menyempitkan "Who has access" ke domain organisasi tersebut.
________________________________________
8. Troubleshooting cepat
Gejala	Kemungkinan penyebab
"Belum terdaftar sebagai admin"	Email belum ada di AdminUsers
Data tersimpan tapi tabel kosong di tampilan	Cek console browser (F12) — kalau ada "deserialize threw error", biasanya karena ada nilai Date mentah dikirim ke client tanpa diformat jadi string dulu di Code.gs
Web app masih pakai fitur lama setelah edit kode	Belum deploy versi baru — ulangi langkah 3
Antrian per pos kosong padahal ada pasien	getQueueByPos hanya menampilkan pasien dengan status Menunggu/Sedang Terapi di tanggal hari ini

