// Everything the user reads, in Turkish. Nothing else in the app has text of its own (text.test.ts
// looks for some). Names the user gave (tiles, calendars, events) stay as they are.
import type { BulletinError } from '@deskhub-mobile/protocol';
import type { PageName } from './nav.js';

export const LOCALE = 'tr-TR';

const decimals = new Map<number, Intl.NumberFormat>();

/** "1.033,5" */
export function formatNumber(n: number, digits = 0): string {
  let format = decimals.get(digits);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    decimals.set(digits, format);
  }
  return format.format(n);
}

/** "%38": the sign comes first in Turkish. */
export const percent = (n: number | string): string => `%${n}`;

export const PAGE_NAMES: Readonly<Record<PageName, string>> = {
  home: 'Ana',
  stats: 'Bilgisayar',
  ai: 'Claude',
  calendar: 'Takvim',
  weather: 'Hava',
  media: 'Müzik',
  printer: '3B yazıcı',
  shortcuts: 'Kısayollar',
  timer: 'Zamanlayıcı',
  games: 'Oyunlar',
  network: 'İnternet',
  github: 'GitHub',
  bulletin: 'Bülten',
};

export const T = {
  none: '--',
  pcOffline: 'PC çevrimdışı',
  waitingForPc: 'PC bekleniyor',
  today: 'Bugün',
  tomorrow: 'Yarın',
  yesterday: 'Dün',
  now: 'Şimdi',
  days: (n: number) => `${n} gün`,
  hoursMinutes: (h: number, m: number) => `${h} sa ${m} dk`,
  minutes: (n: number) => `${n} dk`,
  seconds: (n: number) => `${n} sn`,
  daysHours: (d: number, h: number) => `${d} gün ${h} sa`,
  hours: (n: string | number) => `${n} sa`,

  nav: {
    label: 'Sayfalar',
    all: 'Tümü',
    codex: 'Codex',
  },

  panel: {
    label: 'Özet',
    next: 'Sıradaki',
    live: 'Şu anda',
    noEvents: 'Yaklaşan etkinlik yok',
    inMinutes: (n: number) => `${n} dk sonra`,
    inHours: (h: number, m: number) => (m > 0 ? `${h} sa ${m} dk sonra` : `${h} sa sonra`),
    until: (clock: string) => `Bitiş ${clock}`,
    timer: 'Zamanlayıcı',
    openWeather: 'Hava sayfasını aç',
    openCalendar: 'Takvimi aç',
    openTimer: 'Zamanlayıcıyı aç',
  },

  link: {
    good: 'Bağlantı iyi',
    fair: 'Bağlantı orta',
    poor: 'Bağlantı zayıf',
    none: 'Bağlantı yok',
    open: (state: string) => `${state}. Tanılamayı aç`,
  },

  status: {
    badOrigin: 'Bu adres bridge listesinde yok, CLIENT_ORIGINS ayarına ekle',
    connecting: 'PC’deki bridge’e bağlanılıyor',
    startCompanion: 'PC’de companion’ı başlat',
  },

  all: {
    diagnostics: 'Tanılama',
    fine: 'Her şey yolunda',
    lookHere: 'Göz at',
    waiting: 'Veri bekleniyor',
    tiles: (n: number) => (n === 0 ? 'Düğme yok' : `${n} düğme`),
    events: (n: number) => (n === 0 ? 'Etkinlik yok' : `${n} etkinlik`),
  },

  tabs: {
    open: 'Sekmeler',
    openLine: 'Sırasını değiştir',
    first: 'Yerini değiştirmek istediğin sekmeye dokun',
    second: (name: string) => `${name} ile yer değiştirecek sekmeye dokun`,
    dock: 'Altta',
    rest: 'Tümü içinde',
    reset: 'Varsayılan',
    done: 'Bitti',
  },

  agenda: {
    allDay: 'Tüm gün',
    nowUntil: (clock: string) => `Şimdi, bitiş ${clock}`,
    when: (day: string, time: string) => `${day}, ${time}`,
    title: (prefix: string, date: string) => (prefix ? `${prefix}, ${date}` : date),
    more: (n: number, days: number) => `Önümüzdeki ${days} günde ${n} etkinlik daha`,
    noMore: (days: number) => `Önümüzdeki ${days} günde başka etkinlik yok`,
    nothing: (days: number) => `Önümüzdeki ${days} günde etkinlik yok`,
    add: 'PC’de deskhub-calendars ile takvim ekle',
  },

  usage: {
    fiveHour: '5 saatlik limit',
    weekly: 'Haftalık limit',
    fiveHourShort: '5 saat',
    weeklyShort: 'Hafta',
    today: 'Bugün',
    tokens: 'Token',
    output: 'Çıktı',
    messages: 'Mesaj',
    lastHour: 'Son saat',
    lastDays: 'Son 7 gün',
    models: 'Bugünkü modeller',
    peak: (tokens: string) => `en çok ${tokens}`,
    todayTokens: (messages: number) => `token, ${formatNumber(messages)} mesaj`,
    billion: (n: string) => `${n} Mr`,
    million: (n: string) => `${n} Mn`,
    thousand: (n: string) => `${n} B`,
    resetting: 'Şimdi sıfırlanıyor',
    resetsOn: (day: string, clock: string) => `${day} ${clock}`,
    resetsIn: (left: string) => `${left} kaldı`,
    asOf: (when: string) => `${when} itibarıyla`,
    noFiveHour: 'Bu planda 5 saatlik limit yok',
    noFiveHourShort: '5 saatlik limit yok',
    startsWithPrompt: 'İlk mesajla başlar',
    fresh: 'Yeni pencere hazır',
    idle: 'Boşta',
    noWindow: 'Açık pencere yok',
    estimate: (messages: number) => `token, ${formatNumber(messages)} mesaj (tahmini)`,
    noLimits: 'Henüz limit bilgisi yok',
    appearsAfter: (agent: string) => `${agent} yanıtından sonra görünür`,
    noData: 'Henüz veri yok',
  },

  alert: {
    permission: 'İzin istiyor',
    waiting: 'Seni bekliyor',
    waitingTitle: 'Claude seni bekliyor',
    notNow: 'Şimdi değil',
    show: 'PC’de göster',
  },

  stats: {
    pc: 'PC',
    cpu: 'İşlemci',
    gpu: 'Ekran kartı',
    ram: 'Bellek',
    vram: 'Ekran belleği',
    noGpu: 'GPU verisi yok',
    lastMinute: 'Son dakika',
    chart: 'Son dakikadaki işlemci ve ekran kartı yükü',
    disk: (n: number) => `Disk ${percent(n)} dolu`,
  },

  net: {
    latency: 'Gecikme',
    state: 'Durum',
    data: 'Veri kullanımı',
    today: 'Bugün',
    month: 'Bu ay',
    online: 'Çevrimiçi',
    offline: 'Çevrimdışı',
    chart: 'Gecikme, son 2 dakika',
    max: (ms: number) => `en çok ${ms} ms`,
    speedTest: 'Hız testi',
    nowRates: (down: string, up: string) => `Şimdi ↓ ${down}  ↑ ${up} Mbps`,
    tested: (ping: string, ago: string) => `Ping ${ping} ms, ${ago}`,
    noTest: 'Henüz test yok. Bir test yaklaşık 35 MB veri kullanır.',
    never: 'hiç',
    justNow: 'az önce',
    minutesAgo: (n: number) => `${n} dk önce`,
    hoursAgo: (n: number) => `${n} sa önce`,
    daysAgo: (n: number) => `${n} gün önce`,
    quality: (jitter: string, loss: number) => `Dalgalanma ${jitter} ms, kayıp ${percent(loss)}`,
    up: (span: string) => `${span} açık`,
    lastDrop: (ago: string, span: string) => `son kopma ${ago}, ${span}`,
    noDrops: 'kopma görülmedi',
    testing: 'Hız testi yapılıyor',
    testingShort: 'Test ediliyor',
    starting: 'Başlıyor',
    again: (left: string) => `${left} sonra`,
    run: 'Test et',
  },

  weather: {
    noLocation: 'Konum ayarlanmadı',
    setLocation: 'Bridge’in .env dosyasında WEATHER_LATITUDE ve WEATHER_LONGITUDE ayarla',
    loading: 'Hava yükleniyor',
    waitingForBridge: 'PC’deki bridge bekleniyor',
    feels: (t: string) => `Hissedilen ${t}`,
    humidity: (n: number) => `Nem ${percent(n)}`,
    wind: (n: number, unit: string) => `Rüzgâr ${n} ${unit}`,
    kmh: 'km/sa',
    mph: 'mil/sa',
    updated: (when: string) => `${when}, Open-Meteo.com`,
    range: (hi: string, lo: string) => `${hi} / ${lo}`,
    unknown: 'Bilinmiyor',
  },

  media: {
    nothing: 'Çalan bir şey yok',
    playOnPc: 'PC’de bir şey çal',
    thisPc: 'Bu PC',
    nothingHere: 'Bu PC’de çalan bir şey yok',
    cantReach: (name: string) => `${name || 'Sunucu'} yanıt vermiyor`,
    transcoding: 'dönüştürülüyor',
    position: 'Konum',
    previous: 'Önceki',
    next: 'Sonraki',
    pause: 'Duraklat',
    play: 'Oynat',
  },

  printer: {
    none: 'Yazıcı bağlı değil',
    add: 'PC’de deskhub-printers ile ekle',
    nozzle: 'Nozül',
    bed: 'Tabla',
    chamber: 'Kabin',
    target: (t: string) => `hedef ${t}`,
    filament: 'Filament',
    noAms: 'AMS verisi yok',
    of: (i: number, n: number) => `${i} / ${n}`,
    left: (time: string) => `${time} kaldı`,
    doneAt: (clock: string) => `Bitiş ${clock}`,
    doneOn: (day: string, clock: string) => `Bitiş ${day} ${clock}`,
    ready: 'Alınmaya hazır',
    layer: (i: number, n: number) => `Katman ${i} / ${n}`,
    printing: 'Basılıyor',
    lastPrint: 'Son baskı',
    lastFile: 'Son dosya',
    speed: (s: string) => `${s} hız`,
    notPrinting: 'Baskı yok',
    homeDone: 'Bitti, alınmaya hazır',
    title: '3B baskı',
    unknown: 'Bilinmiyor',
  },

  timer: {
    idle: 'Hazır',
    running: 'Çalışıyor',
    paused: 'Duraklatıldı',
    minutes: 'Dakika',
    reset: 'Sıfırla',
    pause: 'Duraklat',
    start: 'Başlat',
    up: 'Süre doldu',
    again: 'Tekrar',
    done: 'Tamam',
    nameMinutes: (n: number) => `${n} dakikalık sayaç`,
    nameSeconds: (n: number) => `${n} saniyelik sayaç`,
  },

  games: {
    nowPlaying: 'Oynanıyor',
    none: 'Oyun açık değil',
    friends: 'Oyundaki arkadaşlar',
    recent: 'Son oyunlar, başlatmak için dokun',
    starting: 'Başlıyor',
    noRecent: 'Son oynanan oyun yok',
    playing: (time: string) => `${time} süredir oynanıyor`,
    total: (time: string) => `toplam ${time}`,
    friendsInGame: (n: number) => `${n} arkadaş oyunda`,
    startOne: 'Bir oyun başlat ya da aşağıdan seç',
    noSteam: 'PC’de Steam kurulu değil',
    noSteamShort: 'Steam bulunamadı',
    noneYet: 'Henüz oynanan oyun yok',
    justNow: 'Az önce',
    hoursAgo: (n: number) => `${n} saat önce`,
    daysAgo: (n: number) => `${n} gün önce`,
    monthsAgo: (n: number) => `${n} ay önce`,
    recentShort: 'Son oynanan',
    steam: 'Steam',
    play: (name: string) => `${name} oyununu başlat`,
  },

  github: {
    year: 'Son bir yıl',
    streak: 'Seri',
    longest: 'En uzun',
    best: 'En iyi gün',
    week: 'Bu hafta',
    repos: 'En aktif depolar',
    noCommits: 'Bu yıl commit yok',
    dayUnit: 'gün',
    bestOn: (n: number, date: string) => `${date}, ${n}`,
    contributions: (n: string) => `${n} katkı`,
    commits: (n: string) => `${n} commit`,
    private: (n: string) => `${n} gizli`,
    prs: (n: string) => `${n} PR`,
    reviews: (n: string) => `${n} inceleme`,
    issues: (n: string) => `${n} issue`,
    same: 'geçen haftayla aynı',
    more: (n: number) => `geçen haftadan ${n} fazla`,
    less: (n: number) => `geçen haftadan ${n} az`,
    homeTotal: (n: string) => `son bir yılda ${n}`,
    homeStreak: (n: number) => `${n} günlük seri`,
    homeToday: (n: number) => `bugün ${n}`,
    today: 'bugün',
    thisWeek: 'bu hafta',
    dayStreak: 'günlük seri',
    chart: 'Günlere göre katkılar',
  },

  shortcuts: {
    none: 'Henüz kısayol yok',
    add: 'Companion’ın config.toml dosyasına ekle',
    again: 'Emin misin? Tekrar dokun',
  },

  token: {
    title: 'Bu ekranı bağla',
    hint: 'PC’de bridge’in verdiği bağlantıyı aç ya da .env dosyasındaki CLIENT_TOKEN değerini yaz.',
    label: 'Bağlantı anahtarı',
    connect: 'Bağlan',
  },

  error: {
    title: 'Bir şeyler ters gitti',
    reload: 'Yenile',
    given: 'Birkaç kez yenilendi, şimdilik kendiliğinden yenilenmeyecek.',
  },

  bulletin: {
    title: 'Sabah bülteni',
    empty: 'Henüz bülten yok. Günün bülteni Desk Hub o gün ilk açıldığında hazırlanır.',
    running: (time: string) => `Hazırlanıyor · ${time}`,
    previous: (date: string) => `Önceki bülten, ${date}`,
    failed: 'Bülten hazırlanamadı',
    retry: 'Tekrar dene',
    retryAt: (time: string) => `${time}’den sonra tekrar denenebilir`,
    made: (date: string, time: string) => `${date} · ${time}`,
    errors: {
      codex_missing: 'Codex bulunamadı. PC’de VS Code’un Codex eklentisini kur ya da .env’de CODEX_PATH ver.',
      codex_signed_out: 'Codex’te ChatGPT ile oturum açık değil. PC’de “codex login” çalıştır.',
      api_key_set: 'PC’de bir OpenAI API anahtarı tanımlı. Ücretli kullanıma düşmemek için bülten hazırlanmadı.',
      unsafe_flags: 'Codex’in güvenlik ayarları doğrulanamadı, bu yüzden çalıştırılmadı.',
      failed: 'Codex bir hatayla kapandı.',
      timeout: 'Codex 15 dakikada bitiremedi.',
      empty: 'Codex boş bir bülten döndürdü.',
    } satisfies Record<BulletinError, string>,
    notes: {
      no_sources: 'Kaynaklar bölümü yok.',
      no_prices: 'Fiyatlar doğrulanamadı.',
      price_unverified: (ticker: string) => `${ticker} fiyatı doğrulanamadı.`,
      sheet_unreadable: 'Portföy dosyası okunamadı, kişisel tablo yok.',
      split_after: (ticker: string) => `${ticker} için yeni bir bölünme var, adetleri kontrol et.`,
    },
    portfolio: 'Portföyüm',
    portfolioNote: 'Köprünün hesabı: adetler dosyadan, fiyatlar bültenden.',
    asOf: (date: string) => `Adetler ${date} dahil`,
    columns: { ticker: 'Sembol', quantity: 'Adet', cost: 'Maliyet', value: 'Değer', pnl: 'K/Z', day: 'Günlük' },
    reward: 'ödül',
    newPosition: 'yeni',
    total: 'Toplam',
    rewardsLeftOut: 'Ödül payları toplama ve dağılıma katılmadı.',
    gold: (grams: string) => `Altın, ${grams} gr`,
    noPrice: 'fiyat doğrulanamadı',
    mix: 'Dağılım ve hedef',
    mixParts: { etf: 'ABD ETF', stock: 'ABD hisse', gold: 'Altın' },
    mixOf: (pct: string, target: string) => `${pct}, hedef ${target}`,
    sections: 'Bölümler',
  },
  morning: {
    hello: 'Günaydın',
    listen: 'Dinle',
    open: 'Bülteni aç',
    close: 'Kapat',
    noEvents: 'Bugün etkinlik yok',
    firstEvent: (time: string, title: string) => `${time} ${title}`,
    writing: 'Bülten hazırlanıyor…',
    hiLo: (hi: string, lo: string) => `en yüksek ${hi}, en düşük ${lo}`,
    /** What "Dinle" says before the bulletin. */
    say: {
      hello: 'Günaydın.',
      weather: (temp: string, text: string, hi: string) => `Hava ${temp}, ${text}, en yüksek ${hi}.`,
      event: (time: string, title: string) => `İlk etkinlik saat ${time}, ${title}.`,
      noEvents: 'Bugün etkinlik yok.',
      reminder: (title: string) => `Bugün: ${title}.`,
      bulletin: 'Sabah bülteni.',
    },
  },
  speech: {
    reading: 'Okunuyor',
    short: 'Kısa',
    all: 'Tamamı',
    pause: 'Duraklat',
    resume: 'Devam',
    back: 'Önceki',
    forward: 'Sonraki',
    stop: 'Kapat',
    speed: 'Okuma hızı',
    rate: (rate: number) => `${formatNumber(rate, rate % 1 ? 1 : 0)}×`,
    firstTouch: 'Günün ilk dokunuşunda oku',
    voice: 'Konuşma sesi',
    voiceOf: (name: string, lang: string, local: boolean) => `${name}, ${lang}, ${local ? 'cihazda' : 'çevrimiçi'}`,
    turkishVoices: (n: number) => `${n} Türkçe ses`,
    noVoice:
      'Türkçe ses yok. Telefonda Ayarlar → Genel yönetim → Metin okuma → Google konuşma hizmetleri’ni seç ve Türkçe ses verisini indir.',
    unsupported: 'Bu tarayıcı sesli okuyamaz.',
    failed: (error: string) => `Okuma durdu: ${error}`,
  },
  reminders: {
    today: 'Bugün',
    save: 'Kaydet',
    later: 'Sonra',
    cancel: 'Vazgeç',
    saved: 'Kaydedildi',
    last: (text: string) => `Son: ${text}`,
    change: (text: string) => `önceki haftaya göre ${text}`,
  },
  measurements: {
    title: 'Ölçümler',
    average: '4 haftalık ortalama',
    empty: 'Henüz ölçüm yok.',
    back: 'Geri',
    open: 'Ölçümleri aç',
  },
  info: {
    title: 'Tanılama',
    reload: 'Yenile',
    close: 'Kapat',
    hint: ['Güvenli bağlam olmadan ekran açık kalamaz ve sayfa PC olmadan açılmaz. Chrome’da ', ' adresini aç, ', ' yaz, Enabled seç ve Relaunch’a bas.'],
    address: 'Adres',
    secure: 'Güvenli bağlam',
    yes: 'var',
    no: 'yok',
    wakeLock: 'Ekranı açık tutma',
    worker: 'Çevrimdışı kopya',
    bridge: 'Bridge',
    answer: 'Yanıt süresi',
    answerTime: (ms: number, lost: number) => (lost > 0 ? `${ms} ms, ${lost} kayıp` : `${ms} ms`),
    pc: 'PC',
    online: 'çevrimiçi',
    offline: 'çevrimdışı',
    browser: 'Tarayıcı',
    screen: 'Ekran',
    screenSize: (w: number, h: number, ratio: string) => `${w} x ${h}, ${ratio} kat`,
    fullscreen: 'tam ekran',
    build: 'Sürüm',
    bridgeBuild: (build: string) => `bridge’deki ${build}`,
    lastError: 'Son hata',
    noError: 'yok',
    unavailable: 'kullanılamıyor',
    off: 'kapalı',
    waiting: 'bekliyor',
    held: (time: string) => `${time} süredir açık`,
    starting: 'başlıyor',
    active: 'etkin',
    links: {
      connecting: 'bağlanıyor',
      open: 'bağlı',
      bad_token: 'anahtar yok ya da yanlış',
      bad_origin: 'bu adrese izin yok',
    },
  },
} as const;

