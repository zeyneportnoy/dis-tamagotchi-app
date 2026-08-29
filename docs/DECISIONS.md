# Teknik Kararlar

## 2026-08-29 — Yerel doğum tarihi ve dinamik yaş bandı

- Ürün kararı gereği çocuk doğum tarihi, veli tarafından native tarih seçiciyle alınan `YYYY-MM-DD` tarih-only değeri olarak yalnız yerel `child_profiles` kaydında saklanır; Supabase şeması ve senkronizasyon sözleşmesi genişletilmez.
- `age_band` kullanıcı seçimi değildir. Tam yaş ay ve gün dahil doğum tarihinden türetilir: 4–6 için `4_6`, 7–11 için `7_11`. Bu karar ADR-013 ve ADR-020 içindeki manuel yaş bandı / doğum tarihi alınmaması kararlarının ilgili kısmının yerine geçer.
- Repository profil yüklerken yaş bandını günün tarihiyle yeniden türetir ve yalnız değer değişmişse yerel profile yazar. Böylece yedinci doğum gününde mevcut karakter, XP, streak, inventory, kişiselleştirme, fırçalama geçmişi, ses ve hatırlatıcı verileri değiştirilmeden deneyim otomatik `7_11` olur.
- Migration 16 mevcut profillere nullable `date_of_birth` ekler. Exact tarihi bilinmeyen eski profiller veri kaybı olmadan onboarding tarih adımına yönlendirilir.

## 2026-08-09 — Yerel fırçalama hatırlatıcıları ve development Mood Lab

- Sabah ve akşam hatırlatıcıları, veli hesabı kimliğiyle ayrılmış AsyncStorage ayarları ve `expo-notifications` günlük local notification kayıtları olarak tutulur; bir backend alarm servisi kurulmaz.
- Bildirim izni uygulama açılışında değil, veli ilgili hatırlatıcı toggle'ını ilk kez açtığında istenir. Reddedilirse toggle kapalı kalır.
- Hatırlatıcılar `Ayarlar → Fırçalama Hatırlatıcıları` rotasında görünür; çocuk Home zil kısayolu veli kontrolünden sonra aynı rotaya gider.
- Character Mood Lab yalnız `__DEV__` çalışma zamanında menüde görünür ve rota düzeyinde korunur. Seçimleri yalnız component state'inde yaşar; profil, XP, inventory veya senkronizasyon verisi yazmaz.
- Character carousel mobil swipe için native yatay ScrollView snapping kullanır. Web wheel girdisinde `deltaX` ve `deltaY`, eşik ve cooldown ile tek karakterlik geçişe çevrilir; carousel dışındaki sayfa scroll'u engellenmez.

## 2026-08-02 — ADR-001: Expo SDK 57 toolchain

Expo `~57.0.9`, React Native `0.86.2`, React `19.2.3` ve TypeScript `~6.0.3` seçildi. Bunlar kurulum tarihinde resmi Expo template ve SDK uyumluluk tablosundaki güncel kararlı kombinasyondur. SDK 57’nin minimum Node 22.13 şartı `engines` ve CI’da sabitlendi; npm lockfile tek paket kaynağıdır.

## 2026-08-02 — ADR-002: Expo managed + Expo Router

Dosya tabanlı route grupları kullanılır. M0 native modülleri Expo Go ile uyumludur; development build zorunlu değildir. Sonraki milestone native entegrasyon eklerse bu karar yeniden değerlendirilir.

SDK 57 app config şemasına uygun olarak splash görünümü kök `splash` alanı yerine `expo-splash-screen` config plugin’i üzerinden tanımlanır.

## 2026-08-02 — ADR-003: Strict TypeScript ve düz katman sınırı

`strict`, `noUncheckedIndexedAccess` ve `noImplicitOverride` açıktır. `@/` yalnızca `src/` köküne gider. Domain/Application katmanları ürün kuralı başladığında eklenecek; boş klasör üretilmedi.

## 2026-08-02 — ADR-004: Türkçe-first i18next

i18next/react-i18next seçildi. Componentlerde kullanıcı cümlesi tutulmaz; Türkçe tek M0 kaynak dili, Türkçe fallback’tir. Dil seçimi ve kalıcılığı onboarding milestone’una bırakıldı.

## 2026-08-02 — ADR-005: SQLite migration bootstrap

`expo-sqlite` async API kullanılır. Runner yalnızca `schema_migrations` metadata tablosunu ve `SELECT 1` health-check’i kurar. M0 migration listesi boştur; ürün tabloları M1’e aittir. Testlerde platform SQLite yerine runner sözleşmesi ve health-check izole test edilir; geçici native DB repository testleri ürün tablolarıyla M1’de başlar.

## 2026-08-02 — ADR-006: Entegrasyonlar varsayılan kapalı

Cloud, analytics, subscriptions ve purchases env değerleri yalnızca tam `true` olduğunda açılır. M0’da adapter/SDK/backend kurulmaz; yanlışlıkla veri veya ağ trafiği oluşmaz.

## 2026-08-02 — ADR-007: CI kapsamı

Her PR/main push’ta npm clean install, format, lint, typecheck, Jest, DB health testi, iOS/Android JavaScript bundle export smoke, critical dependency audit ve Gitleaks çalışır. Native cloud build maliyet/credential gerektirdiği için PR kapısında yoktur; release aşamasında EAS preview/release workflow eklenir. Web ürün hedefi değildir ve `expo-sqlite` web WASM yapılandırması M0 kapsamına alınmamıştır.

## 2026-08-02 — ADR-008: Tasarım ve erişilebilirlik tabanı

