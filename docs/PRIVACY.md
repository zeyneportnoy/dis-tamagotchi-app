# Gizlilik ve Çocuk Güvenliği

## M0 veri davranışı

M0 kişisel veri toplamaz. Kamera, mikrofon, hassas konum, kişiler, reklam kimliği, çocuk e-postası, doğum tarihi ve serbest metin kullanılmaz. Analytics, bulut, abonelik ve satın alma kapalıdır; backend yoktur.

SQLite yalnızca migration sürümü metadata’sını cihazda tutar. Profil veya ürün verisi tablosu yoktur. Loglara kişisel veri/payload yazma stratejisi yoktur.

## Ürün kırmızı çizgileri

Çocuk alanında reklam, fiyat, dış bağlantı ve satın alma CTA’sı bulunamaz. Veli işlemleri ileride ebeveyn kapısı arkasında olmalıdır. Uygulama teşhis koymaz veya fırçalama kalitesini tıbbi olarak ölçtüğünü iddia etmez.

## Sonraki değişiklikler

Yeni veri, permission, SDK veya retention davranışı ekleyen her milestone bu dosyayı ve mağaza beyanlarını güncellemelidir. Silme akışı ürün verisi M1’de başladığında tasarlanacaktır.
