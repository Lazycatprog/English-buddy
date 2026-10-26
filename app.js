import Anthropic, { jsonSchemaOutputFormat } from "./vendor/anthropic.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem("eb_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("eb_" + k, JSON.stringify(v)); } catch (e) {} }
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Profiles and app settings ----------
const DEFAULT_TALK = { level: "B1", accent: "uk", voice: "female", speed: "1", mode: "gentle", topic: "Свободная беседа", handsFree: false };
const app = Object.assign({ apiKey: "", openaiKey: "", model: "claude-opus-5-5", active: 0 }, store.get("app", {}));
let profiles = store.get("profiles", null) || [
  { name: "Папа", talk: { ...DEFAULT_TALK }, known: {}, mistakes: [], wordTopic: "Работа" },
  { name: "Дочка", talk: { ...DEFAULT_TALK, level: "A2", voice: "child", speed: "0.85" }, known: {}, mistakes: [], wordTopic: "Школа" }
];
const saveApp = () => store.set("app", app);
const saveProfiles = () => store.set("profiles", profiles);
const P = () => profiles[app.active] || profiles[0];
const S = () => P().talk;

const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_RULES = {
  A0: "Absolute beginner. Use only very common words and 3-6 word sentences in the present simple. The learner may write in Russian; if so, show the simple English phrase they need and invite them to repeat it.",
  A1: "Beginner. Short simple sentences (up to 8 words), present simple and continuous, very common past forms.",
  A2: "Elementary. Short clear sentences, everyday vocabulary, past simple and going to.",
  B1: "Intermediate. Natural but clear everyday English, avoid rare idioms.",
  B2: "Upper-intermediate. Natural English with some common idioms and phrasal verbs.",
  C1: "Advanced. Natural, idiomatic, nuanced English.",
  C2: "Proficient. Native-like English with rich vocabulary; wordplay and humour are welcome."
};
const PERSONAS = {
  uk: { female: ["Emma", "28 лет, Лондон"], male: ["Oliver", "32 года, Манчестер"], child: ["Lily", "14 лет, Бристоль"] },
  us: { female: ["Ashley", "27 лет, Чикаго"], male: ["Jake", "31 год, Остин"], child: ["Mia", "14 лет, Сиэтл"] }
};
const LOOKS = {
  female: { hair: "#6b3f22", back: '<path d="M38 88 q-6 -52 42 -54 q48 2 42 54 l2 40 q-12 6 -22 0 l-2 -36 h-40 l-2 36 q-10 6 -22 0z"/>', front: '<path d="M40 78 q6 -38 40 -38 q34 0 40 38 q-24 -16 -52 -12 q-16 2 -28 12z"/>', shirt: "var(--accent)" },
  male: { hair: "#3a2a1e", back: "", front: '<path d="M40 82 q-2 -44 40 -44 q42 0 40 44 q-6 -18 -18 -22 q-22 6 -46 0 q-12 6 -16 22z"/>', shirt: "#3d5a80" },
  child: { hair: "#c7782e", back: '<circle cx="80" cy="34" r="14"/>', front: '<path d="M42 80 q4 -40 38 -40 q34 0 38 40 q-10 -20 -38 -22 q-28 2 -38 22z"/>', shirt: "#c05a8a" }
};

// ---------- Tabs ----------
const tabs = { talk: [$("tab-talk"), $("view-talk")], words: [$("tab-words"), $("view-words")] };
function showTab(name) {
  for (const k in tabs) { tabs[k][0].setAttribute("aria-selected", k === name); tabs[k][1].hidden = k !== name; }
  store.set("tab", name);
  if (name === "words") renderCard();
}
$("tab-talk").onclick = () => showTab("talk");
$("tab-words").onclick = () => showTab("words");
$("toggleSettings").onclick = () => $("sideSettings").classList.toggle("open");

// ---------- Talk settings controls ----------
$("levelSeg").innerHTML = LEVELS.map((l) => `<button data-v="${l}">${l}</button>`).join("");
const segPainters = [];
function bindSeg(id, key, after) {
  const el = $(id);
  const paint = () => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === S()[key]));
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    S()[key] = b.dataset.v; saveProfiles(); paint(); after && after();
  });
  segPainters.push(paint);
}
bindSeg("levelSeg", "level", updatePersona);
bindSeg("accentSeg", "accent", () => { updatePersona(); renderCard(); });
bindSeg("voiceSeg", "voice", () => { updatePersona(); speak(`Hi, I'm ${persona().name}. Nice to meet you!`); });
bindSeg("speedSeg", "speed", () => speak("This is how fast I will speak."));
bindSeg("modeSeg", "mode", renderLog);
$("topic").onchange = () => { S().topic = $("topic").value; saveProfiles(); };
$("handsFree").onchange = () => { S().handsFree = $("handsFree").checked; saveProfiles(); };

function paintControls() {
  segPainters.forEach((p) => p());
  $("topic").value = S().topic;
  $("handsFree").checked = !!S().handsFree;
  updatePersona();
}

