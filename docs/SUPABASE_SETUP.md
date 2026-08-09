# Supabase Setup — M3.5

Gerçek signup/e-posta doğrulama testi için aşağıdaki dashboard adımları kullanıcı tarafından tamamlanmalıdır.

1. Supabase Dashboard’da yeni bir project oluşturun.
2. Project Settings → API’den Project URL ve **publishable** key değerlerini alın.
3. Yerel `.env` içine `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` yazın. Service-role key kullanmayın.
4. Authentication → Providers → Email altında email/password provider’ı ve email confirmation’ı açın.
5. Authentication → URL Configuration içinde redirect allow list'e `distamagotchi://auth/callback` ve `distamagotchi://auth/reset-password` ekleyin.
   E-posta şablonundaki doğrulama bağlantısı `{{ .ConfirmationURL }}` kullanmalıdır. Custom scheme Expo Go tarafından kaydedilmez; gerçek bağlantı testi development veya production build ile yapılır.
6. SQL Editor veya Supabase CLI ile `supabase/migrations/202608080001_m35_parent_auth_profiles.sql` migration’ını uygulayın.
7. `parent_profiles` ve `child_profiles` tablolarında RLS’nin açık olduğunu doğrulayın.
8. İki ayrı test kullanıcısıyla user A’nın user B kayıtlarını okuyamadığını/yazamadığını doğrulayın.
9. Authentication → Email Templates alanında aşağıdaki geçici Türkçe metinleri yapılandırın.
10. Production yayınından önce custom SMTP yapılandırın.

## Email verification taslağı

- Başlık: E-posta adresini doğrula
- Metin: Merhaba, hesabını tamamlamak için aşağıdaki bağlantıyı kullanarak e-posta adresini doğrula. Bu işlemi sen başlatmadıysan bu e-postayı dikkate almayabilirsin.
- CTA: E-postamı Doğrula

## Password reset taslağı

- Başlık: Şifreni yenile
- Metin: Şifreni yenilemek için aşağıdaki bağlantıyı kullan. Bu talebi sen oluşturmadıysan herhangi bir işlem yapman gerekmez.
- CTA: Yeni Şifre Oluştur

M3.5 sync kapsamı veli hesabı ve child profile recovery foundation’dır. Brushing history cloud’a gönderilmez.
