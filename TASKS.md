# Milestone Takibi

## M0 — Proje iskeleti

- [x] Expo SDK 57 / React Native / TypeScript strict
- [x] Expo Router: onboarding, child, parent
- [x] Tasarım token’ları ve temel componentler
- [x] Türkçe i18n
- [x] SQLite migration altyapısı ve health-check
- [x] Kapalı feature flag’ler
- [x] Test, lint, formatter, typecheck ve CI
- [ ] Gerçek iOS simulator smoke — Xcode/Simulator ortamı gerekir
- [ ] Gerçek Android emulator smoke — Android SDK/emulator ortamı gerekir

## M1 — Yerel veri ve aile kurulumu

- [ ] Başlatılmadı; kullanıcı onayı bekleniyor.

## Açık riskler / teknik borç

- M0 ekranları gerçek cihazda manuel erişilebilirlik incelemesinden geçmelidir.
- EAS preview build kimlik bilgileri ve harici servis gerektirir; M0’da çalıştırılmaz.
- `npm audit` Expo CLI transitif zincirinde 11 moderate `uuid@7` bulgusu verir; upstream düzeltme izlenmelidir.