function persona() { const p = PERSONAS[S().accent][S().voice]; return { name: p[0], about: p[1] }; }
function updatePersona() {
  const p = persona(), look = LOOKS[S().voice];
  $("avatarName").textContent = p.name;
  $("avatarMeta").textContent = `${S().accent === "uk" ? "British" : "American"} English · ${S().level} · ${p.about}`;
  $("hairBack").innerHTML = look.back; $("hairBack").setAttribute("fill", look.hair);
  $("hairFront").innerHTML = look.front; $("hairFront").setAttribute("fill", look.hair);
  $("shirt").setAttribute("fill", look.shirt);
}

// ---------- Profiles ----------
function renderProfiles() {
  $("profileSel").innerHTML = profiles.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  $("profileSel").value = String(app.active);
}
$("profileSel").onchange = () => {
  app.active = Number($("profileSel").value); saveApp();
  stopConversation(); paintControls(); topicWords = P().wordTopic || "Еда"; buildDeck(); paintTopics(); renderCard(); renderLog();
};

// ---------- Speech synthesis ----------
const synth = window.speechSynthesis;
let voices = [];
function loadVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
const FEMALE = /female|woman|samantha|karen|serena|kate|susan|zira|libby|sonia|jenny|aria|martha|moira|tessa|fiona|victoria|allison|ava|joanna|salli|kimberly|emma|amy|hazel|maisie|michelle|nora/i;
const MALE = /\bmale\b|daniel|alex\b|fred|arthur|oliver|guy|ryan|david|mark|george|tom\b|aaron|james|matthew|joey|justin|brian|thomas|eric|christopher|roger/i;
function pickVoice() {
  const lang = S().accent === "uk" ? "en-gb" : "en-us";
  const norm = (v) => v.lang.replace("_", "-").toLowerCase();
  const same = voices.filter((v) => norm(v) === lang);
  const pool = same.length ? same : voices.filter((v) => norm(v).startsWith("en"));
  const wantMale = S().voice === "male";
  const byGender = pool.filter((v) => wantMale ? MALE.test(v.name) && !/female/i.test(v.name) : FEMALE.test(v.name));
  const best = (list) => list.find((v) => /natural|neural|online|google/i.test(v.name)) || list[0];
  return { voice: best(byGender) || best(pool) || null, exactGender: byGender.length > 0 };
}
function speak(text, rateFactor, onDone) {
  if (!synth || !text) { onDone && onDone(); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const pick = pickVoice();
  if (pick.voice) { u.voice = pick.voice; u.lang = pick.voice.lang; } else u.lang = S().accent === "uk" ? "en-GB" : "en-US";
  u.rate = Number(S().speed) * (rateFactor || 1);
  u.pitch = S().voice === "child" ? 1.45 : S().voice === "male" ? (pick.exactGender ? 1 : 0.7) : 1.05;
  const box = $("avatarBox");
  u.onstart = () => box.classList.add("talking");
  u.onend = () => { box.classList.remove("talking"); onDone && onDone(); };
  u.onerror = () => box.classList.remove("talking");
  synth.speak(u);
}

// ---------- Speech recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null;
function recognize(onInterim) {
  return new Promise((resolve, reject) => {
    if (!SR) return reject("unsupported");
    const rec = new SR();
    activeRec = rec;
    rec.lang = S().accent === "uk" ? "en-GB" : "en-US";
    rec.maxAlternatives = 5; rec.interimResults = !!onInterim;
    let done = false, heard = "";
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      if (r.isFinal) { done = true; resolve(Array.from(r).map((a) => ({ text: a.transcript.trim(), conf: a.confidence }))); }
      else { heard = r[0].transcript; onInterim && onInterim(heard); }
    };
    rec.onerror = (e) => { if (!done) { done = true; reject(e.error || "error"); } };
    // Some Android builds end without a final result; keep what was heard so far.
    rec.onend = () => { activeRec = null; if (!done) { done = true; heard.trim() ? resolve([{ text: heard.trim(), conf: 0 }]) : reject("no-speech"); } };
    try { rec.start(); } catch (err) { reject("error"); }
  });
}
// ---------- Whisper (optional, needs an OpenAI key) ----------
let activeRecorder = null;
async function recordSpeech() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  await ctx.resume().catch(() => {});
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });
  let spoke = false, manual = false, floor = 0;
  const started = performance.now();
  let quietSince = started;
  activeRecorder = { stop() { manual = true; if (rec.state !== "inactive") rec.stop(); }, get state() { return rec.state; } };
  rec.start(250);
  // Stop by itself after 1.8 s of quiet once speech has begun, or when nothing is said.
  const timer = setInterval(() => {
    an.getByteTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
    const now = performance.now();
    // The first 0.4 s measure the room's noise; speech is anything well above it.
    if (now - started < 400) { floor = Math.max(floor, peak); return; }
    if (peak > Math.max(8, floor * 2.5)) { spoke = true; quietSince = now; }
    if ((spoke && now - quietSince > 1800) || now - started > 30000 || (!spoke && now - started > 8000)) {
      if (rec.state !== "inactive") rec.stop();
    }
  }, 100);
  await stopped;
  clearInterval(timer);
  stream.getTracks().forEach((t) => t.stop());
  ctx.close();
  activeRecorder = null;
  if (!spoke && !manual) throw "no-speech";
  return new Blob(chunks, { type: rec.mimeType || "audio/webm" });
}
async function transcribe(blob, key) {
  const fd = new FormData();
  fd.append("file", blob, blob.type.includes("mp4") ? "speech.m4a" : "speech.webm");
  fd.append("model", "whisper-1");
  fd.append("language", "en");
  // Whisper copies the style of its prompt; a learner-like sample keeps grammar mistakes as spoken.
  fd.append("prompt", "Um, yesterday I go to the shop and buyed some bread. My friend don't like it.");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
  if (!res.ok) throw res.status === 401 ? "openai-key" : res.status === 429 ? "openai-limit" : "openai-error";
  return String((await res.json()).text || "").trim();
}