/** WMO weather codes. */
export const WEATHER_TEXTS: Readonly<Record<number, string>> = {
  0: 'Açık',
  1: 'Çoğunlukla açık',
  2: 'Parçalı bulutlu',
  3: 'Kapalı',
  45: 'Sisli',
  48: 'Sisli',
  51: 'Çisenti',
  53: 'Çisenti',
  55: 'Çisenti',
  56: 'Donan çisenti',
  57: 'Donan çisenti',
  61: 'Hafif yağmur',
  63: 'Yağmur',
  65: 'Şiddetli yağmur',
  66: 'Donan yağmur',
  67: 'Donan yağmur',
  71: 'Hafif kar',
  73: 'Kar',
  75: 'Yoğun kar',
  77: 'Kar taneleri',
  80: 'Sağanak',
  81: 'Sağanak',
  82: 'Şiddetli sağanak',
  85: 'Kar sağanağı',
  86: 'Kar sağanağı',
  95: 'Gök gürültülü',
  96: 'Dolulu fırtına',
  99: 'Dolulu fırtına',
};

export const PRINTER_STATES: Readonly<Record<string, string>> = {
  RUNNING: 'Basıyor',
  PREPARE: 'Hazırlanıyor',
  SLICING: 'Dilimleniyor',
  PAUSE: 'Duraklatıldı',
  FINISH: 'Bitti',
  FAILED: 'Başarısız',
  IDLE: 'Boşta',
  OFFLINE: 'Çevrimdışı',
};

