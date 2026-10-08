// Tambah tutorial baru dengan menambahkan object baru di array ini.
// "id" dipakai sebagai alamat: /tutorials/<id>
module.exports = [
  {
    id: "rgb-led-color-fading",
    title: "RGB LED Color Fading",
    description:
      "Membuat LED RGB berubah warna secara perlahan dari merah → hijau → biru → kembali ke merah menggunakan Arduino Uno.",
    short: "Membuat RGB LED berubah warna secara otomatis.",
    image: "/images/rgb-led-color-fading.svg", // ganti dengan gambar Tinkercad kamu, mis. .png
    imageAlt: "Rangkaian RGB LED dengan Arduino Uno di Tinkercad",
    components: [
      "1 Arduino Uno",
      "1 RGB LED",
      "1 resistor 330Ω",
      "Kabel jumper",
    ],
    connectionsIntro:
      "Letakkan RGB LED dengan 4 kaki menghadap ke arah kamu, lalu lihat dari kiri ke kanan.",
    connections: [
      { from: "Pin pertama dari kiri", to: "Pin 9 Arduino" },
      { from: "Pin kedua dari kiri", to: "Resistor 330Ω, lalu ujung resistor lainnya ke GND Arduino" },
      { from: "Pin ketiga dari kiri", to: "Pin 11 Arduino" },
      { from: "Pin keempat dari kiri", to: "Pin 10 Arduino" },
    ],
    code: `#define red 9
#define green 10
#define blue 11

void setup() {
  pinMode(red, OUTPUT);
  pinMode(green, OUTPUT);
  pinMode(blue, OUTPUT);
}

void setColor(int r, int g, int b) {
  analogWrite(red, r);
  analogWrite(green, g);
  analogWrite(blue, b);
}

void fade(int r1, int g1, int b1, int r2, int g2, int b2) {
  for (int i = 0; i <= 255; i++) {
    int r = map(i, 0, 255, r1, r2);
    int g = map(i, 0, 255, g1, g2);
    int b = map(i, 0, 255, b1, b2);

    setColor(r, g, b);
    delay(1);
  }
}

void loop() {
  // Merah -> Hijau
  fade(255, 0, 0, 0, 255, 0);

  // Hijau -> Biru
  fade(0, 255, 0, 0, 0, 255);

  // Biru -> Merah
  fade(0, 0, 255, 255, 0, 0);
}`,
  },
];