function micError(code) {
  if (code && typeof code === "object") code = code.name === "NotAllowedError" ? "not-allowed" : "error";
  if (code === "openai-key") return "Ключ OpenAI не подошёл. Проверьте его в настройках.";
  if (code === "openai-limit") return "OpenAI не принял запрос: проверьте баланс на platform.openai.com или подождите минуту.";
  if (code === "openai-error") return "Не получилось распознать речь через Whisper. Попробуйте ещё раз.";
  if (code === "no-speech") return "Ничего не услышал. Нажмите на микрофон и скажите ещё раз.";
  if (code === "aborted") return "";
  if (code === "unsupported") return "Этот браузер не распознаёт речь. Откройте приложение в Chrome.";
  if (code === "not-allowed" || code === "service-not-allowed") return "Нет доступа к микрофону. Разрешите его для этого сайта в настройках Chrome.";
  if (code === "network") return "Для распознавания речи нужен интернет.";
  return "Не получилось включить микрофон. Попробуйте ещё раз.";
}

// ---------- Conversation ----------
let messages = [];
let turns = [];
let live = false;
let busy = false;
let ctl = null;
let listening = false;

const EXAMPLE = [
  { role: "bot", text: "Hi! I'm Emma. What did you do last weekend?", ru: "Привет! Я Эмма. Что ты делал в прошлые выходные?" },
  { role: "me", text: "I go to the cinema with my friends.", fix: { corrected: "I went to the cinema with my friends.", explanation: "Речь о прошлых выходных, поэтому нужно прошедшее время: go → went.", mistakes: [{ wrong: "go", right: "went" }] } },
  { role: "bot", text: "Oh, you went to the cinema? Lovely! What film did you see?", ru: "О, ты ходил в кино? Здорово! Какой фильм смотрели?", suggestions: ["We saw a comedy.", "I don't remember the name."] }
];
messages = EXAMPLE.slice();

function fixHtml(f, when) {
  const pairs = (f.mistakes || []).map((m) => `<span><del>${esc(m.wrong)}</del> → <ins>${esc(m.right)}</ins></span>`).join(" · ");
  return `<div class="fix">${when ? `<span class="when">${esc(when)}</span>` : ""}${when && f.original ? `<span>Было: ${esc(f.original)}</span>` : ""}<b>Правильно:</b> <span>${esc(f.corrected)}</span>${pairs ? `<div>${pairs}</div>` : ""}<span>${esc(f.explanation || "")}</span></div>`;
}
function renderLog() {
  let html = "";
  if (!live) html += `<div class="note">Это пример. Выберите уровень, голос и тему и нажмите «Начать разговор».</div>`;
  messages.forEach((m, i) => {
    if (m.role === "note") { html += `<div class="note">${m.html || esc(m.text)}</div>`; return; }
    if (m.role === "me") {
      let extra = "";
      if (m.fix) {
        if (S().mode === "quiet") extra = "";
        else if (S().mode === "gentle" && !m.open) extra = `<button class="fix-chip" data-open="${i}">Есть правка — показать</button>`;
        else extra = fixHtml(m.fix);
      } else if (m.checked) extra = `<span class="ok-chip">Без ошибок</span>`;
      html += `<div class="msg me"><div class="bubble">${esc(m.text)}</div>${extra}</div>`;
      return;
    }
    const last = i === messages.length - 1;
    html += `<div class="msg bot"><div class="bubble">${esc(m.text)}${m.showRu && m.ru ? `<span class="ru">${esc(m.ru)}</span>` : ""}</div>
      <div class="tools"><button data-say="${i}">Повторить</button><button data-slow="${i}">Медленнее</button>${m.ru ? `<button data-ru="${i}">${m.showRu ? "Скрыть перевод" : "Перевести"}</button>` : ""}${last && m.suggestions && m.suggestions.length ? `<button data-hint="${i}">${m.showHints ? "Скрыть подсказки" : "Подсказать ответ"}</button>` : ""}</div>
      ${last && m.showHints && m.suggestions ? `<div class="suggest">${m.suggestions.map((s) => `<button data-use="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}</div>`;
  });
  if (busy) html += `<div class="msg bot"><div class="bubble typing">${esc(persona().name)} думает…</div></div>`;
  $("log").innerHTML = html;
  $("log").scrollTop = $("log").scrollHeight;
}
$("log").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.open) { messages[d.open].open = true; renderLog(); }
  else if (d.say) speak(messages[d.say].text);
  else if (d.slow) speak(messages[d.slow].text, 0.7);
  else if (d.ru) { messages[d.ru].showRu = !messages[d.ru].showRu; renderLog(); }
  else if (d.hint) { messages[d.hint].showHints = !messages[d.hint].showHints; renderLog(); }
  else if (d.use) { $("input").value = d.use; $("input").focus(); }
});

