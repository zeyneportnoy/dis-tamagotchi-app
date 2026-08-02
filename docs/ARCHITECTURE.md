# Mimari

## Hedef

Local-first modüler monolit. UI/routes → application use-cases → domain → repository interface → SQLite/opsiyonel adapter bağımlılık yönü korunur. M0’da yalnızca presentation, config, i18n, design-system ve database bootstrap vardır.

## Route yapısı

- `app/onboarding`: ilk kurulum akışı; M0’da Welcome placeholder
- `app/(child)`: çocuk deneyimi; M0’da Home placeholder
- `app/(parent)`: yalnızca ebeveyn kapısı ardından erişilecek alan; M0’da placeholder

## Veri

SQLite yerel kaynak doğruluğudur. `schema_migrations` altyapı tablosu uygulanan migration sürümlerini kaydeder. M0 migration listesi bilerek boştur; ürün tabloları M1’den önce oluşturulmaz. Açılışta migration runner ardından `SELECT 1` health-check çalışır.

## Genişleme sınırları

Bulut, analytics, abonelik ve satın alma yalnızca kapalı feature flag’tir. Bu milestone’da SDK, backend, ağ isteği, hesap veya event toplama yoktur.

## Güvenlik ve gizlilik

Uygulama M0’da kişisel veri toplamaz ve hassas permission istemez. Child route içinde dış bağlantı, fiyat, reklam ve satın alma CTA’sı bulunmaz.
