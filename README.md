# Diş Tamagotchi

4–11 yaş çocukları için güvenli, local-first diş fırçalama rutin uygulaması.

Birincil hedef 4–11 yaştır: 4–6 yaş yaklaşımı ebeveyn destekli/birlikte fırçalamayı, 7–11 yaş yaklaşımı daha bağımsız kullanımı temel alır. Bu aşamada ayrı UI modları, ses sistemi veya oyun mekaniği yoktur; kesin yaş ve doğum tarihi toplanmaz. 12+ MVP kapsamı dışındadır.

## Gereksinimler

- Node.js 22.13 veya üzeri
- npm 10.9.2 (`packageManager` ile sabitlenmiştir)
- iOS için macOS/Xcode; Android için Android Studio veya Expo Go uyumlu cihaz

Proje Node 22 standardını `.nvmrc` ile sabitler:

```bash
nvm use
node --version
```

## Kurulum

```bash
npm ci
cp .env.example .env
npm start
```

`i` iOS, `a` Android hedefini açar. Doğrudan `npm run ios` veya `npm run android` da kullanılabilir.

## Kalite komutları

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run smoke:export
```

## Milestone 2 kapsamı

Uygulama hesap açmadan yerel aile ve birden fazla çocuk profili oluşturur. Kısa onboarding; takma ad, `4_6`/`7_11` yaş bandı ve başlangıç karakterini kaydeder. Aktif profile ait karakter uygulama yeniden açıldığında geri yüklenir. Child Home; karakteri, sabah/akşam diş fırçalama kartlarını ve ana “Fırçalayalım” eylemini merkeze alır. Ana Sayfa, Görevler, Koleksiyon ve Profil sekmeleri gerçek route’lardır; yalnızca Ana Sayfa M2’de işlevseldir.

Legacy `6_8`/`9_10` profilleri tahminle dönüştürülmez; Child Home öncesinde yeni yaş bandı açıkça seçilir. Çocuk alanından veli placeholder’ına geçiş değişken toplama sorulu ebeveyn kapısı arkasındadır.

Bulut, analytics, abonelik ve satın alma kapalıdır. Backend, pet bakım sistemi, XP, ödül ekonomisi, mağaza, bildirim ve gerçek fırçalama zamanlayıcısı yoktur. SQLite yalnızca M2 için karakter anahtarını, günlük sabah/akşam durumunu ve gelecekte kullanılacak temel seri/son etkileşim alanlarını tutar.

### Onboarding akışı

`Welcome → Hesap açmadan devam → Takma ad → Yaş grubu → Başlangıç karakteri → Onay → Child Home`

Test verisini sıfırlamak için geliştirme aşamasında Expo Go içinden uygulama verisi silinmeli veya Simulator uygulaması kaldırılmalıdır; uygulama içinde veri silme UX’i sonraki kapsamda tamamlanacaktır.

Mimari ayrıntıları için `docs/ARCHITECTURE.md`, kararlar için `docs/DECISIONS.md` okunmalıdır.
