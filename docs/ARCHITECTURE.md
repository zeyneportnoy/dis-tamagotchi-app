# Mimari

## Hedef

Local-first modüler monolit. UI/routes → application use-cases → domain → repository interface → SQLite/opsiyonel adapter bağımlılık yönü korunur. UI yalnızca `ChildProfileViewModel` görür; SQLite satırları route veya componentlere verilmez.

## Route yapısı

- `app/onboarding`: hesap gerektirmeyen kısa aile/profil kurulumu
- `app/age-band-update`: legacy yaş bandı bulunan aktif profil için zorunlu açık yeniden seçim
- `app/(child)`: tab tabanlı çocuk alanı; işlevsel karakter Home ile Görevler, Koleksiyon ve Profil placeholder route’ları
- `app/brushing`: tab alanının üzerinde açılan 120 saniyelik seans ve completion görünümü
- `app/parent-gate`: her açılışta değişen toplama sorusu
- `app/(parent)`: ebeveyn kapısından sonra açılan placeholder ve yeni profil başlangıcı

Root route aktif profili application use-case üzerinden sorgular. Aktif profil yoksa onboarding, legacy `6_8`/`9_10` bandı varsa yaş bandı güncelleme, güncel bandı varsa Child Home açılır.

Child tab kökleri geri butonu göstermez. Onboarding'in kök dışındaki ekranları native Stack header içinde ortak `BackButton` kullanır; parent gate ve parent placeholder gibi bağımsız detay route'ları aynı görsel standardı route seviyesinde uygular. Brushing route'unun erken çıkışı, tamamlanmamış seansı yanlışlıkla kaybetmemek için kendi onay akışını korur.

Home profil değiştirici yalnız bir sunum katmanıdır: başlıktaki erişilebilir tetikleyici modal seçim yüzeyini açar, seçim mevcut family application use-case'i üzerinden kalıcılaştırılır. Domain kuralı veya SQLite erişimi component içine taşınmaz.

## Veri

SQLite yerel kaynak doğruluğudur. `schema_migrations` uygulanan sürümleri kaydeder. Migration 1 şu yapıları transaction içinde kurar:

- `families`: yerel aile, locale/timezone ve opsiyonel gelecek bulut hesabı sınırı
- `child_profiles`: aile FK’sı, kontrollü yaş bandı, takma ad ve başlangıç avatar anahtarı
- `active_profile`: seçili profil için tek satırlı yerel uygulama durumu

Foreign key’ler her açılışta etkinleştirilir. Profil silinince aktif seçim `NULL`, aile silinince bağlı profiller ve ilerleme kaydı cascade olur. Migration runner ikinci çalıştırmada güvenle no-op olur.

Migration 2 aynı ailede tekrar eden takma adları desteklemek için eski unique index’i kaldırır. Migration 3, mevcut profil ve aktif profil kimliklerini koruyarak `child_profiles.age_band` CHECK kuralını günceller. SQLite geçiş döneminde `4_6`, `7_11`, `6_8` ve `9_10` değerlerini okuyabilir; domain create/update girdileri yalnızca `4_6` ve `7_11` kabul eder. Legacy değer ancak kullanıcının açık seçimiyle güncellenir.

Migration 4, profil kimliğine `ON DELETE CASCADE` ile bağlı `profile_progress` tablosunu ekler. Tablo günlük sabah/akşam tamamlanma bayrakları, gelecekte kullanılacak negatif olmayan temel seri sayacı, son etkileşim ve son fırçalama zamanını tutar. Satır ilk erişimde oluşturulur; gün değişince yalnızca günlük görev bayrakları sıfırlanır. Karakter anahtarı mevcut `child_profiles.avatar_id` alanında kalır; böylece her profil farklı karakter taşıyabilir ve ikinci bir kaynak doğruluğu oluşmaz.

Migration 5, `brushing_sessions` tablosunu ve profil/tamamlanma zamanı index’ini ekler. Yalnız başarıyla biten seans yazılır. Session insert ile `profile_progress` morning/evening, `last_interaction_at` ve `last_brushing_at` güncellemesi aynı SQLite transaction’ındadır. Period yerel tamamlanma saatinden belirlenir: 04:00–15:59 morning, diğer saatler evening.

Repository yazma işlemleri transaction kullanır. Application katmanı aile/profil use-case’lerine ek olarak profil ilerlemesini okuma, tamamlanan brushing session kaydetme ve geçmişi listeleme use-case’lerini sunar. UI doğrudan SQLite çağırmaz.

Brushing timer kalıcı veri modelinden ayrıdır. Saf domain fonksiyonları başlangıç timestamp’i, toplam pause süresi ve güncel timestamp üzerinden elapsed/remaining/segment snapshot’ı üretir. Render sayısı süre kaynağı değildir; 250 ms interval yalnız ekranı yeniler. AppState değişiminde timestamp yeniden okunur, dolayısıyla kısa background geçişi sayacı bozmaz. Yarım kalan transient seans uygulama process’i sonlandırılırsa geri yüklenmez ve completion kaydı oluşturmaz.

## Genişleme sınırları

Bulut, analytics, abonelik ve satın alma yalnızca kapalı feature flag’tir. Bu milestone’da SDK, backend, ağ isteği, hesap veya event toplama yoktur. Pet bakım durumu, XP, ödül dağıtımı, gerçek streak, mağaza ve koleksiyon ekonomisi de yoktur.

## Güvenlik ve gizlilik

Uygulama yalnızca cihazda takma ad, yaş bandı, başlangıç karakter anahtarı ve minimal fırçalama durumunu saklar; hassas permission istemez. Child route içinde dış bağlantı, fiyat, reklam ve satın alma CTA’sı bulunmaz.
