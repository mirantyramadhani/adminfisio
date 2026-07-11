# AdminFisio

Aplikasi web pendaftaran & manajemen antrian pasien untuk unit rehabilitasi medik (fisioterapi) — dibangun dengan Google Apps Script, menggantikan proses pencatatan manual yang sebelumnya dilakukan dengan menduplikasi dan mengosongkan tabel Excel setiap hari.

## Latar Belakang

Unit fisioterapi yang jadi target aplikasi ini melayani **hingga 250 pasien per hari**, terbagi ke 8 pos terapi berbeda (Elektro, Latihan, Terapi Anak, Hydro, Exo, C-Mill, CX, Robotic). Proses pencatatan sebelumnya sepenuhnya manual: staf menduplikasi tabel jadwal setiap hari, mengosongkan isinya, dan mengisi ulang tanggal — pekerjaan repetitif yang rawan kesalahan dan tidak menghasilkan data yang bisa dianalisis.

AdminFisio dibangun untuk menggantikan proses itu dengan sistem pendaftaran otomatis yang tetap sederhana digunakan oleh staf non-teknis, sambil menjaga data tetap terstruktur dan bisa diolah lebih lanjut.

## Fitur

- **Registrasi pasien** — form sederhana dengan validasi, ID pasien otomatis (`FIS-YYYYMMDD-NNN`)
- **Antrian per pos** — setiap pos terapi punya tampilan antrian sendiri (nama, jam daftar, status) yang otomatis terfilter dari data hari itu — staf tidak perlu menyaring data pos lain secara manual
- **Role-based access** — Admin (bisa ubah status, lihat audit log) vs Supervisor (registrasi & lihat antrian saja)
- **Audit log** — setiap aksi (registrasi, ubah status) tercatat dengan waktu, email pelaku, dan detail
- **Auto-archive bulanan** — data bulan sebelumnya otomatis dipindahkan ke sheet arsip terpisah setiap tanggal 1, menjaga performa tanpa kehilangan histori
- **Laporan & grafik** — dashboard visual (total pasien per pos, tren kunjungan bulanan) yang menggabungkan data dari sheet aktif *dan* seluruh sheet arsip secara otomatis

## Arsitektur

Prinsip desain utama: **satu sumber data (master table), banyak tampilan**. Semua pendaftaran masuk ke satu sheet `Patients` berformat *long* (satu baris = satu kunjungan), lalu setiap kebutuhan tampilan (antrian per pos, laporan, audit) adalah *view* yang di-generate dari sumber data yang sama — bukan disalin manual ke tempat terpisah.

Pendekatan ini sengaja dipilih untuk menghindari masalah yang sama seperti data Excel manual sebelumnya: begitu data tersebar ke banyak tempat (misalnya satu sheet per hari), menyusun laporan gabungan jadi pekerjaan manual lagi.

```
Registrasi (form)
      │
      ▼
 Sheet "Patients"  ──────► Antrian per Pos (filter: kategori + tanggal hari ini)
 (master, long-format)     Daftar Pasien (filter: kategori/status/keyword)
      │                    Laporan (agregasi seluruh sheet)
      ▼
 Auto-archive bulanan
 → Patients_YYYY-MM
```

## Tech Stack

- Google Apps Script (backend, container-bound ke Google Sheets)
- HTML/CSS/JavaScript vanilla (frontend, disajikan lewat `HtmlService`)
- Google Charts (visualisasi laporan)
- Google Sheets sebagai penyimpanan data

## Setup

Lihat [`PANDUAN_SETUP.md`](PANDUAN_SETUP.md) untuk struktur sheet yang dibutuhkan, langkah deploy, dan catatan keamanan.

## Catatan Pengembangan

Beberapa keputusan teknis yang diambil selama pengembangan, didokumentasikan karena relevan untuk proyek serupa:

- **Objek `Date` tidak boleh dikirim mentah** dari server (`Code.gs`) ke client lewat `google.script.run` — menyebabkan kegagalan silen (`deserialize threw error`) di sisi client tanpa pesan error yang jelas. Solusi: format tanggal jadi string di server sebelum dikirim.
- **`LockService`** digunakan untuk mencegah race condition saat beberapa staf mendaftarkan pasien secara bersamaan.
- Struktur kategori terapi di-*flatten* dari model induk-sub (`General Terapi > Elektro/Latihan`) menjadi 8 kategori sejajar, untuk menyederhanakan filter dan tampilan antrian per pos.

## Status

Digunakan untuk skala nyata (~250 pasien/hari), telah divalidasi dari sisi performa dan arsitektur data untuk volume tersebut.

---

*Dibangun oleh Miranty Ramadhani, terinspirasi dari pengamatan langsung terhadap proses administratif di unit fisioterapi tempat suaminya bekerja.*
