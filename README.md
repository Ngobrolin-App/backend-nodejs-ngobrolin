# 💬 NGOBROLIN – REAL-TIME CHAT APPLICATION

**Ngobrolin** adalah aplikasi **mobile real-time chat** yang memungkinkan pengguna untuk berkomunikasi secara langsung melalui pesan pribadi (*private chat*) maupun grup (*group chat*).

Aplikasi ini dibangun menggunakan **Flutter** pada sisi mobile dan **Node.js (Express.js)** pada sisi backend dengan **PostgreSQL** sebagai database. Sistem komunikasi real-time diimplementasikan secara komprehensif menggunakan **WebSocket melalui Socket.io**, sehingga pesan, status mengetik, hingga laporan dibaca (*read receipt*) dapat dikirim dan diterima secara instan tanpa perlu memuat ulang halaman.

Selain itu, proses deployment backend telah diotomatisasi menggunakan **Jenkins CI/CD Pipeline** yang terintegrasi dengan **GitHub Webhook**, sehingga setiap perubahan pada repository dapat langsung memicu proses deployment secara otomatis ke server.

---

## 👨‍💻 Maintainer

Project ini dikembangkan oleh:

**Yudha Haryoputranto**  
GitHub: https://github.com/yudhah52

---

## ✨ FITUR UTAMA

### 🔐 User Authentication
- Registrasi dan login pengguna.
- Lupa dan Reset Password menggunakan integrasi email via **Brevo** dan *Deeplink*.
- Manajemen akun pengguna secara aman, password disimpan menggunakan **Bcrypt hashing**.

### 💬 Real-time Messaging & Socket
- Pengiriman pesan secara **instan** untuk *Private* dan *Group Chat*.
- Komunikasi **real-time menggunakan WebSocket (Socket.io)**.
- Mendukung pengiriman pesan teks, lampiran gambar (beserta fitur *crop* & *caption*), file, dan *replied message*.
- Sinkronisasi status **Typing Indicator** (sedang mengetik) dan **Read Receipt** (centang biru/pesan dibaca).

### 🔔 Notification System
- Notifikasi pesan masuk menggunakan **Firebase Cloud Messaging (FCM)**.
- Pengguna tetap menerima notifikasi meskipun aplikasi sedang berjalan di latar belakang.

### 👥 User Interaction & Group Management
- **User search** untuk menemukan pengguna lain dan **Groups in common**.
- Pembuatan dan manajemen Grup (Tambah/keluar anggota, ubah foto/nama/deskripsi grup secara *real-time*).
- **Private account settings** (Mencegah interaksi dari *stranger*).
- **Blocked user management**.
- **Language settings** (Mendukung 4 bahasa: Indonesia, English, Japanese, Chinese).

### 🚀 CI/CD & Deployment
- Automated backend deployment menggunakan **Jenkins Pipeline**.
- Integrasi **GitHub Webhook** untuk trigger deployment otomatis setelah push.
- Deployment backend langsung ke VPS/server secara otomatis.

---

## 🧱 TECH STACK

| Layer / Komponen            | Teknologi yang Digunakan |
|----------------------------|--------------------------|
| **Mobile Application**     | Flutter, GetIt, Dio |
| **Arsitektur Aplikasi**    | MVVM (Model–View–ViewModel) |
| **State Management**       | Provider |
| **Backend API**            | Node.js, Express.js |
| **Realtime Communication** | WebSocket (Socket.io) |
| **Database & ORM**         | PostgreSQL, Sequelize CLI |
| **Push Notification & Mail** | Firebase Cloud Messaging (FCM), Brevo |
| **CI/CD & Deployment**     | Jenkins Pipeline, GitHub WebHook |
| **Version Control**        | Git & GitHub |

---

## ⚙️ SYSTEM ARCHITECTURE

Sistem **Ngobrolin** menggunakan arsitektur full-stack yang terdiri dari beberapa komponen utama:

```text
Mobile Application
Flutter + Provider + GetIt
⬇
Realtime Communication
WebSocket (Socket.io)
⬇
Backend API
Node.js + Express.js
⬇
Database
PostgreSQL (via Sequelize)
⬇
Notification & Mail Service
FCM & Brevo
```

### 🔄 Deployment Workflow

```text
Developer Push Code
⬇
GitHub Repository
⬇
GitHub Webhook
⬇
Jenkins Pipeline
⬇
Automatic Backend Deployment
⬇
VPS / Production Server
```

---

## 📱 MODUL & ANTARMUKA APLIKASI

Aplikasi ini dibagi menjadi beberapa modul halaman dengan fungsionalitas spesifik:

