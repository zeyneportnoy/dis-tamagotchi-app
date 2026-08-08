# Mimari

## Hedef

Local-first modüler monolit. UI/routes → application use-cases → domain → repository interface → SQLite/opsiyonel adapter bağımlılık yönü korunur. UI yalnızca `ChildProfileViewModel` görür; SQLite satırları route veya componentlere verilmez.

## Route yapısı

- `app/onboarding`: hesap gerektirmeyen kısa aile/profil kurulumu
- `app/age-band-update`: legacy yaş bandı bulunan aktif profil için zorunlu açık yeniden seçim
- `app/(child)`: tab tabanlı çocuk alanı; işlevsel karakter Home ile Görevler, Koleksiyon ve Profil placeholder route’ları
- `app/parent-gate`: her açılışta değişen toplama sorusu
- `app/(parent)`: ebeveyn kapısından sonra açılan placeholder ve yeni profil başlangıcı

Root route aktif profili application use-case üzerinden sorgular. Aktif profil yoksa onboarding, legacy `6_8`/`9_10` bandı varsa yaş bandı güncelleme, güncel bandı varsa Child Home açılır.

## Veri

SQLite yerel kaynak doğruluğudur. `schema_migrations` uygulanan sürümleri kaydeder. Migration 1 şu yapıları transaction içinde kurar:

- `families`: yerel aile, locale/timezone ve opsiyonel gelecek bulut hesabı sınırı
- `child_profiles`: aile FK’sı, kontrollü yaş bandı, takma ad ve başlangıç avatar anahtarı
- `active_profile`: seçili profil için tek satırlı yerel uygulama durumu

Foreign key’ler her açılışta etkinleştirilir. Profil silinince aktif seçim `NULL`, aile silinince bağlı profiller ve ilerleme kaydı cascade olur. Migration runner ikinci çalıştırmada güvenle no-op olur.

Migration 2 aynı ailede tekrar eden takma adları desteklemek için eski unique index’i kaldırır. Migration 3, mevcut profil ve aktif profil kimliklerini koruyarak `child_profiles.age_band` CHECK kuralını günceller. SQLite geçiş döneminde `4_6`, `7_11`, `6_8` ve `9_10` değerlerini okuyabilir; domain create/update girdileri yalnızca `4_6` ve `7_11` kabul eder. Legacy değer ancak kullanıcının açık seçimiyle güncellenir.

Migration 4, profil kimliğine `ON DELETE CASCADE` ile bağlı `profile_progress` tablosunu ekler. Tablo günlük sabah/akşam tamamlanma bayrakları, gelecekte kullanılacak negatif olmayan temel seri sayacı, son etkileşim ve son fırçalama zamanını tutar. Satır ilk erişimde oluşturulur; gün değişince yalnızca günlük görev bayrakları sıfırlanır. Karakter anahtarı mevcut `child_profiles.avatar_id` alanında kalır; böylece her profil farklı karakter taşıyabilir ve ikinci bir kaynak doğruluğu oluşmaz.

Repository yazma işlemleri transaction kullanır. Application katmanı aile/profil use-case’lerine ek olarak profil ilerlemesini okuma ve sabah/akşam durumunu değiştirme use-case’lerini sunar. UI doğrudan SQLite çağırmaz.

## Genişleme sınırları

Bulut, analytics, abonelik ve satın alma yalnızca kapalı feature flag’tir. Bu milestone’da SDK, backend, ağ isteği, hesap veya event toplama yoktur. Gerçek timer, pet bakım durumu, XP, ödül dağıtımı, mağaza ve koleksiyon ekonomisi de yoktur.

## Güvenlik ve gizlilik

Uygulama yalnızca cihazda takma ad, yaş bandı, başlangıç karakter anahtarı ve minimal fırçalama durumunu saklar; hassas permission istemez. Child route içinde dış bağlantı, fiyat, reklam ve satın alma CTA’sı bulunmaz.
