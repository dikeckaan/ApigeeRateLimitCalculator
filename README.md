# Apigee Rate Limit Lab

Türkçe, tek HTML dosyasında çalışan Apigee Spike Arrest ve genel API rate limit simülatörü.

**Yayın:** https://dikeckaan.github.io/ApigeeRateLimitCalculator/

## Kullanım

`index.html` dosyasını herhangi bir modern tarayıcıda açın. Sunucu, kurulum, CDN, API anahtarı veya internet gerekmez. GitHub Pages üzerindeki **HTML indir** düğmesi mevcut ayarlarla tek dosya indirir. İndirilen kopyada bu düğme bulunmaz.

- Edge smoothing ve X / hybrid ideal sliding window modelleri.
- Rate (`ps` / `pm`), MP sayısı ve UseEffectiveCount.
- Sabit aralık, periyodik burst, seed ile jitter, özel zaman damgaları ve başlangıç ofseti.
- Round-robin, tek MP ve seed ile rastgele MP dağıtımı.
- İstek bazında 200 / 429, karar nedeni ve hesaplanan bekleme süresi.
- Zaman dağılımı grafiği, MP yük analizi ve sonuç filtresi.
- Aynı trafik üzerinde Edge, ortak sliding window, fixed window ve token bucket karşılaştırması.
- JSON senaryo kaydet/yükle, tüm sonuçları CSV olarak indirme.

**Pencere sınırı** örneği: `2ps` ve `998, 999, 1000, 1001 ms` istekleri ile fixed window dört isteği, sliding window iki isteği kabul eder.

## Çoklu kota / pik trafik

İkinci çalışma alanında saniyelik, dakikalık, saatlik, günlük ve aylık limitler birlikte uygulanır. En fazla 12 kural eklenebilir; kurallar açılıp kapatılabilir. Her kural takvim veya kayan pencere kullanır; ay yalnızca gerçek takvim ayı olabilir.

- Tarih aralığı, sabit saat dilimi ofseti ve rastgelelik seed'i.
- Toplam, dakika/saat/gün başına taban trafik; uniform rastgele veya eşit zaman dağılımı.
- En fazla 12 pik: her gün, hafta içi, hafta sonu veya belirli bir tarih; başlangıç/bitiş saati ve pik başına ek istek miktarı.
- Gece yarısını aşan, birbiriyle çakışan ve tarih aralığına kısmen giren pikler.
- Yalnızca kabul edilenleri veya bütün denemeleri sayma seçimi.
- Günlük/saatlik grafik, kural bazında darboğaz analizi ve sayfalanmış istek günlüğü.
- Her 429 için ihlal edilen bütün limitler ve yeni trafik olmadan hesaplanan en erken uygun zaman.
- Kota planını JSON olarak kaydet/yükle ve filtrelenmiş sonuçların tamamını CSV olarak indirme.

Simülasyon sınırı **100.000 istek / 366 gün**; gizli örnekleme yapılmaz. Bu ekran atomik ortak sayaçlarla çalışan genel bir modeldir; Apigee policy sıralamasını emüle etmez ve Spike Arrest çalışma alanına otomatik zincirlenmez. Takvim pencereleri seçilen sabit ofsetle hizalanır; yaz saati değişimi yoktur. Başlangıçtan önceki trafik bilinmez ve sayaçlar boş kabul edilir.

Varsayılan yoğun hafta örneği: günde 2.000 taban istek + 12:00–13:00 arasında 800 + 18:00–18:30 arasında 1.200 ek istek. Yedi günde toplam 28.000 istek, beş aktif limite karşı test edilir.

## Model sınırları

Bu araç Apigee runtime emülatörü veya gerçek yük testi değildir. Canlı API çağrısı yapmaz. 200, isteğin policy kontrolünden geçtiğini belirtir; backend yanıtını tahmin etmez. 429 policy ihlalini temsil eder; özel fault kuralları ve Edge Private Cloud farklı HTTP kodları döndürebilir.

Edge bir token kapasiteli smoothing yaklaşımıyla modellenir. Gerçek runtime token bucket kapasitesi, burst davranışı ve zaman yuvarlamaları farklı olabilir. X / hybrid tek region içindeki ideal ortak sliding window ile modellenir; dağıtık senkronizasyon gecikmesi yoktur. Tek Identifier, MessageWeight=1, sabit MP sayısı varsayılır. Bu sınırlamalar arayüzde de açıklanır.

Genel karşılaştırma algoritmaları Apigee policy seçenekleri değildir. Fixed window t=0'a hizalıdır; token bucket başlangıçta doludur ve sürekli dolar. Karşılaştırmada bu algoritmaların limiti ortaktır. Edge `UseEffectiveCount=false` ise MP sayısıyla artan nominal toplam limiti ayrıca belirtilir.

## Yedek

Geliştirmeden önceki sürüm: [`backups/spike-arrest-v1.html`](backups/spike-arrest-v1.html).

SHA-256: `226a51538c7472dbac465405247a700a923799695546288b13137841259df081`

## Geliştirme / test

Node.js 22.13+:

```sh
npm ci
npm test
```

jsdom yalnızca geliştirme testlerinde kullanılır; uygulamanın runtime bağımlılığı yoktur. Testler hesaplama sınırlarını, trafik üretimini, doğrulamayı, CSV/JSON işlemlerini ve indirilen HTML'in iki çalışma alanının ayarlarını koruyarak düğmesiz çalışmasını kapsar. Ay geçişi, artık yıl, üst üste binen / gece yarısını aşan pikler ve çoklu limit sayaçları da test edilir.

GitHub Pages kaynağı: `main` dalı, `/` kök dizini. `.nojekyll` sayesinde statik HTML doğrudan sunulur.

## Sonraki araştırma alanları

- Retry-After, exponential backoff ve jitter ile tekrar deneme simülasyonu.
- API key / kullanıcı / IP bazlı ve toplam servis limitlerinin birlikte modellenmesi.
- Anonimleştirilmiş gateway loglarının replay edilmesi ve gerçek kararlarla kıyaslanması.
- Backend yanıt süresi, eşzamanlılık ve kuyruk kapasitesi simülasyonu.

## Kaynaklar

- [Apigee Edge SpikeArrest](https://docs.apigee.com/api-platform/reference/policies/spike-arrest-policy)
- [Apigee X / hybrid SpikeArrest](https://docs.cloud.google.com/apigee/docs/api-platform/reference/policies/spike-arrest-policy)
- [Apigee Quota policy](https://docs.cloud.google.com/apigee/docs/api-platform/reference/policies/quota-policy)
- [Redis rate limiting algoritmaları](https://redis.io/tutorials/howtos/ratelimiting/)