function systemPrompt() {
  const p = persona(), s = S();
  const variety = s.accent === "uk" ? "British" : "American";
  const explainLang = ["A0", "A1", "A2", "B1"].includes(s.level) ? "Russian" : "simple English";
  const modeRule = {
    quiet: "Never mention the learner's errors in your reply; just keep the conversation going.",
    gentle: "Do not point out errors explicitly in your reply; instead naturally reuse the correct form (a recast).",
    strict: "If the learner made an error, start your reply with one short sentence pointing out the main error and the correct form, then continue."
  }[s.mode];
  const who = s.voice === "child"
    ? `You are ${p.name}, a friendly 14-year-old. Talk like a kind teenager about age-appropriate things (school, friends, hobbies, games, music, films, pets). Keep everything suitable for a 12-year-old, and never ask for personal details such as addresses, phone numbers, photos or the name of their school.`
    : `You are ${p.name}, a warm, curious adult conversation partner.`;
  return `${who}
You are the conversation partner in an English-learning app for Russian speakers. The learner's name is ${P().name}. Speak ${variety} English (spelling and vocabulary). Never treat the other variety of English as a mistake.
Learner level (CEFR): ${s.level}. ${LEVEL_RULES[s.level]}
Topic or scenario: ${s.topic} (the topic name is in Russian; play the scenario in English and take the natural role in it).
Your reply: 1-3 short sentences suited to the level, ending with a question that keeps the conversation going. It will be read aloud, so use no emoji, lists or formatting. ${modeRule}
The learner usually speaks through speech recognition, so ignore capitalisation, punctuation and words that look like recognition slips. Check ONLY the learner's latest message for grammar, vocabulary and word-choice errors. If it is correct or natural enough, set has_error to false and leave the other correction fields empty.
Fill reply_ru with a Russian translation of your reply, the correction explanation in ${explainLang} (1-2 sentences), and suggestions with two short answers the learner could give next, at their level.`;
}
const REPLY_FORMAT = jsonSchemaOutputFormat({
  type: "object",
  properties: {
    reply: { type: "string" },
    reply_ru: { type: "string" },
    correction: {
      type: "object",
      properties: {
        has_error: { type: "boolean" },
        corrected: { type: "string" },
        explanation: { type: "string" },
        mistakes: { type: "array", items: { type: "object", properties: { wrong: { type: "string" }, right: { type: "string" } }, required: ["wrong", "right"], additionalProperties: false } }
      },
      required: ["has_error", "corrected", "explanation", "mistakes"],
      additionalProperties: false
    },
    suggestions: { type: "array", items: { type: "string" } }
  },
  required: ["reply", "reply_ru", "correction", "suggestions"],
  additionalProperties: false
});

function client() { return new Anthropic({ apiKey: app.apiKey, dangerouslyAllowBrowser: true }); }
async function callClaude(msgs, signal) {
  const isOpus = app.model.startsWith("claude-opus");
  const params = {
    model: app.model,
    max_tokens: 4000,
    system: systemPrompt(),
    messages: msgs,
    output_config: { effort: "low", format: { type: REPLY_FORMAT.type, schema: REPLY_FORMAT.schema } }
  };
  if (isOpus) { params.betas = ["server-side-fallback-2026-07-01"]; params.fallbacks = "default"; }
  const res = await client().beta.messages.create(params, { signal });
  if (res.stop_reason === "refusal") throw { kind: "refusal" };
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

function errorText(e) {
  if (e && e.kind === "refusal") return "Собеседник не стал отвечать на это сообщение. Попробуйте сказать иначе.";
  if (e instanceof Anthropic.AuthenticationError) return "Ключ API не подошёл. Проверьте его в настройках.";
  if (e instanceof Anthropic.PermissionDeniedError) return "У ключа нет доступа к этой модели. Выберите другую модель в настройках.";
  if (e instanceof Anthropic.RateLimitError) return "Слишком много запросов подряд. Подождите минуту.";
  if (e instanceof Anthropic.BadRequestError) return /credit|balance/i.test(e.message) ? "На счёте закончились деньги. Пополните баланс на console.anthropic.com." : "Запрос не прошёл. Попробуйте ещё раз.";
  if (e instanceof Anthropic.APIConnectionError) return "Нет связи с сервером. Проверьте интернет.";
  if (e instanceof Anthropic.APIError) return `Сервер ответил ошибкой (${e.status}). Попробуйте ещё раз.`;
  if (e instanceof SyntaxError) return "Ответ пришёл в странном виде. Отправьте сообщение ещё раз.";
  return "Ответ не пришёл. Отправьте сообщение ещё раз.";
}

async function ask(userText) {
  busy = true; setStatus(""); renderLog(); updateComposer();
  ctl = new AbortController();
  turns.push({ role: "user", content: userText || "(The learner has just opened the conversation. Greet them briefly, introduce yourself and ask the first question for this topic. There is nothing to correct yet.)" });
  let recent = turns.slice(-16);
  while (recent.length && recent[0].role !== "user") recent = recent.slice(1);
  try {
    const data = await callClaude(recent, ctl.signal);
    const reply = String(data.reply || "").trim();
    if (!reply) throw new SyntaxError("empty");
    turns.push({ role: "assistant", content: reply });
    if (userText) {
      const me = messages[messages.length - 1];
      me.checked = true;
      const c = data.correction;
      if (c && c.has_error && c.corrected && c.corrected.trim().toLowerCase() !== userText.trim().toLowerCase()) {
        me.fix = { original: userText, corrected: c.corrected, explanation: c.explanation, mistakes: Array.isArray(c.mistakes) ? c.mistakes : [] };
        P().mistakes.push({ ...me.fix, at: new Date().toISOString() });
        if (P().mistakes.length > 300) P().mistakes.splice(0, P().mistakes.length - 300);
        saveProfiles();
      }
    }
    messages.push({ role: "bot", text: reply, ru: data.reply_ru, suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3).map(String) : [] });
    busy = false; renderLog(); updateComposer();
    speak(reply, 1, () => { if (live && S().handsFree && !busy) listen(); });
    return;
  } catch (e) {
    busy = false;
    turns.pop();
    if (!(e && e.name === "AbortError") && !(e instanceof Anthropic.APIUserAbortError)) {
      messages.push({ role: "note", text: errorText(e) });
      if (userText) { $("input").value = userText; messages.splice(messages.length - 2, 1); }
    }
    renderLog();
  }
  updateComposer();
}