/** Under GitHub's bars, from Sunday. */
export const WEEKDAY_LETTERS = ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'] as const;

/** Monday, Wednesday and Friday, beside GitHub's squares. */
export const CHART_WEEKDAYS = ['Pzt', 'Çar', 'Cum'] as const;

// ---- What the companion says in English (b78c505). Others are shown as they are.

/** MONTHS in companion/deskhub/github.py. */
const MONTHS: Readonly<Record<string, string>> = {
  Jan: 'Oca',
  Feb: 'Şub',
  Mar: 'Mar',
  Apr: 'Nis',
  May: 'May',
  Jun: 'Haz',
  Jul: 'Tem',
  Aug: 'Ağu',
  Sep: 'Eyl',
  Oct: 'Eki',
  Nov: 'Kas',
  Dec: 'Ara',
};

export const monthName = (name: string): string => (Object.hasOwn(MONTHS, name) ? MONTHS[name]! : name);

/** "Nov 20" (best_date in github.py): "20 Kas" */
export function monthDay(text: string): string {
  const found = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(text);
  return found && Object.hasOwn(MONTHS, found[1]!) ? `${found[2]} ${MONTHS[found[1]!]}` : text;
}

/** SPEEDS in printer.py and anycubic.py. Others are percentages. */
const SPEEDS: Readonly<Record<string, string>> = {
  Silent: 'Sessiz',
  Standard: 'Standart',
  Sport: 'Spor',
  Ludicrous: 'Çılgın',
};

