# Diş Tamagotchi

6–10 yaş çocukları için güvenli, local-first diş fırçalama rutin uygulamasının Milestone 0 iskeleti.

## Gereksinimler

- Node.js 22.13 veya üzeri
- npm 11 veya üzeri
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

## Milestone 1 kapsamı

Uygulama hesap açmadan yerel aile ve birden fazla çocuk profili oluşturur. Kısa onboarding; takma ad, yaş bandı ve yalnızca başlangıç tercihi olan karakter anahtarını kaydeder. Aktif profil SQLite’ta korunur ve sonraki açılış Child Home’a gider. Çocuk alanından veli placeholder’ına geçiş değişken toplama sorulu ebeveyn kapısı arkasındadır.

Bulut, analytics, abonelik ve satın alma kapalıdır. Backend, pet durum sistemi, XP, ödül, koleksiyon, bildirim ve fırçalama zamanlayıcısı yoktur.

### Onboarding akışı

`Welcome → Hesap açmadan devam → Takma ad → Yaş grubu → Başlangıç karakteri → Onay → Child Home`

Test verisini sıfırlamak için geliştirme aşamasında Expo Go içinden uygulama verisi silinmeli veya Simulator uygulaması kaldırılmalıdır; uygulama içinde veri silme UX’i sonraki kapsamda tamamlanacaktır.

Mimari ayrıntıları için `docs/ARCHITECTURE.md`, kararlar için `docs/DECISIONS.md` okunmalıdır.
