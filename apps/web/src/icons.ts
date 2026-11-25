// Material Icons code points, from firmware/main/icons.h.

/** Names the companion may use for shortcut tiles (HUB_ICONS). */
const TILE_ICONS = {
  home: 0xe88a,
  insights: 0xf092,
  memory: 0xe322,
  speed: 0xe9e4,
  music_note: 0xe405,
  event: 0xe878,
  calendar_today: 0xe935,
  wb_sunny: 0xe430,
  cloud: 0xe2bd,
  grid_view: 0xe9b0,
  apps: 0xe5c3,
  wifi: 0xe63e,
  computer: 0xe30a,
  desktop_windows: 0xe30c,
  play_arrow: 0xe037,
  pause: 0xe034,
  skip_next: 0xe044,
  skip_previous: 0xe045,
  volume_up: 0xe050,
  volume_down: 0xe04d,
  volume_off: 0xe04f,
  mic: 0xe029,
  mic_off: 0xe02b,
  lock: 0xe897,
  photo_camera: 0xe412,
  screenshot_monitor: 0xec08,
  terminal: 0xeb8e,
  code: 0xe86f,
  public: 0xe80b,
  folder: 0xe2c7,
  keyboard: 0xe312,
  power_settings_new: 0xe8ac,
  schedule: 0xe8b5,
  timer: 0xe425,
  mail: 0xe158,
  chat: 0xe0b7,
  sports_esports: 0xea28,
  rocket_launch: 0xeb9b,
  bolt: 0xea0b,
  star: 0xe838,
  favorite: 0xe87d,
  settings: 0xe8b8,
  refresh: 0xe5d5,
  dark_mode: 0xe51c,
  headphones: 0xf01f,
  videocam: 0xe04b,
  movie: 0xe02c,
  developer_board: 0xe30d,
  lan: 0xeb2f,
  shuffle: 0xe043,
  repeat: 0xe040,
} as const;

/** The rest of what the pages use. */
const ICONS = {
  ...TILE_ICONS,
  ac_unit: 0xeb3b,
  arrow_downward: 0xe5db,
  arrow_upward: 0xe5d8,
  auto_awesome: 0xe65f,
  close: 0xe5cd,
  commit: 0xeaf5,
  device_thermostat: 0xe1ff,
  foggy: 0xe818,
  grain: 0xe3ea,
  layers: 0xe53b,
  local_fire_department: 0xef55,
  nights_stay: 0xea46,
  open_in_new: 0xe89e,
  replay: 0xe042,
  thunderstorm: 0xebdb,
  umbrella: 0xf1ad,
  view_in_ar: 0xe9fe,
  wb_cloudy: 0xe42d,
  wifi_off: 0xe648,
} as const;

export type IconName = keyof typeof ICONS;

export const glyph = (name: IconName): string => String.fromCodePoint(ICONS[name]);

/** A tile's icon; "apps" for a name the board doesn't know (ui_icon_by_name in ui.c). */
export const tileIcon = (name: string): IconName =>
  Object.hasOwn(TILE_ICONS, name) ? (name as keyof typeof TILE_ICONS) : 'apps';
