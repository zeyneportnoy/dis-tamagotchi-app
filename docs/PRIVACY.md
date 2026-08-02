# Gizlilik ve Çocuk Güvenliği

## M1 veri davranışı

M1 yalnızca çocuk takma adı, `6_8`/`9_10` yaş bandı ve başlangıç avatar anahtarını cihazdaki SQLite veritabanında saklar. Tam ad, e-posta, doğum tarihi, kamera, mikrofon, hassas konum, kişiler veya reklam kimliği kullanılmaz. Analytics, bulut, abonelik ve satın alma kapalıdır; backend yoktur.

Takma ad log, analytics veya URL parametresine yazılmaz. Profil verisi application view model üzerinden UI’ya taşınır. M1’de veri yalnızca cihaz uygulama verisi temizlenerek tamamen silinebilir; kullanıcıya dönük silme/onay UX’i sonraki kapsamda tamamlanmalıdır.

## Ürün kırmızı çizgileri

Çocuk alanında reklam, fiyat, dış bağlantı ve satın alma CTA’sı bulunamaz. Veli işlemleri ileride ebeveyn kapısı arkasında olmalıdır. Uygulama teşhis koymaz veya fırçalama kalitesini tıbbi olarak ölçtüğünü iddia etmez.

M1 ebeveyn kapısı, her açılışta değişen basit bir toplama sorusudur. Tıbbi veya hukuki yaş doğrulaması değildir; çocuk işlemlerini azaltan bir UX bariyeridir. Cevap sesli okunmaz ve yanlış cevap cezalandırıcı dil kullanmaz.

## Sonraki değişiklikler

Yeni veri, permission, SDK veya retention davranışı ekleyen her milestone bu dosyayı ve mağaza beyanlarını güncellemelidir. Veli kontrollü profil/aile silme UX’i release öncesinde tamamlanmalıdır.
