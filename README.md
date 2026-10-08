# Tutorial Arduino Tinkercad

## Menjalankan
    npm install
    npm start        # http://localhost:3000
Atur password admin di file `.env` (`ADMIN_PASSWORD=...`). Port lewat `PORT`.

## Admin
Buka `/admin`, masukkan password. Di sana kamu bisa menambah, mengedit, dan menghapus tutorial.
Gambar bisa berupa URL, path (`/images/x.png`), atau upload file (dikompres otomatis lalu disimpan sebagai base64).
Data disimpan di `data/tutorials.json`. Saat deploy, arahkan `DATA_FILE` ke volume permanen agar data tidak hilang saat redeploy.