Belgedeki Navy, Teal, Indigo, Off-white, Success, Warning ve Danger token’ları kaynak doğruluğudur. Temel child CTA minimum 48 dp, accessibility role/label içerir. Danger çocuk cezası için kullanılmaz.

## 2026-08-02 — ADR-009: Transitif audit bulgusu kabulü

`npm audit --audit-level=critical` geçer; 11 moderate bulgu Expo CLI’nin `xcode → uuid@7` geliştirme zincirindedir. `npm audit fix --force` güncel SDK ile uyumsuz eski Expo paketleri önerdiği için uygulanmadı. Uygulama runtime’ında doğrudan `uuid` kullanımı yoktur; Expo upstream güncellemesi izlenecektir.

## 2026-08-02 — ADR-010: Node 22 geliştirme ve CI standardı

Projenin tekrar üretilebilir çalışma standardı Node 22’dir. `.nvmrc` ana sürümü `22` olarak sabitler, `package.json` en az Node 22.13 ister ve GitHub Actions Node 22.13 kullanır. İlk kurulumda araç ortamının Node 24 çalıştırması bir ürün hatası değildir; bağımlılık kurulumu ve CI için desteklenen ortak taban Node 22.13+ olarak belirlenmiştir.

## 2026-08-02 — ADR-011: npm 10.9.2 ve optional dependency lockfile standardı

Yerel lockfile üretimi ve GitHub Actions kurulumu Node 22.13.0 ile gelen kararlı npm 10.9.2 sürümünde eşitlenir. `packageManager` alanı exact `npm@10.9.2` değerini taşır; CI `npm ci` öncesinde aynı sürümü kurar. Platforma bağlı WASI/`@emnapi` transitif kayıtlarının lockfile’a eksiksiz yazılması için install ve clean-install komutlarında `--include=optional` kullanılır. `@emnapi` paketleri doğrudan uygulama bağımlılığı değildir.

## 2026-08-02 — ADR-012: M1 aile/profil şeması ve aktif profil

Migration 1, bağlayıcı `families` ve `child_profiles` tablolarına ek olarak tek satırlı `active_profile` uygulama durumu tablosu kurar. Böylece aktif seçim AsyncStorage gibi ikinci bir kaynak yerine aynı transaction destekli SQLite kaynağında kalır. Profil FK’sı `ON DELETE CASCADE`, aktif seçim FK’sı `ON DELETE SET NULL` kullanır. Profil sayısına uygulama limiti konmaz ve en az üç profil desteklenir. Takma ad kimlik değildir; aynı ailede tekrar edebilir.

## 2026-08-02 — ADR-013: Takma ad ve onboarding veri minimizasyonu

Takma ad trim sonrası 1–20 karakterdir; satır sonu ve tab karakterleri reddedilir. Bu sınır kısa çocuk UI’sını korur ve gereksiz serbest metni azaltır. Yeni profil yaşı yalnızca `4_6` veya `7_11`, başlangıç seçimi üç kararlı avatar anahtarından biridir. Kesin yaş, tam ad, e-posta, doğum tarihi veya permission istenmez. Zod application/repository sınırında doğrulama yapar.

## 2026-08-02 — ADR-014: Repository, view model ve SQLite test stratejisi

Domain repository arayüzleri framework bağımsızdır; Expo SQLite implementasyonları data katmanındadır. Route’lar database entity yerine `ChildProfileViewModel` alır. Migration ve repository testleri Node 22’nin yerleşik `node:sqlite` motorunu ince bir test adaptörüyle kullanır; bu API Node’da experimental uyarısı verse de gerçek SQLite constraint/transaction davranışını mock’suz doğrular ve uygulama bundle’ına girmez.

## 2026-08-02 — ADR-015: M1 ebeveyn kapısı sınırı

Çocuk alanından veli placeholder’ına geçişte her mount’ta değişen, iki küçük pozitif sayıdan oluşan toplama sorusu kullanılır. Cevap seslendirilmez; yanlış cevap suçlayıcı olmayan Türkçe fallback gösterir. Bu kapı yaş veya kimlik doğrulaması değildir ve doğrudan deep-link güvenlik sınırı olarak kabul edilmez.

## 2026-08-02 — ADR-016: Route geçişlerinde mutlak yollar

Expo Router ekran geçişleri uygulama kökünden başlayan mutlak yollar kullanır. iOS Simulator smoke testi, onboarding içindeki göreli `./...` ve grup ekranlarındaki `../...` yolların Expo Go geliştirme bağlantısı altında yanlış route üretebildiğini gösterdi. Mutlak yollar navigasyonu geliştirme ve üretim bağlantı bağlamından bağımsız kılar; Welcome geçişi component testiyle korunur.

## 2026-08-02 — ADR-017: Secret scan için en düşük GitHub token izinleri

Quality workflow’unun varsayılan `github.token` değeri yalnızca `contents: read` ve `pull-requests: read` izinlerini alır. Gitleaks pull request commit listesini okuyabilmek için ikinci izne ihtiyaç duyar; yazma izni, kişisel token veya repository secret kullanılmaz. Action’ın Node 20 runtime deprecation mesajı bu API 403 hatasının nedeni değildir ve proje Node/Expo standardını değiştirmez.

## 2026-08-02 — ADR-018: PR secret scan için tam Git geçmişi

Quality workflow’undaki `actions/checkout@v4`, `fetch-depth: 0` ile tüm Git geçmişini indirir. Gitleaks böylece pull request taban ve baş commit’leri arasındaki aralığı çözebilir; sığ checkout nedeniyle kısmi tarama yapılmaz. Secret scan, minimum salt-okunur izinler ve varsayılan `github.token` ile çalışmaya devam eder.

## 2026-08-02 — ADR-019: Çocuk takma adları benzersiz değildir