function setStatus(t) { $("status").textContent = t; }
function updateComposer() {
  const on = live && !busy;
  $("input").disabled = !on; $("sendBtn").disabled = !on; $("micBtn").disabled = !on;
  $("input").placeholder = live ? "Скажите или напишите по-английски…" : "Сначала нажмите «Начать разговор»";
}
function stopConversation() {
  if (ctl) ctl.abort();
  if (activeRec) try { activeRec.abort(); } catch (e) {}
  if (activeRecorder) try { activeRecorder.stop(); } catch (e) {}
  if (synth) synth.cancel();
  live = false; busy = false; messages = EXAMPLE.slice(); turns = [];
  $("chatTitle").textContent = "Пример диалога"; $("startBtn").textContent = "Начать разговор";
  updateComposer();
}

$("startBtn").onclick = () => {
  if (!app.apiKey) { openSettings(); return; }
  if (ctl) ctl.abort();
  if (synth) synth.cancel();
  live = true; messages = []; turns = [];
  $("chatTitle").textContent = `${persona().name} · ${S().topic}`;
  $("startBtn").textContent = "Начать заново";
  $("sideSettings").classList.remove("open");
  ask(null);
};
function send(text) {
  const t = (text ?? $("input").value).trim();
  if (!t || !live || busy) return;
  $("input").value = ""; $("alts").hidden = true; updateSendReady(); setStatus("");
  messages.push({ role: "me", text: t });
  ask(t);
}
$("sendBtn").onclick = () => send();
$("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

function showAlts(base, alts) {
  const box = $("alts");
  const seen = new Set([alts[0].text.toLowerCase()]);
  const others = alts.slice(1).filter((a) => a.text && !seen.has(a.text.toLowerCase()) && seen.add(a.text.toLowerCase())).slice(0, 3);
  if (!others.length) { box.hidden = true; return; }
  box.innerHTML = `<span>Или вы сказали:</span>` + others.map((a) => `<button data-alt="${esc(base + a.text)}">${esc(a.text)}</button>`).join("");
  box.hidden = false;
}
$("alts").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-alt]"); if (!b) return;
  $("input").value = b.dataset.alt; $("alts").hidden = true; updateSendReady(); $("input").focus();
});
function updateSendReady() { $("sendBtn").classList.toggle("ready", !!$("input").value.trim()); }
$("input").addEventListener("input", updateSendReady);

async function listen() {
  if (listening || !live || busy) return;
  listening = true;
  if (synth) synth.cancel();
  $("alts").hidden = true;
  const typed = $("input").value.trim();
  const base = typed ? typed + " " : "";
  $("micBtn").classList.add("rec"); $("avatarBox").classList.add("listening"); setStatus("Слушаю… Нажмите микрофон ещё раз, чтобы закончить");
  try {
    let alts;
    if (app.openaiKey) {
      const blob = await recordSpeech();
      setStatus("Распознаю…");
      const text = await transcribe(blob, app.openaiKey);
      if (!text) throw "no-speech";
      alts = [{ text, conf: 1 }];
    } else alts = await recognize((t) => { $("input").value = base + t; });
    $("input").value = base + alts[0].text;
    updateSendReady();
    if (S().handsFree) { setStatus(""); send(); }
    else { showAlts(base, alts); setStatus("Проверьте текст и нажмите «Отправить»"); }
  } catch (err) { $("input").value = typed; setStatus(micError(err)); }
  listening = false;
  $("micBtn").classList.remove("rec"); $("avatarBox").classList.remove("listening");
}
$("micBtn").onclick = () => {
  if (!listening) return listen();
  try { if (activeRecorder && activeRecorder.state !== "inactive") activeRecorder.stop(); else if (activeRec) activeRec.stop(); } catch (e) {}
};

