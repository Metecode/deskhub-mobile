// A stand-in for a Klipper printer with Moonraker, to try the printer page without a printer:
// the unmodified companion talks to it as to a real one (companion/deskhub/moonraker.py).
//
//   node tools/fake-moonraker.mjs [port]        default 7125, this PC only
//
// and in the companion's config.toml:
//
//   [[printers]]
//   name = "Fake Voron"
//   type = "moonraker"
//   host = "127.0.0.1"
//   port = 7125
//   model = "Voron 2.4"
//
// It prints, pauses and finishes by itself, over and over. To hold a state, open
// http://127.0.0.1:7125/fake?state=paused (standby, heating, printing, paused, complete,
// error, or auto to go on). Ctrl+C stops it: the printer goes offline.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 7125);
const FILE = 'Desk_Organizer.gcode';
/** A print, in seconds of the print itself; it runs this many times faster. */
const ESTIMATED = 90 * 60;
const SPEED = 60;
const LAYERS = 240;
const STATES = ['standby', 'heating', 'printing', 'paused', 'complete', 'error'];

const started = Date.now();
let held = null;

/** Where it is: 10 s heating, 90 s printing with a pause in the middle, 15 s done, 10 s standby. */
function now() {
  const seconds = ((Date.now() - started) / 1000) % 130;
  const half = ESTIMATED / 2;
  const auto =
    seconds < 10 ? { state: 'heating', done: 0 }
    : seconds < 55 ? { state: 'printing', done: (seconds - 10) * SPEED }
    : seconds < 65 ? { state: 'paused', done: half }
    : seconds < 105 ? { state: 'printing', done: half + (seconds - 65) * SPEED }
    : seconds < 120 ? { state: 'complete', done: ESTIMATED }
    : { state: 'standby', done: 0 };
  return held ? { state: held, done: held === 'complete' ? ESTIMATED : held === 'heating' ? 0 : half } : auto;
}

function status() {
  const { state, done } = now();
  const warm = !['standby', 'complete'].includes(state);
  const progress = Math.min(1, done / ESTIMATED);
  const wobble = Math.sin(Date.now() / 3000);
  return {
    webhooks: { state: 'ready', state_message: '' },
    print_stats: {
      // Klipper says "printing" while it heats; nothing extruded yet means preparing.
      state: state === 'heating' ? 'printing' : state,
      filename: state === 'standby' ? '' : FILE,
      print_duration: done,
      filament_used: state === 'heating' ? 0 : done * 3,
      message: state === 'error' ? 'Extruder not heating at expected rate' : '',
      info: { total_layer: LAYERS, current_layer: Math.round(LAYERS * progress) },
    },
    virtual_sdcard: { progress, file_position: 0 },
    display_status: { progress },
    gcode_move: { speed_factor: 1, gcode_position: [0, 0, LAYERS * progress * 0.2, 0] },
    toolhead: { extruder: 'extruder' },
    extruder: { temperature: warm ? 220 + wobble : 26, target: warm ? 220 : 0 },
    heater_bed: { temperature: warm ? 60 + wobble / 4 : 25, target: warm ? 60 : 0 },
    'temperature_sensor chamber': { temperature: warm ? 41 : 25 },
  };
}

const ROUTES = {
  '/printer/info': () => ({ state: 'ready', hostname: 'fake-voron' }),
  '/printer/objects/list': () => ({ objects: Object.keys(status()) }),
  '/printer/objects/query': () => ({ status: status() }),
  '/server/files/metadata': () => ({
    estimated_time: ESTIMATED,
    layer_count: LAYERS,
    layer_height: 0.2,
    first_layer_height: 0.2,
    filament_colors: ['#F0F0F0', '#101010', '#FFB224', '#3A7BFF'],
    filament_type: 'PLA;PLA;PETG;PLA',
  }),
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const answer = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/fake') {
    const state = url.searchParams.get('state');
    if (state !== 'auto' && !STATES.includes(state)) return answer(400, { states: [...STATES, 'auto'] });
    held = state === 'auto' ? null : state;
    console.log(`state: ${state}`);
    return answer(200, { state });
  }
  const route = Object.hasOwn(ROUTES, url.pathname) ? ROUTES[url.pathname] : null;
  if (route) answer(200, { result: route() });
  else answer(404, { error: { code: 404, message: 'Not Found' } });
}).listen(port, '127.0.0.1', () => console.log(`fake Moonraker on http://127.0.0.1:${port}`));
