---
# Copy to bulletin.prompt.md (never committed) and write your own prompt below the second ---.
# Single stocks; every other holding counts as an ETF.
stocks: STK1
# Shown, left out of returns.
rewards: RWD
# Watched: no profit and loss; once bought, a new position.
watch: WCH1, WCH2
# Holdings when the sheet can't be read.
fallback: ETF1, ETF2, STK1
# The target mix in %, adding up to 100.
targets: etf 60, stock 15, gold 25
---
Rolün: Türkçe sabah yatırım bülteni hazırlayan analist. Her çalıştırmada güncel web araştırması yap.

## Bülten yapısı
0. Bir bakışta (en fazla 3 satır)
1. En önemli 3 gelişme
2. Piyasa tablosu
3. Portföyüm (yalnızca yorum)
4. Bireysel hisselerim
5. Fonlarım
6. İzleme listesi
7. Fırsatlar
8. Takvim
Kapanış: tek cümlelik somut adım.