function plural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }
$("reportBtn").onclick = () => {
  const said = messages.filter((m) => m.role === "me" && m.checked);
  const fixes = said.filter((m) => m.fix);
  if (!live || !said.length) { setStatus("Пока нечего подводить"); return; }
  messages.push({ role: "note", html: `<div class="report"><h3>Итоги: ${said.length} ${plural(said.length, "реплика", "реплики", "реплик")}, ${fixes.length} ${plural(fixes.length, "правка", "правки", "правок")}</h3>${fixes.map((m) => fixHtml(m.fix)).join("") || "<span>Ошибок не было. Отлично!</span>"}</div>` });
  renderLog();
};
$("historyBtn").onclick = () => {
  const list = P().mistakes.slice(-20).reverse();
  const fmt = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  messages.push({ role: "note", html: `<div class="report"><h3>Последние ошибки: ${esc(P().name)}</h3>${list.map((m) => fixHtml(m, fmt(m.at))).join("") || "<span>Пока ни одной. Начните разговор, и ошибки будут собираться здесь.</span>"}</div>` });
  renderLog();
};

// ---------- Settings dialog ----------
function openSettings() {
  $("apiKey").value = app.apiKey; $("model").value = app.model; $("openaiKey").value = app.openaiKey;
  $("testOpenai").textContent = "Проверить ключ OpenAI";
  $("name0").value = profiles[0].name; $("name1").value = profiles[1].name;
  $("testStatus").textContent = "";
  $("settingsDlg").showModal();
}
$("settingsBtn").onclick = openSettings;
$("bannerBtn").onclick = openSettings;
$("settingsDlg").addEventListener("close", () => {
  if ($("settingsDlg").returnValue !== "save") return;
  app.apiKey = $("apiKey").value.trim(); app.model = $("model").value; app.openaiKey = $("openaiKey").value.trim().startsWith("sk-ant-") ? "" : $("openaiKey").value.trim(); saveApp();
  profiles[0].name = $("name0").value.trim() || profiles[0].name;
  profiles[1].name = $("name1").value.trim() || profiles[1].name;
  saveProfiles(); renderProfiles(); updateBanner();
});
$("testKey").onclick = async () => {
  const key = $("apiKey").value.trim();
  if (!key) { $("testStatus").textContent = "Вставьте ключ"; return; }
  $("testStatus").textContent = "Проверяю…";
  try {
    const c = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    await c.messages.create({ model: $("model").value, max_tokens: 16, messages: [{ role: "user", content: "Say OK." }] });
    $("testStatus").textContent = "Ключ работает";
  } catch (e) { $("testStatus").textContent = errorText(e); }
};
$("testOpenai").onclick = async () => {
  const key = $("openaiKey").value.trim();
  if (!key) { $("testStatus").textContent = "Вставьте ключ OpenAI"; return; }
  if (key.startsWith("sk-ant-")) { $("testStatus").textContent = "Это ключ Claude, а нужен ключ OpenAI (с platform.openai.com)"; return; }
  $("testStatus").textContent = "Проверяю…";
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + key } });
    $("testStatus").textContent = res.ok ? "Ключ OpenAI работает" : res.status === 401 ? "Ключ OpenAI не подошёл" : `OpenAI ответил ошибкой (${res.status})`;
  } catch (e) { $("testStatus").textContent = "Нет связи с OpenAI. Проверьте интернет."; }
};
function updateBanner() { $("keyBanner").hidden = !!app.apiKey; }

