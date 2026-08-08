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

## M2 — Karakter ve fırçalama odaklı Child Home

- [x] Yeni marka renk token’ları ve yumuşak çocuk UI temeli
- [x] Profil bazında kalıcı başlangıç karakteri ve büyük Home karakteri
- [x] Migration 4: günlük sabah/akşam durumu ile temel seri/son etkileşim alanları
- [x] Sabah ve akşam fırçalama görev kartları
- [x] Erişilebilir büyük “Fırçalayalım” ana eylemi
- [x] Ana Sayfa, Görevler, Koleksiyon ve Profil tab route’ları
- [x] Migration, repository, kalıcılık, route ve component testleri
- [x] Gerçek 2 dakikalık timer — M3 kapsamında tamamlandı
- [ ] XP, ödül ve koleksiyon ekonomisi — sonraki milestone kapsamı

## M3 — Brushing Session

- [x] Home’dan gerçek brushing route’una geçiş
- [x] Timestamp tabanlı 120 saniye ve dört adet 30 saniyelik bölüm
- [x] Üst/alt dişler ile dış/iç yüzey yönlendirmeleri
- [x] Pause, resume ve onaylı erken çıkış
- [x] Yaş bandına göre kısa yardımcı metin
- [x] Tamamlanma ekranı ve Home’a dönüş
- [x] Migration 5 ve profil bazlı tamamlanmış seans geçmişi
- [x] Yerel saatle morning/evening görevinin transaction içinde güncellenmesi
- [x] Test clock, SQLite kalıcılık ve route testleri
- [ ] XP, coin, reward, achievement ve gerçek streak — M4 kapsamı

## Açık riskler / teknik borç

- M0 ekranları gerçek cihazda manuel erişilebilirlik incelemesinden geçmelidir.
- EAS preview build kimlik bilgileri ve harici servis gerektirir; M0’da çalıştırılmaz.
- `npm audit --audit-level=critical` geçer; Expo/Metro geliştirme zincirinde 15 high `image-size` ve 8 moderate `uuid` transitif bulgusu kalır. Önerilen zorunlu düzeltme Expo 53’e geri dönüş olduğundan upstream uyumlu çözüm izlenir.
- 4–6 ebeveyn destekli ve 7–11 bağımsız deneyim ayrımları sonraki milestone’larda tasarlanacaktır; bu güncelleme iki ayrı UI modu eklemez.
- Arka planda geçirilen süre timestamp hesabına dahil edilir; uygulamanın işletim sistemi tarafından tamamen sonlandırıldığı yarım seans M3’te geri yüklenmez ve tamamlanmış sayılmaz.
