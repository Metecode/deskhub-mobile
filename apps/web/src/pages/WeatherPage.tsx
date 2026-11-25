// Weather: now, the next 24 hours and 6 days (firmware/main/ui_weather.c).
import { Empty } from '../components/Empty.js';
import { Icon } from '../components/Icon.js';
import { T } from '../text.js';
import { formatClock, formatHour, formatWeekday, isSameDay } from '../time.js';
import { daysFrom, dayTime, hoursFrom, type WeatherState } from '../weather.js';
import { formatPrecip, formatTemp, isDaytime, weatherColor, weatherIcon, weatherText } from '../weatherLook.js';
import styles from './WeatherPage.module.css';

function WeatherIcon({ code, isDay, size }: { code: number; isDay: boolean; size: number }) {
  return <Icon name={weatherIcon(code, isDay)} size={size} color={weatherColor(code, isDay)} />;
}

export function WeatherPage({ state: { settings, weather }, now }: { state: WeatherState; now: number }) {
  if (settings === null)
    return <Empty icon="cloud" title={T.weather.noLocation} hint={T.weather.setLocation} />;
  if (!settings || !weather)
    return <Empty icon="cloud" title={T.weather.loading} hint={settings ? settings.city : T.weather.waitingForBridge} />;

  const { fetched } = weather;
  const updated = isSameDay(fetched, now) ? formatClock(fetched) : `${formatWeekday(fetched)} ${formatClock(fetched)}`;
  return (
    <main className={styles.page}>
      <section className={`${styles.now} card`}>
        <WeatherIcon code={weather.code} isDay={weather.isDay} size={80} />
        <div className={styles.current}>
          <p className={styles.temp}>{formatTemp(weather.temp)}</p>
          <p className={styles.condition}>{weatherText(weather.code)}</p>
          <p className={styles.city}>{settings.city}</p>
        </div>
        <div className={styles.details}>
          <p>{T.weather.feels(formatTemp(weather.feels))}</p>
          <p>{T.weather.humidity(weather.humidity)}</p>
          <p>{T.weather.wind(Math.trunc(weather.wind + 0.5), settings.units === 'imperial' ? T.weather.mph : T.weather.kmh)}</p>
          <p className={styles.updated}>{T.weather.updated(updated)}</p>
        </div>
      </section>

      <section className={`${styles.hours} card`}>
        {hoursFrom(weather, now).map((h) => (
          <div key={h.time} className={styles.hour}>
            <span className={styles.label}>{h.time <= now ? T.now : formatHour(h.time)}</span>
            <WeatherIcon code={h.code} isDay={isDaytime(h.time)} size={30} />
            <span className={styles.hourTemp}>{formatTemp(h.temp)}</span>
            <span className={styles.rain}>{formatPrecip(h.precip)}</span>
          </div>
        ))}
      </section>

      <section className={styles.days}>
        {daysFrom(weather, now).map((d) => (
          <div key={d.time} className={`${styles.day} card`}>
            <span className={styles.dayName}>{isSameDay(dayTime(d), now) ? T.today : formatWeekday(dayTime(d))}</span>
            <WeatherIcon code={d.code} isDay size={30} />
            <span className={styles.range}>
              <span>{formatTemp(d.hi)}</span> {formatTemp(d.lo)}
            </span>
            <span className={styles.rain}>{formatPrecip(d.precip)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