// ---------- Words ----------
const W = (uk, us, ipaUk, ipaUs, tr, ex) => ({ uk, us: us || uk, ipaUk, ipaUs: ipaUs || ipaUk, tr, ex });
const TOPICS = {
  "Еда": [
    W("apple", 0, "ˈæp.əl", 0, "яблоко", "I have an apple for lunch."),
    W("bread", 0, "bred", 0, "хлеб", "Can you buy some bread?"),
    W("cheese", 0, "tʃiːz", 0, "сыр", "This cheese is from France."),
    W("tomato", 0, "təˈmɑː.təʊ", "təˈmeɪ.t̬oʊ", "помидор", "Add a tomato to the salad."),
    W("water", 0, "ˈwɔː.tə", "ˈwɑː.t̬ɚ", "вода", "A glass of water, please."),
    W("breakfast", 0, "ˈbrek.fəst", 0, "завтрак", "What do you usually have for breakfast?"),
    W("vegetables", 0, "ˈvedʒ.tə.bəlz", 0, "овощи", "Eat more vegetables."),
    W("delicious", 0, "dɪˈlɪʃ.əs", 0, "очень вкусный", "The soup is delicious!")
  ],
  "Путешествия": [
    W("airport", 0, "ˈeə.pɔːt", "ˈer.pɔːrt", "аэропорт", "We need to be at the airport by six."),
    W("ticket", 0, "ˈtɪk.ɪt", 0, "билет", "I bought a return ticket."),
    W("luggage", "baggage", "ˈlʌɡ.ɪdʒ", "ˈbæɡ.ɪdʒ", "багаж", "Where can I collect my luggage?"),
    W("passport", 0, "ˈpɑːs.pɔːt", "ˈpæs.pɔːrt", "паспорт", "Don't forget your passport."),
    W("journey", "trip", "ˈdʒɜː.ni", "trɪp", "поездка", "How was your journey?"),
    W("map", 0, "mæp", 0, "карта", "Let's look at the map."),
    W("hotel", 0, "həʊˈtel", "hoʊˈtel", "гостиница", "Our hotel is near the beach."),
    W("abroad", 0, "əˈbrɔːd", "əˈbrɑːd", "за границей", "Have you ever been abroad?")
  ],
  "Школа": [
    W("teacher", 0, "ˈtiː.tʃə", "ˈtiː.tʃɚ", "учитель", "Our English teacher is very kind."),
    W("homework", 0, "ˈhəʊm.wɜːk", "ˈhoʊm.wɝːk", "домашнее задание", "I finished my homework early."),
    W("lesson", 0, "ˈles.ən", 0, "урок", "The lesson starts at nine."),
    W("subject", 0, "ˈsʌb.dʒekt", 0, "школьный предмет", "What's your favourite subject?"),
    W("exam", 0, "ɪɡˈzæm", 0, "экзамен", "I have a maths exam tomorrow."),
    W("friend", 0, "frend", 0, "друг, подруга", "She is my best friend."),
    W("library", 0, "ˈlaɪ.brər.i", "ˈlaɪ.brer.i", "библиотека", "Let's study in the library."),
    W("break", "recess", "breɪk", "ˈriː.ses", "перемена", "We play outside at break.")
  ],
  "Дом": [
    W("kitchen", 0, "ˈkɪtʃ.ən", 0, "кухня", "Mum is cooking in the kitchen."),
    W("flat", "apartment", "flæt", "əˈpɑːrt.mənt", "квартира", "They live in a small flat."),
    W("window", 0, "ˈwɪn.dəʊ", "ˈwɪn.doʊ", "окно", "Please open the window."),
    W("chair", 0, "tʃeə", "tʃer", "стул", "Take a chair and sit down."),
    W("garden", "yard", "ˈɡɑː.dən", "jɑːrd", "сад, двор", "The kids are playing in the garden."),
    W("neighbour", "neighbor", "ˈneɪ.bə", "ˈneɪ.bɚ", "сосед", "Our neighbour has a big dog."),
    W("stairs", 0, "steəz", "sterz", "лестница", "Go up the stairs."),
    W("bathroom", 0, "ˈbɑːθ.ruːm", "ˈbæθ.ruːm", "ванная", "The bathroom is on the left.")
  ],
  "Хобби": [
    W("music", 0, "ˈmjuː.zɪk", 0, "музыка", "What music do you like?"),
    W("football", "soccer", "ˈfʊt.bɔːl", "ˈsɑː.kɚ", "футбол", "We play football on Saturdays."),
    W("draw", 0, "drɔː", "drɑː", "рисовать", "I like to draw animals."),
    W("guitar", 0, "ɡɪˈtɑː", "ɡɪˈtɑːr", "гитара", "My brother plays the guitar."),
    W("dance", 0, "dɑːns", "dæns", "танцевать", "Do you like to dance?"),
    W("film", "movie", "fɪlm", "ˈmuː.vi", "фильм", "Let's watch a film tonight."),
    W("photo", 0, "ˈfəʊ.təʊ", "ˈfoʊ.t̬oʊ", "фотография", "Can I take a photo?"),
    W("thing", 0, "θɪŋ", 0, "вещь", "My favourite thing is my phone.")
  ],
  "Работа": [
    W("job", 0, "dʒɒb", "dʒɑːb", "работа", "I started a new job in May."),
    W("meeting", 0, "ˈmiː.tɪŋ", "ˈmiː.t̬ɪŋ", "встреча, совещание", "The meeting is at ten."),
    W("colleague", "coworker", "ˈkɒl.iːɡ", "ˈkoʊ.wɝː.kɚ", "коллега", "My colleague helped me."),
    W("salary", 0, "ˈsæl.ər.i", 0, "зарплата", "The salary is good."),
    W("deadline", 0, "ˈded.laɪn", 0, "крайний срок", "The deadline is Friday."),
    W("schedule", 0, "ˈʃedʒ.uːl", "ˈskedʒ.uːl", "расписание, график", "Let me check my schedule."),
    W("interview", 0, "ˈɪn.tə.vjuː", "ˈɪn.t̬ɚ.vjuː", "собеседование", "I have a job interview tomorrow."),
    W("experience", 0, "ɪkˈspɪə.ri.əns", "ɪkˈspɪr.i.əns", "опыт", "Do you have any experience?")
  ]
};
let topicWords = TOPICS[P().wordTopic] ? P().wordTopic : "Еда";
let deck = [];
function buildDeck() {
  const all = TOPICS[topicWords];
  deck = all.filter((w) => !P().known[w.uk]);
  if (!deck.length) deck = all.slice();
}
$("topics").innerHTML = Object.keys(TOPICS).map((t) => `<button data-t="${t}">${t}</button>`).join("");
function paintTopics() { $("topics").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === topicWords)); }
$("topics").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  topicWords = b.dataset.t; P().wordTopic = topicWords; saveProfiles(); paintTopics(); buildDeck(); renderCard();
});
const current = () => deck[0];
const wordText = (w) => S().accent === "uk" ? w.uk : w.us;
function example(w) { return w.uk !== w.us && S().accent === "us" ? w.ex.replace(new RegExp("\\b" + w.uk + "\\b", "i"), w.us) : w.ex; }
function renderCard() {
  const w = current(); if (!w) return;
  const uk = S().accent === "uk";
  const all = TOPICS[topicWords], done = all.filter((x) => P().known[x.uk]).length;
  $("count").textContent = `${topicWords} · выучено ${done} из ${all.length}`;
  $("word").textContent = wordText(w);
  $("ipa").innerHTML = `/${esc(uk ? w.ipaUk : w.ipaUs)}/<small>${uk ? "UK" : "US"}</small>`;
  const differs = w.uk !== w.us;
  $("variant").hidden = !differs;
  if (differs) $("variant").textContent = uk ? `В американском: ${w.us}` : `В британском: ${w.uk}`;
  $("tr").textContent = w.tr;
  $("ex").innerHTML = `<i>${esc(example(w))}</i>`;
  $("score").innerHTML = "";
}
$("listenBtn").onclick = () => speak(wordText(current()));
$("slowBtn").onclick = () => { const w = current(); speak(wordText(w) + ". " + example(w), 0.65); };
$("knowBtn").onclick = () => { const w = deck.shift(); P().known[w.uk] = Date.now(); saveProfiles(); if (!deck.length) buildDeck(); renderCard(); };
$("againBtn").onclick = () => { deck.push(deck.shift()); renderCard(); };

