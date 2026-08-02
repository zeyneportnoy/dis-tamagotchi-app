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

## M0 kapsamı

Expo Router route grupları, strict TypeScript, temel tasarım sistemi, Türkçe i18n, SQLite migration altyapısı ve health-check içerir. Bulut, analytics, abonelik ve satın alma kapalıdır. Backend, ürün tabloları, profil, karakter ve fırçalama zamanlayıcısı yoktur.

Mimari ayrıntıları için `docs/ARCHITECTURE.md`, kararlar için `docs/DECISIONS.md` okunmalıdır.
