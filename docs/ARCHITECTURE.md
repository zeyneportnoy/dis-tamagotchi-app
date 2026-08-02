# Mimari

## Hedef

Local-first modüler monolit. UI/routes → application use-cases → domain → repository interface → SQLite/opsiyonel adapter bağımlılık yönü korunur. UI yalnızca `ChildProfileViewModel` görür; SQLite satırları route veya componentlere verilmez.

## Route yapısı

- `app/onboarding`: hesap gerektirmeyen kısa aile/profil kurulumu
- `app/(child)`: aktif profil takma adı ve profil seçimi bulunan M1 Home placeholder
- `app/parent-gate`: her açılışta değişen toplama sorusu
- `app/(parent)`: ebeveyn kapısından sonra açılan placeholder ve yeni profil başlangıcı

Root route aktif profili application use-case üzerinden sorgular. Aktif profil varsa Child Home, yoksa onboarding açılır.

## Veri

SQLite yerel kaynak doğruluğudur. `schema_migrations` uygulanan sürümleri kaydeder. Migration 1 şu yapıları transaction içinde kurar:

- `families`: yerel aile, locale/timezone ve opsiyonel gelecek bulut hesabı sınırı
- `child_profiles`: aile FK’sı, kontrollü yaş bandı, takma ad ve başlangıç avatar anahtarı
- `active_profile`: seçili profil için tek satırlı yerel uygulama durumu

Foreign key’ler her açılışta etkinleştirilir. Profil silinince aktif seçim `NULL`, aile silinince bağlı profiller cascade olur. Migration tekrar çalıştırılabilir ve ürün dışı M2 tabloları oluşturmaz.

Repository yazma işlemleri transaction kullanır. Application katmanı `ensureLocalFamily`, profil oluşturma/listeleme/seçme/güncelleme/arşivleme/silme use-case’lerini sunar.

## Genişleme sınırları

Bulut, analytics, abonelik ve satın alma yalnızca kapalı feature flag’tir. Bu milestone’da SDK, backend, ağ isteği, hesap veya event toplama yoktur.

## Güvenlik ve gizlilik

Uygulama yalnızca cihazda takma ad, yaş bandı ve başlangıç avatar anahtarı saklar; hassas permission istemez. Child route içinde dış bağlantı, fiyat, reklam ve satın alma CTA’sı bulunmaz.
