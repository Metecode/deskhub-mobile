// Mock mode's bulletin: a made-up sheet and a made-up Codex, so the whole way (running, ready, the
// portfolio, the notes) can be seen without Codex or Google. Never the user's own data.
import { writeFile } from 'node:fs/promises';
import type { SpawnFn } from './codex.js';
import type { Sheet } from './sheet.js';

/** How long the made-up run takes, to see "Hazırlanıyor". */
export const MOCK_RUN_MS = 8000;

export const mockSheet = (): Sheet => ({
  readAt: new Date(),
  tabs: [
    {
      name: 'Pozisyonlar',
      rows: [
        ['Sembol', 'Adet 13.11.2026 dahil', 'Maliyet USD'],
        ['ETF1', '12,0000', '5.400,00'],
        ['ETF2', '20,0000', '2.100,00'],
        ['STK1', '8,0000', '900,00'],
        ['RWD', '0,4000', '18,00'],
        ['WCH1', '1,5000', '190,00'],
      ],
    },
    {
      name: 'Altın Alımları',
      rows: [
        ['Kayıt ID', 'Tarih', 'İşlem türü', 'Ayar', 'Gram', 'Birim maliyet TL/g', 'Toplam maliyet TL'],
        ['G1', '01.10.2026', 'Alım', '24', '8,00', '5.200,00', '41.600,00'],
      ],
    },
  ],
});

function bulletin(now: Date): string {
  const day = now.toISOString().slice(0, 10);
  // Yesterday at 21:00 UTC: after the New York close (16:00 EST, 17:00 EDT), whatever the time now.
  const yesterday = new Date(now.getTime() - 24 * 3600_000);
  yesterday.setUTCHours(21, 0, 0, 0);
  const close = yesterday.toISOString().replace('Z', '+00:00');
  const spot = new Date(now.getTime() - 20 * 60_000).toISOString().replace('Z', '+00:00');
  const price = (ticker: string, p: number, prev: number | null, currency = 'USD', kind = 'close', at = close) =>
    JSON.stringify({ ticker, price: p, previous_close: prev, currency, kind, at, source: `https://example.com/${ticker.toLowerCase()}` });
  return `# Sabah yatırım bülteni — ${day}
**Örnek veri, gerçek değil.**

## 0. Bir bakışta

- **Kritik mesaj:** Fed tutanakları bu akşam; teknoloji ağırlığı yüksek fonlar faiz beklentisine duyarlı.
- Portföyün fiyat kaynaklı günlük değişimi köprünün tablosunda.
- Acil dikkat gerektiren varlık yok.

## 1. En önemli 3 gelişme

1. **Örnek Şirket A yeni bir veri merkezi anlaşması duyurdu.** Olay: dün; yayın: bu sabah. Gelir görünümünü destekliyor; tek hisse sepetiniz etkileniyor. [Şirket duyurusu](https://example.com/a)
2. **Ons altın haftayı yükselişle kapattı.** Altın sepetiniz için olumlu; birikim tezini değiştirmiyor. [Kaynak](https://example.com/altin)
3. **TCMB faiz kararı perşembe.** Beklenti: sabit. Yorum: Kur oynaklığı TL değerini etkileyebilir.

## 2. Piyasa tablosu

| Varlık | Son değer | Günlük % | Tarih/saat ve fiyat türü |
|---|---:|---:|---|
| S&P 500 | 6.950,12 | +0,41 | [kapanış dün] |
| Nasdaq | 22.874,30 | +0,58 | [kapanış dün] |
| BIST 100 | 10.412,05 | −0,72 | [kapanış dün] |
| USD/TRY | 49,8200 | +0,05 | [piyasa 07:15 TSİ] |
| Gram altın | 5.786 ₺ | +0,35 | [piyasa 07:15 TSİ] |

## 3. Portföyüm

Yorum: ETF ağırlığı hedefin altında; altın hedefin üstünde. Teknoloji örtüşmesi ETF1 ile STK1 arasında yüksek.

## 4. Bireysel hisselerim

### STK1 — koru

**Fiyat:** 131,25 $; +%0,80 [kapanış dün]. Önemli gelişme yok.

### WCH1 — Yeni pozisyon

Şirket ne yapıyor: örnek. Ana risk: örnek. F/K bulunamadı.

## 5. Fonlarım

Fonlarınızda maddi haber yok.

## 6. İzleme listesi

- **WCH2:** 42,10 $; −%1,20. Önemli gelişme yok.

## 7. Fırsatlar

Bugün güçlü yeni fırsat yok.

## 8. Takvim — TSİ

| Saat | Etkinlik |
|---|---|
| 10:00 | Örnek veri açıklaması (beklenti) |
| 22:00 | Fed tutanakları |

## Kaynaklar

- [Şirket duyurusu, dün](https://example.com/a)
- [Altın, bu sabah](https://example.com/altin)

**Somut adım: Bugün işlem gerekmiyor.**

\`\`\`prices
${price('ETF1', 510.2, 506.4)}
${price('ETF2', 112.5, 111.9)}
${price('STK1', 131.25, 130.21)}
${price('RWD', 74.1, 73.8)}
${price('WCH1', 118.3, 121.0)}
${price('WCH2', 42.1, 42.61)}
${price('USDTRY', 49.82, null, 'TRY', 'spot', spot)}
${price('XAU_GRAM_TRY', 5786, null, 'TRY', 'spot', spot)}
\`\`\`
`;
}

/** Codex in mock mode: the checks pass, a run takes MOCK_RUN_MS and writes the made-up bulletin. */
export const mockCodex: SpawnFn = async (_file, args) => {
  if (args.includes('login')) return { code: 0, output: 'Logged in using ChatGPT', timedOut: false };
  if (args.includes('features')) return { code: 0, output: 'apps  stable  false\nshell_tool  stable  false', timedOut: false };
  await new Promise((resolve) => setTimeout(resolve, MOCK_RUN_MS));
  await writeFile(args[args.indexOf('-o') + 1] ?? '', bulletin(new Date()), 'utf8');
  return { code: 0, output: '', timedOut: false };
};
