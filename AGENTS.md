# Agent Çalışma Kuralları

- `Dis_Tamagotchi_CTO_Proje_Dosyasi.docx` bağlayıcı ürün/teknik kaynaktır.
- Milestone sırasını bozma; mevcut milestone dışındaki ürün özelliklerini ekleme.
- Çocuk güvenliği, veri minimizasyonu, offline-first davranış ve teknik sadelik önceliklidir.
- Kullanıcı metinlerini yalnızca `src/i18n` kaynaklarından getir.
- TypeScript strict kurallarını gevşetme ve gerekçesiz `any` kullanma.
- Domain kurallarını React componentlerine koyma; public index dışından feature deep-import yapma.
- Kamera, mikrofon, konum, kişi listesi, reklam kimliği veya çocuk e-postası toplama; doğum tarihi yalnızca yerel çocuk profilinde yaş bandını türetmek için saklanabilir.
- Secret/API anahtarı commit etme. `.env.example` yalnızca boş örnekler içerir.
- Her değişiklikte format, lint, typecheck ve ilgili testleri çalıştır; başarısız sonucu gizleme.
- Yeni kalıcı veri için migration ve upgrade/rollback testleri ekle.
- Teknik kararları tarihli olarak `docs/DECISIONS.md` içine kaydet.
