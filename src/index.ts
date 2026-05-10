import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

// 1. Daftarkan semua route SEBELUM app.listen
app.get('/test', (req, res) => {
  res.send('Server Node.js AtoZ Berhasil Berjalan!');
});

// 2. Gunakan fallback (nilai cadangan) agar tidak crash
// Jika Hostinger tidak memberikan PORT, dia akan otomatis pakai 3000
const rawPort = process.env.PORT || 3000;
const PORT = Number(rawPort);

// 3. Jalankan server tanpa '0.0.0.0' agar Hostinger yang mengatur routing jaringannya
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  logger.info({ port: PORT }, "Server listening");
});