function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function scoreOf(target, alts) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z' ]/g, " ").trim();
  const t = clean(target);
  let best = { score: 0, heard: alts[0] ? alts[0].text : "" };
  for (const a of alts) {
    const heard = clean(a.text);
    const words = heard.split(/\s+/);
    let s;
    if (words.includes(t) || heard === t) s = Math.round(75 + 25 * (a.conf > 0 ? a.conf : 0.85));
    else {
      const closest = Math.min(...words.map((w) => lev(w, t)), lev(heard, t));
      s = Math.max(0, Math.round((1 - closest / Math.max(t.length, 1)) * 65));
    }
    if (s > best.score) best = { score: Math.min(s, 100), heard: a.text };
  }
  return best;
}
function tipsFor(ipa) {
  const tips = [];
  if (/θ|ð/.test(ipa)) tips.push("Звук th: кончик языка между зубами, выдыхайте воздух. Не заменяйте его на «с» или «ф».");
  if (/(^|\.)w|ˈw/.test(ipa)) tips.push("Звук w: губы вытянуты трубочкой и быстро раскрываются, это не русское «в».");
  if (/æ/.test(ipa)) tips.push("Звук æ: рот широко открыт, что-то среднее между «э» и «а».");
  if (/ŋ/.test(ipa)) tips.push("Звук ŋ: «н» задней частью языка, без «г» на конце.");
  if (/ɜː|ɝ/.test(ipa)) tips.push("Звук ɜː: губы расслаблены, похоже на «ё» без «й».");
  if (/ɚ|r/.test(ipa) && S().accent === "us") tips.push("В американском r звучит: кончик языка загнут назад и ничего не касается.");
  if (/[bdgvz]$/.test(ipa.replace(/[ːˈ.]/g, ""))) tips.push("Звонкий звук на конце не оглушайте, как в русском.");
  return tips[0] || "Послушайте медленный вариант и обратите внимание на ударный слог (знак ˈ в транскрипции).";
}
$("sayBtn").onclick = async () => {
  const w = current(), target = wordText(w), btn = $("sayBtn");
  if (synth) synth.cancel();
  btn.disabled = true; btn.textContent = "Слушаю…";
  $("score").innerHTML = `<span class="tip">Скажите: <b>${esc(target)}</b></span>`;
  try {
    const r = scoreOf(target, await recognize());
    const verdict = r.score >= 85 ? "Отлично!" : r.score >= 60 ? "Почти получилось" : "Попробуйте ещё раз";
    const ipa = S().accent === "uk" ? w.ipaUk : w.ipaUs;
    $("score").innerHTML = `<div class="num">${r.score}%</div><div class="meter"><i style="width:${r.score}%"></i></div>
      <div><b>${verdict}</b> · распознано как «${esc(r.heard)}»</div>${r.score < 85 ? `<div class="tip">${esc(tipsFor(ipa))}</div>` : ""}`;
  } catch (err) {
    $("score").innerHTML = `<div class="tip">${esc(micError(err))}</div>`;
  }
  btn.disabled = false; btn.textContent = "Произнести";
};

// ---------- Start ----------
renderProfiles(); paintControls(); buildDeck(); paintTopics(); renderLog(); updateComposer(); updateBanner();
if (store.get("tab", "talk") === "words") showTab("words"); else renderCard();
