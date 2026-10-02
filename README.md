# Odometer Music Picker

GitHub Pages üzerinden yayınlanmaya hazır, HTML/CSS/JavaScript dosyalarına ayrılmış sürüm.

## GitHub'a yükleme

1. GitHub'da yeni bir repository oluştur.
2. Bu klasördeki dosyaların tamamını repository'nin kök dizinine yükle.
3. Repository'de **Settings → Pages** bölümünü aç.
4. **Build and deployment** altında **Deploy from a branch** seç.
5. Branch olarak `main`, klasör olarak `/(root)` seçip **Save**'e bas.
6. Yayınlama tamamlanınca GitHub Pages URL'sini aç.

## Yerel test

`index.html` dosyasını doğrudan açarak arayüzü görebilirsin. PWA/service worker özelliklerini test etmek için HTTPS veya localhost kullan.

## Önemli notlar

- `manifest.json` ve `service-worker.js` göreli yollar kullandığı için proje deposu alt yolunda da çalışacak şekilde düzenlenmiştir.
- Müzik dosyaları harici URL'lerden geliyor. Mevcut kodda yalnızca No.1'in iki şarkısı için ses URL'si tanımlı; diğer şarkılar için `app.js` içindeki `songAudioMap` nesnesine URL eklemelisin.
- PWA önbelleği dosyaları önbelleğe alır; harici müzik URL'lerinin çevrimdışı çalışmasını garanti etmez.