Takma ad yalnızca çocuk arayüzünde kullanılan, veri minimizasyonuna uygun bir hitap değeridir ve profil kimliği değildir. Aynı ailede birden fazla çocuk aynı takma adı kullanabilir. Geçmiş kurulumları ve mevcut verileri korumak için Migration 1 değiştirilmez; ileri yönlü Migration 2 yalnızca `child_profiles_family_nickname_uq` index’ini kaldırır.

## 2026-08-08 — ADR-020: Hedef yaş 4–11 ve açık legacy yeniden seçimi

Birincil hedef 4–11, yeni yaş bantları `4_6` ve `7_11` olarak belirlenmiştir; 12+ MVP kapsamı dışındadır. 4–6 yaklaşımı ebeveyn destekli/birlikte fırçalama, 7–11 yaklaşımı daha bağımsız kullanımdır. Ayrı UI modu, ses sistemi ve oyun mekaniği bu düzeltmenin kapsamında değildir.

Eski `6_8` değeri iki yeni bantla kesiştiği için legacy değerler otomatik eşlenmez. Migration 3 mevcut profil ve aktif seçim kayıtlarını koruyarak SQLite CHECK kuralına yeni değerleri ekler ve legacy değerleri geçici okuma uyumluluğu için tutar. Domain create/update validasyonu yalnızca yeni değerleri kabul eder. Legacy aktif profil Child Home’dan önce kısa yeniden seçim route’una gider.

## 2026-08-08 — ADR-021: Expo SDK 57 patch uyumluluğu

Zorunlu son doğrulamada Expo Doctor’ın güncel SDK 57 uyumluluk setiyle eşleşmek için yalnızca patch sürümleri güncellendi: Expo `~57.0.11`, Expo Constants `~57.0.9`, Expo Linking `~57.0.5` ve Expo Router `~57.0.11`. Node, npm, React Native ve Expo SDK major standardı değişmedi; sürümler `expo install` ve npm lockfile üzerinden üretildi.

## 2026-08-08 — ADR-022: M2 fırçalama odaklı marka ve navigasyon

Child Home genel pet bakımı yerine yalnızca diş fırçalama rutinini merkezine alır. Marka token’ları `#6C5CE7` primary, `#FF6B81` secondary, `#42D6C5` accent, `#FFD166` highlight, `#263238` text ve `#FFF9F5` background olarak güncellendi. Ana eylem en az 48 dp dokunma alanını korur. Ana Sayfa tam işlevli, Görevler/Koleksiyon/Profil ise sonraki kapsamı önden uygulamadan gerçek placeholder route’lardır.

## 2026-08-08 — ADR-023: Profil karakteri ve minimal fırçalama kalıcılığı

Seçili karakter için yeni ve tekrarlı bir alan açılmaz; M1’deki `child_profiles.avatar_id` profil bazında kaynak doğruluğu olmaya devam eder. Migration 4, mevcut profil verilerini değiştirmeden `profile_progress` tablosunu ekler. Sabah/akşam günlük bayrakları, temel seri sayacı ve son etkileşim/fırçalama zamanları profil FK’sı altında local-first saklanır. Gün değişiminde günlük bayraklar sıfırlanır; M2 seri hesaplamaz, timer başlatmaz, XP veya ödül dağıtmaz.

## 2026-08-08 — ADR-024: M2 transitif audit bulguları

`npm audit --audit-level=critical` sıfır critical bulguyla geçer. Expo/Metro araç zincirindeki `image-size` için 15 high ve `xcode → uuid` için 8 moderate transitif bulgu raporlanır. npm’in sunduğu zorunlu çözüm Expo 53’e breaking downgrade yaptığı için `--force` uygulanmaz; SDK 57 ile uyumlu upstream paket güncellemesi izlenir. Uygulama bu paketlerle kullanıcı girdili görsel dosya ayrıştırmaz.

## 2026-08-08 — ADR-025: Timestamp tabanlı tek brushing timer

4–6 ve 7–11 profilleri aynı 120 saniyelik timer domain’ini kullanır; yalnız yardımcı metin yaş bandına göre uyarlanır. Dört bölüm sabit 30 saniyedir. Timer render/tick saymak yerine başlangıç timestamp’i ve birikmiş pause süresinden snapshot üretir. Interval yalnız görünümü yeniler, AppState dönüşü güncel zamanı okur. Zustand eklenmedi; tek route’a ait transient state için React state ve saf domain fonksiyonları daha küçük yüzey oluşturur.

## 2026-08-08 — ADR-026: Yalnız tamamlanmış seansların transaction'lı kalıcılığı

Migration 5'teki `brushing_sessions`, profile `ON DELETE CASCADE` ile bağlıdır. Erken çıkış hiçbir completed kayıt üretmez. Başarılı completion; session insert, yerel gün/period görevi ve son etkileşim/fırçalama timestamp'lerini tek transaction'da yazar. Period 04:00–15:59 morning, 16:00–03:59 evening kabul edilir. Aynı period içinde ek seanslar ayrı geçmiş kaydı oluşturabilir ancak görev bayrağı true kalır. XP, ödül ve gerçek streak hesabı M4'e bırakılmıştır.

## 2026-08-08 — ADR-027: Child UI görsel hiyerarşisi ve navigasyon standardı

Child alanı mevcut marka paletini koruyan yumuşak, yuvarlak ve yüksek kontrastlı “Candy Tech” görsel dilinde sadeleştirilir. Home'da karakter birincil odak, fırçalama tek baskın eylem, sabah/akşam görevleri kompakt durum kartlarıdır. Profil değiştirme büyük form yerine erişilebilir başlık tetikleyicisi ve modal seçim yüzeyi kullanır; aynı family use-case'lerini çağırır ve veri davranışını değiştirmez.

