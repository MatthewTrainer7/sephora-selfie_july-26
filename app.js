/* Sephora Selfie — D6 on-screen app.
 *
 * Fixed 70s timeline (Scala relaunches the app every 70s):
 *   0–10s   main-message.png
 *   10–30s  user-image.png + approved selfie #1
 *   30–50s  user-image.png + approved selfie #2
 *   50–70s  user-image.png + approved selfie #3
 *
 * The 3 selfies come from the Sephora WebSocket server as
 *   {"imageURLs":["<key>","<key>","<key>"]}
 * sent on connect, so all screens stay in sync. Keys are rendered via CloudFront.
 *
 * Target runtime: Chromium CEF 73 — do NOT use optional chaining (?.),
 * nullish coalescing (??), or flexbox `gap` (none are needed below).
 */

// ── Config ────────────────────────────────────────────────────────────────
// Production (D6 players):
var WS_URL = 'wss://ws.deepscreen.co.uk:8087';
// For local testing, comment the line above and uncomment:
// var WS_URL = 'ws://localhost:8087';

var CDN_BASE = 'https://d1c2uj08dz0npl.cloudfront.net/';

var MAIN_MS = 10000; // main-message duration
var SLOT_MS = 20000; // per-selfie duration (3 slots = 60s)

// ── State ─────────────────────────────────────────────────────────────────
var imageKeys = [];      // current trio of S3 keys from the server
var currentSlot = -1;    // slot index currently being displayed (0–2), -1 before image phase

// ── Elements ──────────────────────────────────────────────────────────────
var mainMessageEl = document.getElementById('main-message');
var frameEl = document.getElementById('frame');
var selfieEl = document.getElementById('selfie');

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ── WebSocket ───────────────────────────────────────────────────────────────
function connect() {
  var ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.error('WS connect failed:', e && e.message);
    return;
  }

  ws.onmessage = function (event) {
    try {
      var data = JSON.parse(event.data);
      if (data && Array.isArray(data.imageURLs)) {
        imageKeys = data.imageURLs;
        preload(imageKeys);
        // If we're already in the image phase, refresh the current slot so a
        // late message self-heals the display.
        if (currentSlot >= 0) showSlot(currentSlot);
      }
    } catch (e) {
      console.error('Bad WS message:', e && e.message);
    }
  };

  ws.onerror = function () { console.error('WS error'); };
}

function preload(keys) {
  for (var i = 0; i < keys.length; i++) {
    var img = new Image();
    img.src = CDN_BASE + keys[i];
  }
}

// ── Display ───────────────────────────────────────────────────────────────
function showSlot(i) {
  currentSlot = i;
  if (imageKeys[i]) {
    selfieEl.src = CDN_BASE + imageKeys[i];
    show(selfieEl);
  } else {
    // No image for this slot (e.g. nothing approved yet) — frame only.
    hide(selfieEl);
  }
}

function startImagePhase() {
  hide(mainMessageEl);
  show(frameEl);
  showSlot(0);
  setTimeout(function () { showSlot(1); }, SLOT_MS);
  setTimeout(function () { showSlot(2); }, SLOT_MS * 2);
}

// ── Boot ────────────────────────────────────────────────────────────────────
connect();                                   // start receiving the trio immediately
show(mainMessageEl);                         // 0–10s
setTimeout(startImagePhase, MAIN_MS);        // 10s → image phase
// At 70s the app is relaunched by Scala; nothing more to do.
