// Weather: now, the next 24 hours and 6 days (firmware/main/ui_weather.c).
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { formatClock, formatHour, formatWeekday, isSameDay } from '../time.js';
import { daysFrom, dayTime, hoursFrom, type WeatherState } from '../weather.js';
import { formatPrecip, formatTemp, isDaytime, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import styles from './WeatherPage.module.css';

function WeatherIcon({ code, isDay, size }: { code: number; isDay: boolean; size: number }) {
  return <Icon name={weatherIcon(code, isDay)} size={size} color={weatherColor(code, isDay)} />;
}

export function WeatherPage({ state: { settings, weather }, now }: { state: WeatherState; now: number }) {
  if (settings === null)
    return <Empty icon="cloud" title="No location set" hint="Set WEATHER_LATITUDE and WEATHER_LONGITUDE in the bridge's .env" />;
  if (!settings || !weather)
    return <Empty icon="cloud" title="Loading weather" hint={settings ? settings.city : 'Waiting for the bridge on your PC'} />;

  const { fetched } = weather;
  const updated = isSameDay(fetched, now) ? formatClock(fetched) : `${formatWeekday(fetched)} ${formatClock(fetched)}`;
  return (
    <main className={styles.page}>
      <section className={styles.now}>
        <WeatherIcon code={weather.code} isDay={weather.isDay} size={80} />
        <div className={styles.current}>
          <p className={styles.temp}>{formatTemp(weather.temp)}</p>
          <p className={styles.condition}>{weatherText(weather.code)}</p>
          <p className={styles.city}>{settings.city}</p>
        </div>
        <div className={styles.details}>
          <p>Feels like {formatTemp(weather.feels)}</p>
          <p>Humidity {weather.humidity}%</p>
          <p>
            Wind {Math.trunc(weather.wind + 0.5)} {settings.units === 'imperial' ? 'mph' : 'km/h'}
          </p>
          <p className={styles.updated}>Updated {updated} • Open-Meteo.com</p>
        </div>
      </section>

      <section className={styles.hours}>
        {hoursFrom(weather, now).map((h) => (
          <div key={h.time} className={styles.hour}>
            <span className={styles.label}>{h.time <= now ? 'Now' : formatHour(h.time)}</span>
            <WeatherIcon code={h.code} isDay={isDaytime(h.time)} size={32} />
            <span className={styles.hourTemp}>{formatTemp(h.temp)}</span>
            <span className={styles.rain}>{formatPrecip(h.precip)}</span>
          </div>
        ))}
      </section>

      <section className={styles.days}>
        {daysFrom(weather, now).map((d) => (
          <div key={d.time} className={styles.day}>
            <span className={styles.dayName}>{isSameDay(dayTime(d), now) ? 'Today' : formatWeekday(dayTime(d))}</span>
            <WeatherIcon code={d.code} isDay size={32} />
            <span className={styles.range}>
              {formatTemp(d.hi)} / {formatTemp(d.lo)}
            </span>
            <span className={styles.rain}>{formatPrecip(d.precip)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