Tab ikonları yeni bir bağımlılık veya görsel asset eklemeden, anlamlı platform metin sembolleriyle sunulur. Onboarding alt ekranlarında native Stack başlığı içindeki ortak en az 48 dp `BackButton`, bağımsız detay ekranlarında aynı component kullanılır. Tab köklerinde geri butonu gösterilmez; brushing erken çıkışında mevcut onay davranışı korunur. Bu çalışma M1–M3 domain, migration, timer ve kalıcılık kurallarını değiştirmez.

## 2026-08-08 — ADR-028: Brushing kadran sırası ve görsel yönlendirme

Mevcut timestamp tabanlı 4 × 30 saniyelik timer korunur; segment indeksleri sunum katmanında sırasıyla `Sağ üst`, `Sol üst`, `Sağ alt` ve `Sol alt` ağız bölgelerine eşlenir. Her segmentte dört parçalı ağız göstergesinin ilgili kadranı renk ve çerçeveyle birlikte vurgulanır. Yardımcı metin 4–6 yaşta daha somut, 7–11 yaşta yüzey terminolojisini kullanan tek bir yaş-bandı koşuluyla seçilir. Session kaydı, pause/resume ve sabah/akşam kalıcılığı değiştirilmez.

## 2026-08-08 — ADR-029: Veli auth ve local-first cloud ownership

Hesapsız kullanım kaldırılır; çocuk kendi hesabını oluşturmaz. Supabase Auth doğrulanmış veli kimliği, Postgres/RLS cloud ownership ve profile recovery foundation sağlar. SQLite hızlı/offline child ve brushing çalışma kaynağı olarak kalır. Local child UUID’si cloud primary key olarak yeniden kullanılır; bu duplicate profil riskini azaltır ve legacy brushing FK’larını korur. Sync başarısızlığı local profili silmez.

Logout local çocuk verisini otomatik silmez fakat auth guard child route erişimini kapatır. Shared-device gizlilik riski nedeniyle bu karar parent gate arkasında açık logout UX’iyle uygulanır. Gerçek hesap silme, service-role anahtarını mobil client’a koymayan server-side endpoint tamamlanana kadar sahte başarı göstermez.

## 2026-08-09 — ADR-030: Yerel profil ownership izolasyonu

Supabase RLS tek başına cihazdaki SQLite cache’ini izole etmez. Bu nedenle profil oluşturma, listeleme, aktif profil seçimi, güncelleme, arşivleme ve silme işlemleri her çağrıda aktif doğrulanmış veli kimliğiyle sınırlanır. Migration 7, aktif profil seçimini veli kimliğiyle anahtarlanan `active_parent_profile` tablosuna taşır. `parent_auth_user_id` değeri olmayan `legacy_local` kayıtlar otomatik gösterilmez; yalnızca açık claim akışıyla mevcut veliye bağlanır. Başka bir veliye bağlı `pending` veya `failed` kayıtlar claim kapsamına alınmaz.

## 2026-08-09 — ADR-031: M4 deterministic reward ekonomisi ve transaction sınırı

Karakter ilerlemesi ikinci bir kaynak oluşturmaz; mevcut `profile_progress` satırı `total_xp`, `level` ve `mood` ile genişletilir. Her tamamlanmış benzersiz seans 10 XP, günün ilgili ana slotunun ilk tamamlanması ek 10 XP ve en fazla 5 mood verir. Seviyeler 0/60/140 XP eşiklerinde 1/2/3'tür. Kozmetik katalog merkezi ve deterministiktir: Yumuşak Atkı 0, Işıltılı Taç 40, Yıldız Gözlük 80, Gökkuşağı Pelerini 140 XP.

Migration 8, immutable `local_day_key` taşıyan `daily_progress`, profil bazlı `inventory_items` ve `brushing_sessions.reward_granted_at` sonuç snapshot alanlarını ekler. Session insert, idempotency kontrolü, XP/mood, daily slot, full-day streak ve item unlock aynı SQLite transaction'ındadır. Aynı session kimliği tekrar okunduğunda saklanan sonuç snapshot'ı döner; yeni ödül üretilmez. Inventory ve reward sorguları aktif veli ownership kontrolünü korur.

## 2026-08-09 — ADR-032: Home görev kartlarında açık slot niyeti

Home'daki sabah ve akşam kartları, aynı brushing route'una sırasıyla `morning` ve `evening` slot niyetiyle gider; büyük “Fırçalayalım!” eylemi saatten slot belirleyen mevcut davranışını korur. Her iki giriş de tek session completion transaction'ını kullanır; paralel ödül veya ilerleme sistemi yoktur.

Home her odaklandığında güncel günün `daily_progress` kaydını yeniden okur. Böylece tamamlanma tiki, metni ve full-day sonrası seri değeri uygulama yeniden açıldığında ve brushing'den dönüldüğünde kalıcı kaynaktan gösterilir. Aynı slotun tekrarı session geçmişine izin verir fakat daily slot bonusunu, full-day geçişini veya tiki ikinci kez üretmez.

## 2026-08-09 — ADR-033: Character-first M4 sunumu ve merkezi rounded typography

M4 ilerleme döngüsünün ana görseli görev listesi değil, profilin kalıcı `avatar_id` değeriyle seçilen bebek diştir. Başlangıç kataloğu sekiz diş kişiliğine genişletilir. Aynı ortak avatar renderer'ı level 1/2/3 için gövde oranı, ifade alanı, parlaklık ve gelişim detaylarını; inventory `equipped` kaydı için aksesuar katmanını Home, Collection ve sonuç yüzeylerinde tutarlı sunar. XP, inventory ve session kuralları değiştirilmez.

