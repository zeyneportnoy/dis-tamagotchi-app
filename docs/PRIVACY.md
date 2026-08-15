# Gizlilik ve Çocuk Güvenliği

M3.5 ile veli için display name ve e-posta cloud-backed Supabase Auth kapsamında işlenir; authentication credential’ları Supabase Auth tarafından yönetilir. Child profile recovery amacıyla takma ad, `4_6`/`7_11` yaş bandı ve karakter seçimi veli hesabına bağlı Supabase Postgres kaydına sync edilir.

Çocuktan e-posta, telefon, tam ad, soyad, kesin doğum tarihi, konum, okul, kamera, mikrofon veya kişi listesi alınmaz. M1–M3 brushing history M3.5 kapsamında cloud’a sync edilmez ve SQLite’da kalır.

## M1 veri davranışı

M1 yalnızca çocuk takma adı, yeni profiller için `4_6`/`7_11` yaş bandı ve başlangıç avatar anahtarını cihazdaki SQLite veritabanında saklar. Kesin yaş ve doğum tarihi toplanmaz. Tam ad, e-posta, kamera, mikrofon, hassas konum, kişiler veya reklam kimliği kullanılmaz. Analytics, bulut, abonelik ve satın alma kapalıdır; backend yoktur.

Birincil hedef yaş 4–11’dir; 12+ MVP kapsamı dışındadır. 4–6 yaş yaklaşımı ebeveyn destekli/birlikte fırçalama, 7–11 yaş yaklaşımı daha bağımsız kullanımdır. Bu ürün kararı şu aşamada ayrı UI modu, ses sistemi veya ek veri toplama oluşturmaz.

Önceki sürümden kalan `6_8`/`9_10` değerleri migration uyumluluğu için geçici olarak cihazda okunabilir. Kesişen aralıklar nedeniyle uygulama bunları otomatik tahmin etmez; kullanıcıdan yalnızca yeni yaş bandını yeniden seçmesini ister ve seçimden sonra kaydı `4_6` veya `7_11` olarak günceller.

Takma ad log, analytics veya URL parametresine yazılmaz. Profil verisi application view model üzerinden UI’ya taşınır. M1’de veri yalnızca cihaz uygulama verisi temizlenerek tamamen silinebilir; kullanıcıya dönük silme/onay UX’i sonraki kapsamda tamamlanmalıdır.

## Ürün kırmızı çizgileri

Çocuk alanında reklam, fiyat, dış bağlantı ve satın alma CTA’sı bulunamaz. Veli işlemleri ileride ebeveyn kapısı arkasında olmalıdır. Uygulama teşhis koymaz veya fırçalama kalitesini tıbbi olarak ölçtüğünü iddia etmez.

M1 ebeveyn kapısı, her açılışta değişen basit bir toplama sorusudur. Tıbbi veya hukuki yaş doğrulaması değildir; çocuk işlemlerini azaltan bir UX bariyeridir. Cevap sesli okunmaz ve yanlış cevap cezalandırıcı dil kullanmaz.

## Sonraki değişiklikler

Yeni veri, permission, SDK veya retention davranışı ekleyen her milestone bu dosyayı ve mağaza beyanlarını güncellemelidir. Veli kontrollü profil/aile silme UX’i release öncesinde tamamlanmalıdır.
