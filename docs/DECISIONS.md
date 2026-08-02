# Teknik Kararlar

## 2026-08-02 — ADR-001: Expo SDK 57 toolchain

Expo `~57.0.9`, React Native `0.86.2`, React `19.2.3` ve TypeScript `~6.0.3` seçildi. Bunlar kurulum tarihinde resmi Expo template ve SDK uyumluluk tablosundaki güncel kararlı kombinasyondur. SDK 57’nin minimum Node 22.13 şartı `engines` ve CI’da sabitlendi; npm lockfile tek paket kaynağıdır.

## 2026-08-02 — ADR-002: Expo managed + Expo Router

Dosya tabanlı route grupları kullanılır. M0 native modülleri Expo Go ile uyumludur; development build zorunlu değildir. Sonraki milestone native entegrasyon eklerse bu karar yeniden değerlendirilir.

SDK 57 app config şemasına uygun olarak splash görünümü kök `splash` alanı yerine `expo-splash-screen` config plugin’i üzerinden tanımlanır.

## 2026-08-02 — ADR-003: Strict TypeScript ve düz katman sınırı

`strict`, `noUncheckedIndexedAccess` ve `noImplicitOverride` açıktır. `@/` yalnızca `src/` köküne gider. Domain/Application katmanları ürün kuralı başladığında eklenecek; boş klasör üretilmedi.

## 2026-08-02 — ADR-004: Türkçe-first i18next

i18next/react-i18next seçildi. Componentlerde kullanıcı cümlesi tutulmaz; Türkçe tek M0 kaynak dili, Türkçe fallback’tir. Dil seçimi ve kalıcılığı onboarding milestone’una bırakıldı.

## 2026-08-02 — ADR-005: SQLite migration bootstrap

`expo-sqlite` async API kullanılır. Runner yalnızca `schema_migrations` metadata tablosunu ve `SELECT 1` health-check’i kurar. M0 migration listesi boştur; ürün tabloları M1’e aittir. Testlerde platform SQLite yerine runner sözleşmesi ve health-check izole test edilir; geçici native DB repository testleri ürün tablolarıyla M1’de başlar.

## 2026-08-02 — ADR-006: Entegrasyonlar varsayılan kapalı

Cloud, analytics, subscriptions ve purchases env değerleri yalnızca tam `true` olduğunda açılır. M0’da adapter/SDK/backend kurulmaz; yanlışlıkla veri veya ağ trafiği oluşmaz.

## 2026-08-02 — ADR-007: CI kapsamı

Her PR/main push’ta npm clean install, format, lint, typecheck, Jest, DB health testi, iOS/Android JavaScript bundle export smoke, critical dependency audit ve Gitleaks çalışır. Native cloud build maliyet/credential gerektirdiği için PR kapısında yoktur; release aşamasında EAS preview/release workflow eklenir. Web ürün hedefi değildir ve `expo-sqlite` web WASM yapılandırması M0 kapsamına alınmamıştır.

## 2026-08-02 — ADR-008: Tasarım ve erişilebilirlik tabanı

Belgedeki Navy, Teal, Indigo, Off-white, Success, Warning ve Danger token’ları kaynak doğruluğudur. Temel child CTA minimum 48 dp, accessibility role/label içerir. Danger çocuk cezası için kullanılmaz.

## 2026-08-02 — ADR-009: Transitif audit bulgusu kabulü

`npm audit --audit-level=critical` geçer; 11 moderate bulgu Expo CLI’nin `xcode → uuid@7` geliştirme zincirindedir. `npm audit fix --force` güncel SDK ile uyumsuz eski Expo paketleri önerdiği için uygulanmadı. Uygulama runtime’ında doğrudan `uuid` kullanımı yoktur; Expo upstream güncellemesi izlenecektir.

## 2026-08-02 — ADR-010: Node 22 geliştirme ve CI standardı

Projenin tekrar üretilebilir çalışma standardı Node 22’dir. `.nvmrc` ana sürümü `22` olarak sabitler, `package.json` en az Node 22.13 ister ve GitHub Actions Node 22.13 kullanır. İlk kurulumda araç ortamının Node 24 çalıştırması bir ürün hatası değildir; bağımlılık kurulumu ve CI için desteklenen ortak taban Node 22.13+ olarak belirlenmiştir.