Yeni font paketi ve runtime font yükleme hatası eklememek için merkezi typography token'ları iOS'ta `Avenir Next Rounded`/`Avenir Next`, Android'de `sans-serif-rounded`/`sans-serif` kullanır. Bu platform fontları Türkçe glifleri destekler; başlık/ödül metni ile body metni arasındaki karakter farkı ekran bazlı rastgele font ataması olmadan korunur.

## 2026-08-09 — ADR-034: Yumurta başlangıçlı görsel karakter yaşam döngüsü

Yeni çocuk profili, seçtiği diş morfolojisini korur fakat Home'da 0 XP iken doğrudan diş göstermez; sevimli diş yumurtasıyla başlar. İlk fırçalama sırasında yumurta çatlama görünümüne geçer ve başarılı ilk bakımın mevcut ödül transaction'ı 20 XP ürettiğinde seçilen karakterin bebek formu görünür. Görsel aşamalar mevcut kalıcı `total_xp` değerinden deterministik türetilir: yumurta 0–19, bebek 20–59, büyüyen 60–139, gelişmiş 140–239 ve güçlü diş 240+ XP. Çatlama yalnızca ilk aktif brushing seansının geçici sunum durumudur; erken çıkış kalıcı büyüme yaratmaz.

Yeni tablo veya ikinci bir ilerleme kaynağı eklenmez. M4'ün session idempotency, daily slot, XP, inventory ve SQLite transaction kuralları kaynak doğruluğu olarak kalır; dolayısıyla uygulama yeniden açıldığında yaşam aşaması aynı XP'den geri yüklenir.

## 2026-08-08 — Auth e-posta bağlantıları kalıcı custom scheme ve PKCE kullanır

- Doğrulama ve şifre yenileme yönlendirmeleri ortam-dependent Expo Go URL'si yerine `distamagotchi://` uygulama şemasını kullanır.
- Mobil auth callback'i PKCE `code` değerini Supabase oturumuna çevirir; erişim veya yenileme token'ları loglanmaz ya da uygulama koduna yazılmaz.
- Custom scheme'in işletim sistemine kaydolması gerektiğinden gerçek e-posta bağlantısı development/production native build üzerinde doğrulanır; Expo Go bu test için yeterli değildir.
- Aynı cihazda birden fazla signup/resend PKCE akışının verifier'ı karışmaması için Supabase istemcisinin `appendPkceFlowIdToRedirects` seçeneği açıktır. Callback'teki `sb_flow_id` yalnızca doğru yerel verifier slotunu seçmek için kullanılır; token veya verifier loglanmaz.
- Password recovery deep link'i de callback `code` ve `sb_flow_id` değerlerini aynı PKCE session sınırında değiştirir; doğrulanmış recovery session oluşmadan yeni şifre yazılamaz.

## 2026-08-09 — Fırçalama bölge geçişlerinde isteğe bağlı Türkçe ses (yerine geçildi)

- Görsel bölge adı ve yaşa uyarlanmış yardımcı metinler korunur; ses bunların yerine geçmez.
- Her yeni 30 saniyelik bölge başladığında Türkçe ses ve `expo-haptics` ile hafif geri bildirim bir kez tetiklenir. Cihaz içi TTS tercihi ADR-040 ile yerel kayıtlı ses lehine kaldırılmıştır.
- Tercih varsayılan olarak açıktır ve yalnızca cihazdaki AsyncStorage içinde saklanır; çocuk veya hesap verisi olarak buluta gönderilmez.
- Ses sunum katmanında bölüm indeksini gözlemler. Timer, seans tamamlama, XP, ödül ve idempotency kuralları değiştirilmez.

## 2026-08-09 — M4 brushing motion, completion SFX and growth pacing

Brushing animation uses character-specific visible-body bounds plus growth-stage insets rather than one fixed path. Three six-point motion patterns rotate without immediate repetition; the brush head and foam share the same transformed container. This keeps contact aligned across all eight characters and egg, cracking, baby, growing and developed silhouettes without changing timer/session logic.

Successful completion uses a four-item locally generated WAV SFX pool (rise/sparkle, ta-da, ding/chime and level-up). Selection avoids the previously played index, and only the persisted successful result triggers playback; partial/abandoned sessions remain silent. Quadrant voice guidance is unchanged.

Reward amounts remain idempotent and unchanged: a completed session grants 10 XP, with an additional 10 XP only for that day's first completion of its morning/evening slot. Visual growth thresholds are now 0/60/120/320/640 XP for egg/cracking/baby/growing/developed. At two first-slot completions per day (40 XP/day), stages arrive at approximately days 1.5, 3, 8 and 16. Existing XP, inventory and equipped-item rows are not rewritten. XP continues increasing after 640, so final-stage profiles retain mood, streak, collection and future reward progression.

Existing unlocked inventory is preserved; future Star Glasses and Rainbow Cape unlocks are paced at 200 and 800 XP. The 800 XP cape deliberately provides a post-developed-stage collection goal.

Character selection uses one horizontally scrolling native `ScrollView` with measured card width, `snapToInterval`, fast deceleration and centered content insets. Touch/trackpad dragging, arrow controls and thumbnail controls all write the same onboarding draft `avatarId`; only the carousel region owns the gesture. Partial and fast offsets resolve to the nearest clamped one of eight indexes.

Completion SFX expands to six deliberately different local synth profiles: fanfare, bell rise, metallic chime, pulse-wave arcade, percussive marimba and magic sparkle. Every ID imports a distinct WAV asset, and an in-memory two-item history excludes both recent selections from the next runtime random pool.

