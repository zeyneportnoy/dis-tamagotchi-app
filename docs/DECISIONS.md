# Teknik Kararlar

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
