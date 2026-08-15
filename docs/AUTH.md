# M3.5 Authentication Architecture

Veli kimliği Supabase Auth tarafından yönetilir. Mobil presentation katmanı Supabase istemcisine doğrudan erişmez; `ParentAuthService` ve application use-case sınırını kullanır.

## Route durumu

- Oturumsuz: Welcome, signup, login, reset request ve legal ekranları
- Oturumlu fakat e-postası doğrulanmamış: verify-email
- Doğrulanmış ve legacy local profili olan: açık sahiplenme ekranı
- Doğrulanmış ve profili olmayan: mevcut nickname → age band → character onboarding
- Doğrulanmış ve profili olan: child uygulaması

Session AsyncStorage’da Supabase istemcisi tarafından saklanır. Token refresh AppState aktif/pasif durumuna göre yönetilir. Token, şifre veya session içeriği loglanmaz.

Logout cloud session’ını temizler ve protected route’ları kapatır; local child/brushing verisini silmez. Bu shared-device davranışı nedeniyle login olmadan child route açılması guard ile engellenir. Release öncesinde hesap silme için service-role anahtarını mobil uygulamaya koymayan güvenli server-side işlem gereklidir.