Profile onboarding treats the successful local SQLite `createProfile` transaction as its offline-first completion boundary. A subsequent cloud claim/sync failure must not strand the child on the summary screen or cause duplicate local profiles on repeated taps; sync remains retryable after navigation. The create control is disabled only during an active save and reports incomplete draft state rather than becoming silently untappable.

## 2026-08-15 — Growth estimates use guaranteed session XP

Home shows exact XP remaining and labels brushing count as approximate. The estimate uses the
guaranteed base session XP rather than the conditional first-slot bonus, so “one brushing” always
means the next completed session reaches the stage threshold. Evolution playback is one-way and
holds its final stage; egg-to-cracking includes intermediate crack frames instead of looping assets.

## 2026-08-15 — Countdown ticks use absolute timer boundaries

Brushing tick playback has no repeating interval and is not driven by React render cadence. Each
one-shot timeout targets the next absolute 1000 ms boundary derived from the brushing timer's start
and accumulated pause duration, using a monotonic deadline to measure callback lateness. Late or
voice-muted boundaries are dropped rather than replayed. Two preloaded players alternate so
playback begins without a seek wait while the inactive player rewinds.

## 2026-08-15 — Accessories equip by persistent visual slot

Collection uses tap-to-equip rather than drag-and-drop. Inventory keeps existing item keys and
unlock history, while migration 12 classifies each row as head, face, front or effect and enforces
at most one equipped item per profile and slot. Selecting an item replaces only its own slot;

## 2026-08-15 — Koleksiyon oda ve ödül kişiselleştirmesine odaklanır

Koleksiyon bir karakter giydirme sistemi değildir. Kalıcı seçim alanları `wearable`,
`background`, `decor`, `effect` ve `brush` olarak ayrılır. Karakter üzerinde yalnızca diş
formuna oturan tek bir küçük aksesuar gösterilebilir; ana ödül ekonomisi oda, arka plan,
efekt ve fırça görünümlerine dayanır. Migration 13 eski inventory anahtarlarını ve
kilit açma geçmişini koruyarak yeni kategorilere taşır.

## 2026-08-15 — Premium çocuk UI tipografisi merkezileştirilir

Fredoka ve Nunito Sans yerine Latin Extended/Türkçe gliflerini içeren Baloo 2 display/CTA,
Manrope ise body/UI fontu olarak kullanılır. Boyut, satır yüksekliği ve font ailesi
`design-system/theme` token'larından gelir; ekranlarda font ailesi sabit metin olarak tekrar edilmez.
Koleksiyon kataloğu beş kategoride sekizer ödüle genişler. Migration 14 mevcut profillere
birer başlangıç arka planı, efekti ve fırçası ekler; mevcut seçimleri ezmez.
effect accessories render behind the character and all other slots use fixed, face-safe anchors.

## 2026-08-15 — Brushing bölge yönlendirmeleri yerel kayıtlı sestir

Brushing'in 0, 30, 60 ve 90. saniye yönlendirmeleri cihaz TTS'i yerine sırasıyla
`right-upper`, `left-upper`, `right-lower` ve `left-lower` adlı bundle içi MP3 kayıtlarını
çalar. Böylece ses karakteri cihaz sesine bağlı değildir ve internet olmadan çalışır.
Görsel quadrant indeksi ile ses kaynağı aynı sabit sıralamayı kullanır; her segment
bir oturumda en fazla bir kez anons edilir. Kullanıcı tercihi, tick ducking, timer, completion
jingle, session, XP ve ödül davranışları değiştirilmez.

## 2026-08-16 — Sesli rehber veliye göre Gökçe, Samet veya Kapalı olarak saklanır

Sesli rehber tercihi aktif Supabase veli kullanıcı kimliğiyle adlandırılmış yerel
AsyncStorage anahtarında tutulur; farklı veli hesapları birbirinin tercihini devralmaz.
Varsayılan profil Gökçe'dir. Eski global kapalı tercihi ilk okumada `off` olarak taşınır;
kullanıcının sessiz tercihi otomatik açılmaz.

Gökçe ve Samet'in her biri 0/30/60/90 sınırlarına bağlı dört farklı bundle içi
ses kaydı kullanır. Samet'in kaynak MP4 dosyaları tek AAC ses track'i içerdiğinden projeye
video olarak değil ses-only M4A asset olarak alınır. Cihaz TTS'i veya ağ fallback'i yoktur.

## 2026-08-16 — Parent araç ekranları tek sabit header geometrisi kullanır

Veli Hesabı, Ayarlar/Sesli Rehber, Fırçalama Hatırlatıcıları ve geliştirici Mood Lab
ekranları `Screen` safe area içinde aynı `ScreenHeader` bileşenini kullanır. Header yüksekliği
56 dp, sol kontrol ve sağ denge alanı 48 dp'dir. Ekrana özel absolute `top` veya ek
`paddingTop` kullanılmaz; bu sayede route geçişlerinde chevron ve başlık baseline'ı değişmez.

## 2026-08-16 — Mood ifadeleri karaktere özel yerel asset ve merkezi durum kuralı kullanır

Neutral, happy, proud, sleepy, waiting, sad ve crying ifadeleri sekiz karakterin beş
gelişim evresinin her biri için ayrı, şeffaf ve bundle içi görsellerdir (toplam 280 kombinasyon).
Ortak emoji/yüz katmanı kullanılmaz;
göz, ağız, kaş, yanak, gözyaşı ve duruş karakterin kendi görseline işlenir.
`dirty` durumu kaldırılmış, yerine suçlayıcı olmayan `waiting` kullanılmıştır.
Yumurta evresinde de karaktere özel desen ve daha sade, bebeksi bir yüz korunur; çatlama
evresinde ifade kabuk ve çatlak geometrisiyle birlikte çizilir.

