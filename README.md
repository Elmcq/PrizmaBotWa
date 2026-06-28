# Ideology Prizmarine Bot

WhatsApp bot untuk komunitas Ideology Prizmarine. Bot ini memakai `whatsapp-web.js`, menampilkan QR login di terminal, dan menyimpan session dengan `LocalAuth`.

## Install

Pastikan Node.js sudah terpasang, lalu jalankan:

```bash
npm install
```

## Atur Server

Buka `config.js`, lalu edit bagian ini:

```js
server: {
  name: 'Ideology Prizmarine',
  ip: 'ISI_IP_SERVER_DI_SINI',
  port: 19132
}
```

Ganti `ip` dengan alamat server Minecraft Bedrock kamu. Port default Bedrock biasanya `19132`.

## Monitoring Server

Bot bisa memonitor server Minecraft Bedrock otomatis dan mengirim notifikasi saat status berubah dari online ke offline, atau dari offline ke online.

Atur bagian ini di `config.js`:

```js
enableMonitoring: true,
monitorInterval: 60000,
notificationGroupId: '',
```

Keterangan:

- `enableMonitoring`: isi `true` untuk mengaktifkan monitoring, atau `false` untuk mematikan.
- `monitorInterval`: jarak pengecekan dalam milidetik. Default `60000` berarti 60 detik.
- `notificationGroupId`: ID grup WhatsApp tujuan notifikasi. Jika kosong, monitoring tetap berjalan tapi bot tidak mengirim notifikasi.

### Cara Mendapatkan Group ID

Group ID WhatsApp biasanya berakhiran `@g.us`.

Cara sederhana:

1. Jalankan bot dengan `npm start`.
2. Kirim pesan atau command dari grup target.
3. Tambahkan sementara `console.log(message.from);` di event `client.on('message')` pada `index.js`.
4. Salin nilai yang muncul di terminal, lalu masukkan ke `notificationGroupId`.
5. Hapus lagi log sementara tersebut setelah Group ID didapat.

## Run Bot

Jalankan bot dari terminal:

```bash
npm start
```

## Scan QR WhatsApp

Saat bot dijalankan pertama kali, terminal akan menampilkan QR.

1. Buka WhatsApp di HP.
2. Masuk ke menu Perangkat tertaut.
3. Pilih Tautkan perangkat.
4. Scan QR yang muncul di terminal.

Setelah berhasil login, session akan tersimpan di folder `.wwebjs_auth`, jadi biasanya tidak perlu scan ulang setiap kali bot dijalankan.

## Command

Prefix command adalah `/`.

```text
/help   - Tampilkan semua command
/ip     - Tampilkan IP server Minecraft
/status - Cek status server
/player - Tampilkan jumlah player online
/ping   - Cek bot masih hidup
/about  - Tampilkan informasi bot
```

Kalau command tidak dikenal, bot akan membalas:

```text
Command tidak ditemukan. Ketik /help
```

## Changelog

### v1.4.0

- Tambah monitoring otomatis server Minecraft Bedrock setiap 60 detik.
- Tambah cache status di memory agar notifikasi hanya dikirim saat status berubah.
- Tambah konfigurasi `enableMonitoring`, `monitorInterval`, dan `notificationGroupId`.
- Tambah notifikasi grup untuk server online/offline.
- Tambah logging status monitoring di terminal.
- Monitoring otomatis mulai saat bot ready dan berhenti saat koneksi WhatsApp putus.

### v1.1.0

- Tambah command `/ping` untuk cek status bot, uptime, dan latency.
- Tambah command `/about` untuk informasi bot.
- Update `/help` dengan daftar command terbaru.
- Tambah logging command di terminal.
- Tambah startup banner saat bot ready.
- Tambah basic handling untuk `auth_failure`, `disconnected`, dan `change_state`.
