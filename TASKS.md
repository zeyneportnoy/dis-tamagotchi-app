# Milestone Takibi

## M0 — Proje iskeleti

- [x] Expo SDK 57 / React Native / TypeScript strict
- [x] Expo Router: onboarding, child, parent
- [x] Tasarım token’ları ve temel componentler
- [x] Türkçe i18n
- [x] SQLite migration altyapısı ve health-check
- [x] Kapalı feature flag’ler
- [x] Test, lint, formatter, typecheck ve CI
- [x] Gerçek iOS Simulator smoke
- [ ] Gerçek Android emulator smoke — Android SDK/emulator ortamı gerekir

## M1 — Yerel veri ve aile kurulumu

- [x] Migration 1: `families`, `child_profiles` ve aktif profil kalıcılığı
- [x] Transaction kullanan repository ve family/profile use-case’leri
- [x] Zod input doğrulaması ve UI view model sınırı
- [x] Kısa Türkçe onboarding: hesapsız kullanım → profil onayı
- [x] Profil varsa Child Home bootstrap yönlendirmesi
- [x] Değişken toplama sorulu temel ebeveyn kapısı
- [x] Migration, repository, kalıcılık, route ve erişilebilirlik testleri
- [x] Dokümantasyon, tam kalite kapıları ve iOS Simulator akış doğrulaması
- [x] Ürün hedefini 4–11 ve yaş bantlarını `4_6`/`7_11` olarak güncelle
- [x] Legacy yaş bantlarını veri kaybı olmadan açık yeniden seçime yönlendir

## Açık riskler / teknik borç

- M0 ekranları gerçek cihazda manuel erişilebilirlik incelemesinden geçmelidir.
- EAS preview build kimlik bilgileri ve harici servis gerektirir; M0’da çalıştırılmaz.
- `npm audit` Expo CLI transitif zincirinde 11 moderate `uuid@7` bulgusu verir; upstream düzeltme izlenmelidir.
- 4–6 ebeveyn destekli ve 7–11 bağımsız deneyim ayrımları sonraki milestone’larda tasarlanacaktır; bu güncelleme iki ayrı UI modu eklemez.