Home mood kararı React bileşeninden ayrı bir domain fonksiyonudur. Kalıcı günlük ilerleme,
yerel saat ve son fırçalama zamanından neutral/waiting/happy/proud/sleepy/sad sonucunu
üretir. Crying aynı gün cezası değildir; yalnızca en az 48 saatlik uzun ilgisizlikte
kullanılır. Completion, tam gün/seri/ödül/evre başarısında proud, normal başarıda
happy gösterir.

## 2026-08-16 — Takma ad ses kişiselleştirmesi açık rıza tercihi ve güvenli proxy gerektirir

“Takma adını söylesin” varsayılan olarak kapalıdır ve veli ile aktif çocuk profilinin birleşik
kimliği altında yerel olarak saklanır. Yalnız Gökçe profilinin 0 ve 60 saniye cue'ları
kişiselleştirmeye adaydır; Samet kendi izinli bundle kayıtlarını kullanır, Kapalı seçeneği sessizdir.

Mobil istemci ElevenLabs anahtarı taşımaz ve servisi doğrudan çağırmaz. Üretim, Supabase oturum
token'ıyla yetkilendirilen güvenilir bir proxy'nin kısa ömürlü indirme URL'sini döndürmesiyle
yapılır. Cache kimliği çocuk profil ID'si, normalize takma ad, ses profili, cue ve model/ses
sürümünü birlikte hash'ler. Cache ya da ağ yoksa brushing beklemeden bundle içi Gökçe kaydına
döner. Proxy kurulmadan istemci kişiselleştirmeyi başarılı olmuş gibi göstermez.

## 2026-08-16 — Karakter render alanı animasyon güvenlik payı taşır

Karakter PNG'leri kendi doğal oranında `contain` ile çizilir ve rastgele karakter bazlı scale/offset
uygulanmaz. Ortak `characterSafeViewport`, büyük ve hero görünümlerinde idle zıplama, tilt, scale,
gözyaşı, effect ve küçük baş aksesuarları için yatay/dikey hareket payını tanımlar. Artwork, mood,
effect ve wearable katmanları aynı transform grubunda birleşir; bu grubun çevresindeki şeffaf
viewport gerçek çizim boyutunu değiştirmeden en geniş animasyon karesini korur. 8 karakter × 5 evre
× 7 mood için alfa sınırı programatik kontrol edilir; kaynak görsellerde en az 24 px şeffaf pay
korunur. `CharacterAvatar` ve animasyon katmanı taşmayı kesmez; sahne kartları karakter boyutunu
küçültmek yerine bu güvenli viewport yüksekliğini ayırır. Home, collection, brushing, completion,
onboarding ve Mood Lab aynı render bileşenini kullanır.

# 2026-08-21 — Veli hesabından aktif çocuk seçimi

- Veli Hesabındaki mevcut çocuk profilleri, yeni profil oluşturma akışından ayrı tam kart seçimleri olarak sunulur.
- Seçim mevcut `active_parent_profile` kaydına yazılır; böylece parent isolation korunur ve uygulama yeniden başlatıldığında son seçim geri yüklenir.
- Child-specific ekranlar profil kimliğini aktif profilden alır. Bellekte tutulan Profil ve Koleksiyon sekmeleri odaklandıklarında aktif profili ve ona bağlı verileri yeniden okur.

# 2026-08-21 — Fırçalama temas koordinatları

- Fırçalama path'i ortak yaklaşık dikdörtgen yerine 8 karakter × 5 lifecycle asset'inin alfa siluetinden güvenli inset ile örneklenen altı temas anchor'ını kullanır.
- Path koordinatı fırça grubunun sol üstünü değil bristle temas ucunu temsil eder; foam aynı hareketli grubun temas ucuna bağlıdır.
- Brushing sahnesinde karakter idle transform'u kapatılır; karakter silueti ve temas path'i aynı sabit koordinat sisteminde kalır. Diğer karakter ekranlarının animasyonu değişmez.

# 2026-08-21 — Veli kartından profil tamamlama yönlendirmesi

- Veli Hesabında bir çocuk kartı seçildiğinde aktif profil kalıcılaştırılır; tamamlanmış profil doğrudan Child Home'a gider.
- Eksik mevcut profil, hedef `profileId` ve yalnız kendi tamamlanmış alanlarıyla ortak onboarding draft context'ine alınır ve ilk eksik adıma yönlendirilir.
- Mevcut profil tamamlama adımları yeni profil oluşturmaz; yalnız hedef profili `updateProfile` ile günceller ve tamamlanınca Child Home'a geçer.

# 2026-08-21 — Oda yerleşimleri child-specific ve DEV ekipmanı production inventory'den ayrıdır

- Oda objesi ve basit baş aksesuarı konumları, sahne boyutundan bağımsız normalize `x/y`
  koordinatları ve kontrollü scale ile child profile kimliği altında sürümlü yerel state olarak saklanır.
- DEV ortamında katalog sunumu tüm desteklenen öğeleri kilitsiz gösterir; DEV ekipman seçimi ayrı
  override alanına yazılır ve `inventory_items` unlock/equipped kayıtlarına dokunmaz. Production
  ortamı mevcut inventory sonucunu aynen kullanır.
- Gözlük ve maskeler katalog verisinden silinmez; hassas yüz hizası gerektirdiği için customization
  sunumunda filtrelenir. Home sahnesinde drag responder yalnız açık “Odamı Düzenle” modunda etkinleşir.

# 2026-08-21 — Oda malzemeleri arka plan temasına göre ayrı sahne varlıklarıdır

- Altı desteklenen arka planın her biri beş şeffaf oda malzemesine sahiptir; malzemeler arka plan
  görseline birleştirilmez ve kart yüzeyi olmadan karakterin arkasındaki oda katmanında render edilir.