- **Autentikasi:** Daftar, Masuk, Lupa Password (via Email link), dan Reset Password (via Deeplink).
- **Halaman Utama (Bottom Navigation):** Wadah untuk navigasi Obrolan, Pengguna, dan Profil.
- **Obrolan (Chat List):** Menampilkan daftar pesan *private* dan *group* dengan indikator *unread count*, *typing status*, dan sinkronisasi data secara otomatis.
- **Pengguna:** Direktori pencarian pengguna, dilengkapi mode *Selecting User* untuk pembuatan Grup Baru atau menambah anggota grup.
- **Profil (Current User & Pengguna Lain):** Menampilkan Bio (*expandable*), foto profil, *Groups in common*, dan opsi blokir.
- **Chat Room:** Antarmuka percakapan (Private & Group) yang mendukung pop-up menu (Reply, Copy, Download), fitur lampiran (*Attachment Preview*), dan *System Message*.
- **Profil Grup & Direktori Grup:** Pengelolaan informasi grup (*real-time update* nama, foto, deskripsi) dan fitur Gabung / Keluar Grup.
- **Pengaturan & Utilitas:** Penggantian bahasa (ID, EN, JP, CN), *toggle* Private Account, manajemen pemblokiran, *Text Editor* (reusable), dan *Image Viewer* layar penuh.

---

## ⚡ ALUR REAL-TIME (SOCKET.IO)

Sistem WebSocket sangat dioptimalkan untuk menyinkronkan data antar klien tanpa *refresh*. Beberapa implementasi utamanya meliputi:

### 1. Sinkronisasi UI Real-Time
- **Chat List:** Menambahkan pesan baru, mengubah urutan obrolan, meng-update info grup (foto/nama), dan status *typing* / *read receipt* secara *real-time*.
- **Chat Room:** Menambahkan *bubble chat* instan, mengubah tampilan UI *input bar* saat status blokir berubah, dan memunculkan *System Message* (misal: "User A bergabung ke grup").
- **Background Sync:** Menggunakan listener global pada room `user_<userId>` di `main.dart` agar aplikasi tetap menerima pembaruan data meskipun user sedang berada di halaman profil atau pengaturan.

### 2. Socket Room Mapping
Aplikasi menggunakan pola pemetaan *Room* dengan format: `Location - emit/on <socket_name> to <room_name>`. 
- **User Room:** `user_<userId>` (Bergabung saat aplikasi berjalan).
- **Conversation Room:** `conversation_<conversationId>` (Bergabung saat membuka `ChatScreen`, keluar saat menutup halaman).

*Beberapa Event Utama:*
- **Chat & Message:** `conversation_created`, `new_message`, `conversation_updated`.
- **Group Info & Members:** `left_participant`, `participants_added`, `participant_joined`.
- **Typing Status:** `typing_start`, `typing_stop`, `user_typing`, `user_stopped_typing`.
- **Read Receipt:** `messages_read_status_updated`, `conversation_read_by_me`.
- **User Status:** `block_status_updated`.

---

## 👨‍💻 MY CONTRIBUTIONS

Pada proyek ini saya bertanggung jawab untuk:

- Merancang dan mengembangkan aplikasi **Ngobrolin** sebagai **real-time chat application** (Private & Group Chat) menggunakan **Flutter** dan **Node.js**.
- Mengimplementasikan infrastruktur **WebSocket (Socket.io)** yang kompleks untuk status perpesanan (*typing indicator*, *read receipt*, *system messages*, dan *real-time UI sync*).
- Mengintegrasikan **Firebase Cloud Messaging (FCM)** untuk sistem notifikasi pesan dan **Brevo** untuk pengiriman tautan Reset Password via email.
- Mengimplementasikan **Bcrypt hashing** untuk keamanan autentikasi pengguna.
- Mengembangkan berbagai fitur UI/UX utama seperti pengiriman lampiran file/gambar, *selecting mode* untuk pembuatan grup, *private account*, dan dukungan multi-bahasa (ID, EN, JP, CN).
- Mendesain serta mengembangkan **relational database schema** menggunakan **PostgreSQL** dan **Sequelize CLI**.
- Mengimplementasikan proses **CI/CD backend deployment** menggunakan **Jenkins Pipeline** dan **GitHub Webhook**.
- Mengelola deployment backend ke server/VPS agar proses update aplikasi dapat berjalan otomatis.

---

## 📄 DOKUMENTASI

Dokumentasi tambahan mengenai desain antarmuka dapat dilihat pada tautan berikut:

### Figma UI Design
[Desain Figma Ngobrolin](https://www.figma.com/design/dslLxMk9eGFG3uv0J60n8R/Ngobrolin?node-id=0-1&t=8zEPpILNlElecNqd-1)

---

## 🔗 REPOSITORY

Source code proyek dapat dilihat pada repository berikut:

### GitHub Repository
[https://github.com/Ngobrolin-App](https://github.com/Ngobrolin-App)