export function printerSpeed(speed: string): string {
  const share = /^(\d+)%$/.exec(speed);
  if (share) return percent(share[1]!);
  return Object.hasOwn(SPEEDS, speed) ? SPEEDS[speed]! : speed;
}

/** printer.py: "Error 0300-0100" */
export const printerError = (error: string): string => error.replace(/^Error (?=[0-9A-Fa-f]{4}-)/, 'Hata ');

const COUNTS: Readonly<Record<string, string>> = { movie: 'film', show: 'dizi', episode: 'bölüm', song: 'şarkı' };

/** describe() in media_server.py: "312 movies, 45 shows, 2,104 episodes" */
export const libraryText = (text: string): string =>
  text.replace(/\b(\d[\d,]*) (movie|show|episode|song)s?\b/g, (_, n: string, what: string) => `${n.replaceAll(',', '.')} ${COUNTS[what]}`);

/** Claude Code's own messages and those of claude_alerts.py. */
const ALERTS: readonly [RegExp, string | ((...found: string[]) => string)][] = [
  [/^Claude needs your permission to use (.+)$/, (_, tool) => `Claude ${tool} için izin istiyor`],
  [/^Claude needs your permission$/, 'Claude izin istiyor'],
  [/^Claude is waiting for you$/, 'Claude seni bekliyor'],
  [/^Claude is waiting for your input$/, 'Claude yanıtını bekliyor'],
  [/^Finished\. Waiting for your reply$/, 'Bitti, yanıtını bekliyor'],
];