- Malzeme seçimi ve normalize yerleşimleri mevcut child-specific customization anahtarında saklanır.
  Collection önizlemesi ile Home aynı kaydı okur.
- Yeni malzeme kataloğu production reward sırasına kayıt eklemez. Kilit durumu mevcut beş dekor
  ödülüne bağlıdır; yalnız DEV sunumu tüm tematik varyantları seçilebilir yapar.

# 2026-08-27 — React Native iOS bundle script yolu tırnak içinde çalıştırılır

- Xcode build phase, React Native script yolunu komut ikamesiyle doğrudan çalıştırmak yerine önce
  `RN_XCODE_SCRIPT` değişkenine çözer ve tırnak içinde çağırır. Böylece proje dizinindeki boşluklar
  native Debug/Release derlemelerini bozmaz; uygulama davranışı ve feature kodu değişmez.

# 2026-08-28 — İlk profil onboarding’i mevcut yerel tercihlere bağlanır

- Yeni profil akışı karakter seçiminden sonra mevcut parent-scoped sabah/akşam reminder servisini
  ve Gökçe/Samet/Kapalı voice preference anahtarını kullanır; ikinci bir ayar veya bildirim sistemi
  oluşturmaz. Profilin varlığı tamamlanmış onboarding için mevcut offline-first kaynak doğruluğudur.
- Migration 15 her yeni çocuk profiline bağlı iki altı aylık dentist anchor’ını yerel SQLite’ta
  saklar. Altı aylık ve on iki aylık anchor’lar yıllık tekrar ederek altı aylık döngüyü oluşturur;
  bildirim izni yoksa tarihler korunur ve profil oluşturma başarısız sayılmaz.
- Dentist notification içeriği yalnız yerel takma adı kullanır. Bu onboarding değişikliği yeni
  Supabase alanı, senkronizasyon şeması veya çocuk verisi toplama alanı eklemez.

# 2026-08-29 — Ödül biriminin kullanıcıya görünen adı sunum katmanında merkezidir

- Kullanıcıya görünen ödül birimi adı `common.rewardCurrencyName` i18n kaynağından “Mine” olarak
  çözülür. Home, brushing sonucu/ilerlemesi ve Collection metinleri bu ortak etiketi kullanır.
- Domain içindeki `xp` adları, ödül matematiği, eşikler ve SQLite alanları değiştirilmez; ürün adı
  ileride yalnız sunum kaynağından güncellenebilir.

# 2026-08-29 — Ana slot cezaları session başlangıcı ve yerel SQLite reconciliation kullanır

- Ana slotlar cihazın yerel saatinde sabittir: sabah 04:00–12:00, akşam 18:00–00:00. Session
  sınıflandırması bitiş, reminder veya açılan karttan değil yalnız kalıcı `started_at` değerinden
  türetilir; slot dışında başlayan session hiçbir ana slotu tamamlamaz.
- Migration 17 açık session attempt’lerini ve profil/gün/slot birleşik anahtarlı değerlendirmeleri
  yerel SQLite’ta saklar. Profil yükünde kapanmış slotlar profil oluşturma zamanından itibaren
  reconcile edilir; açık attempt sonuçlanana kadar ertelenir ve missed `-10` yalnız bir kez yazılır.
- Skor `MAX(0, current_score - 10)` davranışıyla sıfırın altına inmez. Karakter evresi yalnız güncel
  skordan 0/160/400/1000/1800 eşikleriyle türetilir; skor düşünce evre de geriye dönebilir.

# 2026-08-29 — Koleksiyon efektleri karakter-sahnesi yerel katmanıdır

- Efekt sunumu büyük PNG, kart thumbnail'i veya tüm ekran koordinatları yerine `CharacterAvatar`
  güvenli viewport'una bağlı, kırpılan ve yalnız kodla çizilen küçük pastel bir katman kullanır.
  Collection önizlemesi ile Child Home aynı katmanı render eder.
- Köpük ve Kalp Uçuşması ürün kataloğundan çıkarılır; brushing köpüğü değişmez. Kalan altı efektin
  mevcut anahtarları, kilit eşikleri ve child-specific equip persistence davranışı korunur.
- Altı efektin tamamı seçili kaldıkları sürece düşük yoğunluklu, sürekli bir loop çalıştırır; Kutlama
  da karakter etkileşimi gerektirmeden küçük yıldız ve confetti hareketini sürdürür.

# 2026-08-29 — Oda malzemeleri matching background kilidini paylaşır

- Altı desteklenen temadaki oda malzemelerinin ayrı Mine Puan eşiği yoktur. Her malzemenin
  kullanılabilirliği yalnız matching background anahtarının güncel skor kilidinden türetilir; tema
  açıldığında beş malzeme birlikte açılır, background yeniden kilitlendiğinde birlikte kullanılamaz.
- Eski beş `decor` reward anahtarına bağlı malzeme kilitleri kaldırılır. Child-specific seçim ve
  yerleşimler korunur; kullanılamayan kayıtlar sahnede render edilmez ve mevcut background fallback
  davranışı geçerli kalır.

# 2026-08-29 — Native ve bootstrap splash aynı onaylı marka görselini kullanır

- Expo native launch screen, onaylı sabit DentHero splash PNG’sini lavanta arka plan üzerinde
  `cover` ile gösterir; spinner, loading noktası veya yapay minimum bekleme süresi içermez.
- Native splash yalnız fontlar ve yerel veritabanı hazır olduğunda kaldırılır. Auth restore ve ilk
  route çözülürken aynı yerel PNG React katmanında gösterilerek aradaki beyaz/loading-state karesi
  önlenir; auth ve navigation kararları değiştirilmez.