export function alertText(text: string): string {
  for (const [pattern, to] of ALERTS) {
    const found = pattern.exec(text);
    if (found) return typeof to === 'string' ? to : to(...found);
  }
  return text;
}

/**
 * What the speech engine would say badly, written out (reading aloud, phase 6). In order: longer ones
 * first. Numbers stay digits: the Turkish voice reads "1.234,5" well.
 */
export const SAYABLE: readonly [RegExp, string | ((...found: string[]) => string)][] = [
  [/(^|[\s(])[−-](?=\d)/g, (_, before) => `${before}eksi `],
  [/(^|[\s(])\+(?=\d)/g, (_, before) => `${before}artı `],
  [/%\s?(\d[\d.,]*)/g, (_, n) => `yüzde ${n}`],
  [/(\d[\d.,]*)\s?%/g, (_, n) => `yüzde ${n}`],
  [/\$\s?(\d[\d.,]*)/g, (_, n) => `${n} dolar`],
  [/(\d[\d.,]*)\s?\$/g, (_, n) => `${n} dolar`],
  [/(\d[\d.,]*)\s?₺/g, (_, n) => `${n} lira`],
  // \b doesn't know "İ".
  [/(?<!\p{L})TSİ(?!\p{L})/gu, 'Türkiye saati'],
  [/\bK\/Z\b/g, 'kâr zarar'],
  [/\bF\/K\b/g, 'fiyat kazanç oranı'],
  [/\bUSD\/TRY\b/g, 'dolar kuru'],
  [/\bBIST\b/g, 'Borsa İstanbul'],
  [/→/g, ', '],
  [/·/g, ', '],
];
