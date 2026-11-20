const { Client, Account, ID } = Appwrite;
const account = new Account(new Client().setEndpoint(CFG.endpoint).setProject(CFG.project));
const $ = s => document.querySelector(s);
const app = $("#app");
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let tm; const sfx = { click() {} };
const GI = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

/* ---------- Helpers ---------- */
function view(h) { clearInterval(tm); app.innerHTML = h; scrollTo(0, 0); }
const msg = (t, ok) => { const m = $("#msg"); if (m) { m.textContent = t; m.className = "msg" + (ok ? " ok" : ""); } };
const shell = (title, body) => view(`<section class="card"><img class="mark" src="logo.svg" alt="Nesty Languages"><h1>${title}</h1>${body}<p id="msg" class="msg" role="alert"></p></section>`);
const sendCode = (id, em) => account.createEmailToken(id, em);

/* ---------- Sign in ---------- */
function signIn() {
  shell("Welcome back", `<input id="e" type="email" placeholder="Email" autocomplete="email"><input id="p" type="password" placeholder="Password" autocomplete="current-password"><button id="go" class="btn">Sign in</button><div class="or">or</div><button id="gg" class="btn gbtn">${GI} Continue with Google</button><button id="fg" class="link">Reset password</button><button id="su" class="link">New here? Create account</button>`);
  $("#su").onclick = signUp; $("#fg").onclick = forgot; $("#gg").onclick = google;
  $("#go").onclick = async ev => {
    const em = $("#e").value.trim(), pw = $("#p").value;
    if (!em || !pw) return msg("Enter your email and password.");
    ev.target.disabled = true;
    try {
      await account.createEmailPasswordSession(em, pw);
      const u = await account.get();
      if (!u.emailVerification) {
        await account.deleteSession("current");
        await sendCode(u.$id, em);
        return codeView(u.$id, em);
      }
      after(u, true);
    } catch (err) {
      msg(err.code === 401 ? "Wrong email or password." : "Problem: " + (err.message || "unknown error"));
      ev.target.disabled = false;
    }
  };
}

/* ---------- Create account ---------- */
function signUp() {
  shell("Create account", `<input id="u" placeholder="Username (3–16 letters or numbers)" maxlength="16" autocomplete="username"><input id="p" type="password" placeholder="Password (at least 8 characters)" autocomplete="new-password"><input id="c" type="password" placeholder="Confirm password" autocomplete="new-password"><input id="e" type="email" placeholder="Email" autocomplete="email"><p class="fine">By creating an account you agree to our <a href="#" data-l="terms">Terms</a> and <a href="#" data-l="privacy">Privacy Policy</a>.</p><button id="go" class="btn">Verify email</button><div class="or">or</div><button id="gg" class="btn gbtn">${GI} Continue with Google</button><button id="si" class="link">I already have an account</button>`);
  $("#si").onclick = signIn; $("#gg").onclick = google; bindLegal();
  $("#go").onclick = async ev => {
    const un = $("#u").value.trim(), p = $("#p").value, c = $("#c").value, em = $("#e").value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(un)) return msg("Username must be 3–16 letters, numbers or _.");
    if (p.length < 8) return msg("Password must have at least 8 characters.");
    if (p !== c) return msg("The two passwords do not match.");
    if (!/^\S+@\S+\.\S+$/.test(em)) return msg("Enter a valid email.");
    ev.target.disabled = true;
    try {
      const u = await account.create(ID.unique(), em, p, un);
      await sendCode(u.$id, em);
      codeView(u.$id, em);
    } catch (err) {
      msg(err.code === 409 ? "That email already has an account. Sign in instead." : "Problem: " + (err.message || "unknown error"));
      ev.target.disabled = false;
    }
  };
}

/* ---------- Verify code ---------- */
function codeView(id, em) {
  shell("Enter your code", `<p class="sub">We sent a 6-digit code to ${esc(em)}.</p><input id="k" inputmode="numeric" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code"><button id="go" class="btn">Confirm</button><button id="rs" class="link" disabled></button>`);
  let left = 120; const rs = $("#rs");
  const tick = () => {
    rs.disabled = left > 0;
    rs.textContent = left > 0 ? `Resend code in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Resend code";
    if (left > 0) left--;
  };
  tick(); tm = setInterval(tick, 1000);
  rs.onclick = async () => {
    left = 120; tick();
    try { await sendCode(id, em); msg("New code sent.", true); } catch (e) { msg("Could not send a new code. Try again soon."); }
  };
  $("#go").onclick = async ev => {
    const k = $("#k").value.trim();
    if (!/^\d{6}$/.test(k)) return msg("Enter the 6-digit code.");
    ev.target.disabled = true;
    try {
      await account.createSession(id, k);
      const u = await account.get();
      after(u, true);
    } catch (e) { msg("That code is wrong or has expired."); ev.target.disabled = false; }
  };
}

/* ---------- Profile picture ---------- */
const EMO = ["🦁", "🐯", "🦊", "🐼", "🐸", "🦉", "🐲", "🦄", "🚀", "⚡", "🎮", "👑"];
const av = (p, c = "") => p.pic ? `<img class="avp ${c}" src="${p.pic}" alt="">` : `<span class="avp ${c}">${esc(p.avatar || "🙂")}</span>`;
function pickPhoto(file) {
  return new Promise((res, rej) => {
    const im = new Image(), url = URL.createObjectURL(file);
    im.onload = () => {
      const s = 160, c = document.createElement("canvas"), m = Math.min(im.width, im.height);
      c.width = c.height = s;
      c.getContext("2d").drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", .75));
    };
    im.onerror = rej; im.src = url;
  });
}
function avatarView(u) {
  let pick = EMO[0], pic = "";
  shell("Choose your picture", `<div class="avs">${EMO.map((a, i) => `<button data-a="${a}" class="${i ? "" : "on"}">${a}</button>`).join("")}</div><input id="ph" type="file" accept="image/*" hidden><button id="gal" class="btn ghost">Choose from gallery</button><button id="go" class="btn">Save and continue</button>`);
  document.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    pick = b.dataset.a; pic = ""; $("#gal").textContent = "Choose from gallery";
    document.querySelectorAll("[data-a]").forEach(x => x.classList.toggle("on", x === b));
  });
  $("#gal").onclick = () => $("#ph").click();
  $("#ph").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { pic = await pickPhoto(f); $("#gal").textContent = "Photo selected ✓"; document.querySelectorAll("[data-a]").forEach(x => x.classList.remove("on")); }
    catch (er) { msg("That picture could not be used."); }
  };
  $("#go").onclick = async () => {
    const np = { ...u.prefs, avatar: pick, pic };
    try { await account.updatePrefs(np); } catch (e) {}
    home({ ...u, prefs: np });
  };
}

/* ---------- Reset password ---------- */
function forgot() {
  shell("Reset password", `<p class="sub">Enter your email and we will send a reset link if it has an account.</p><input id="e" type="email" placeholder="Email" autocomplete="email"><button id="go" class="btn">Send reset link</button><button id="si" class="link">Back to sign in</button>`);
  $("#si").onclick = signIn;
  $("#go").onclick = async ev => {
    const em = $("#e").value.trim();
    if (!em) return msg("Enter your email.");
    ev.target.disabled = true;
    try { await account.createRecovery(em, location.origin + location.pathname); } catch (e) {}
    msg("If that email has an account, a reset link is on its way.", true);
    setTimeout(() => ev.target.disabled = false, 30000);
  };
}
function resetView(userId, secret) {
  shell("New password", `<input id="p" type="password" placeholder="New password (at least 8 characters)" autocomplete="new-password"><input id="c" type="password" placeholder="Confirm new password" autocomplete="new-password"><button id="go" class="btn">Save password</button>`);
  $("#go").onclick = async ev => {
    const p = $("#p").value;
    if (p.length < 8) return msg("Password must have at least 8 characters.");
    if (p !== $("#c").value) return msg("The two passwords do not match.");
    ev.target.disabled = true;
    try {
      await account.updateRecovery(userId, secret, p);
      history.replaceState(null, "", location.pathname);
      signIn(); msg("Password changed. Sign in with your new password.", true);
    } catch (e) { msg("This reset link is invalid or has expired. Request a new one."); ev.target.disabled = false; }
  };
}

/* ---------- Data ---------- */
const VOICE = { English: "en", Kiswahili: "sw", French: "fr", Spanish: "es", German: "de", Portuguese: "pt", Italian: "it", Arabic: "ar", Chinese: "zh-CN", Japanese: "ja", Korean: "ko", Hindi: "hi", Russian: "ru", Turkish: "tr", Dutch: "nl", Amharic: "am", Zulu: "zu", Yoruba: "yo", Luganda: "lg", Kinyarwanda: "rw" };
const LANGS = Object.keys(VOICE);
const UNITS = [
  { n: "Foundations", lv: "beginner", l: ["Greetings", "Introducing yourself", "Numbers 1 to 20", "Family", "Food and drink"] },
  { n: "Everyday life", lv: "elementary", l: ["Daily routine", "Shopping", "Directions", "Time and dates", "Weather"] },
  { n: "Real conversations", lv: "intermediate", l: ["At a restaurant", "Health and body", "Travel", "Work and school", "Giving opinions"] }
];
let U, jw, jwAt = 0;
const H = { chat: [], help: [] };
const P = () => U.prefs;
const course = () => P().from + ">" + P().to;
const day = back => new Date(Date.now() - (back || 0) * 864e5).toISOString().slice(0, 10);
async function save(patch) { U.prefs = { ...U.prefs, ...patch }; try { await account.updatePrefs(U.prefs); } catch (e) {} }
function speak(t, lang, end) {
  try {
    speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(t); s.lang = VOICE[lang] || "en"; s.rate = .85;
    s.onend = s.onerror = () => end && end();
    speechSynthesis.speak(s);
  } catch (e) { end && end(); }
}
async function api(path, body) {
  if (!jw || Date.now() - jwAt > 600000) { jw = (await account.createJWT()).jwt; jwAt = Date.now(); }
  const r = await fetch("/api/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jwt: jw, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error || "Nesty AI is unavailable right now. Please try again.") + (LS("debug") && j.detail ? " " + JSON.stringify(j.detail) : ""));
  return j;
}
const ai = async (mode, body) => (await api("ai", { mode, ...body })).text;

/* ---------- Account flow helpers ---------- */
const google = () => {
  try { account.createOAuth2Token("google", location.origin + location.pathname + "?oauth=1", location.origin + location.pathname + "?oauthfail=1"); }
  catch (e) { msg("Google sign-in is not available right now."); }
};
async function after(u, hasPw) {
  U = u;
  if (hasPw && !u.prefs.pw) await save({ pw: 1 });
  if (!U.prefs.pw) return pwView();
  if (!U.prefs.avatar) return avatarView(U);
  home(U);
}
function pwView() {
  shell("Create a password", `<p class="sub">Choose a password for your account (at least 8 characters). It keeps your account safe.</p><input id="p" type="password" placeholder="Password" autocomplete="new-password"><input id="c" type="password" placeholder="Confirm password" autocomplete="new-password"><button id="go" class="btn">Save password</button>`);
  $("#go").onclick = async ev => {
    const p = $("#p").value;
    if (p.length < 8) return msg("Password must have at least 8 characters.");
    if (p !== $("#c").value) return msg("The two passwords do not match.");
    ev.target.disabled = true;
    try { await account.updatePassword(p); await save({ pw: 1 }); after(U, true); }
    catch (e) { msg("Could not save the password. Try a different one."); ev.target.disabled = false; }
  };
}
function sheet(title, html) {
  const d = document.createElement("div"); d.className = "sheet";
  d.innerHTML = `<div class="sheet-in"><div class="sheet-h"><b>${title}</b><button class="ic" aria-label="Close">✕</button></div><div class="doc">${html}</div></div>`;
  d.querySelector("button").onclick = () => d.remove();
  document.body.appendChild(d);
}
function bindLegal() {
  document.querySelectorAll("[data-l]").forEach(a => a.onclick = e => { e.preventDefault(); const L = LEGAL[a.dataset.l]; sheet(L.t, L.h); });
}

/* ---------- Welcome ---------- */
function welcome() {
  const S = [
    ["What is Nesty Languages?", "Nesty Languages is a friendly app that helps you learn a new language starting from the language you already speak, like Kiswahili to French or English to Spanish."],
    ["What it does", "It teaches you step by step with clear explanations, then helps you practise with quizzes and audio. Nesty AI, your personal tutor, is ready to chat any time."],
    ["Why you will love it", "You learn first and get tested after, never the other way round. Every answer is explained, your progress and streak are saved, and your tutor never gets tired."]
  ];
  let i = 0;
  const draw = () => {
    const last = i === S.length;
    view(`<section class="hero"><img class="big" src="logo.svg" alt="Nesty Languages"><h1>${last ? "Ready to begin?" : S[i][0]}</h1>
      <p class="sub">${last ? "Read how we look after you and your data, then create your free account." : S[i][1]}</p>
      <div class="dots">${[0, 1, 2, 3].map(k => `<span class="${k === i ? "on" : ""}"></span>`).join("")}</div>
      ${last ? `<button class="btn" id="cr">Create account</button><button class="btn ghost" id="hv">I already have an account</button><div class="legal2"><a href="#" data-l="terms">Terms of Service</a><a href="#" data-l="privacy">Privacy Policy</a></div>` : `<button class="btn" id="nx">Next</button>`}</section>`);
    if (last) { bindLegal(); $("#cr").onclick = () => { LS("seen", "1"); signUp(); }; $("#hv").onclick = () => { LS("seen", "1"); signIn(); }; }
    else $("#nx").onclick = () => { i++; draw(); };
  };
  draw();
}

/* ---------- Shell: top bar, menu, tabs ---------- */
function frame(inner, tab, title) {
  view(`<header class="hd"><button class="ic" id="mn" aria-label="Menu">☰</button><b class="ttl">${title}</b><span class="chipx">🔥 ${P().st || 0}</span></header><main class="body">${inner}</main>
    <nav class="tabs">${[["learn", "📖", "Learn"], ["ai", "💬", "Nesty AI"], ["prog", "📈", "Progress"]].map(([k, i, l]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}"><i>${i}</i>${l}</button>`).join("")}</nav>`);
  $("#mn").onclick = drawer;
  document.querySelectorAll("[data-t]").forEach(b => b.onclick = () => go(b.dataset.t));
}
const go = t => ({ learn, ai: () => chat("chat"), prog: progress })[t]();
function drawer() {
  const d = document.createElement("div"); d.className = "sheet";
  d.innerHTML = `<aside class="drw"><div class="drh">${av(U.prefs)}<div><b>${esc(U.name)}</b><small>${esc(U.email)}</small></div></div>${[["set", "⚙️", "Settings"], ["plan", "📅", "Study plan"], ["help", "🛟", "Help Center"], ["terms", "📄", "Terms of Service"], ["privacy", "🔒", "Privacy Policy"], ["out", "🚪", "Sign out"]].map(([k, i, l]) => `<button data-m="${k}"><i>${i}</i>${l}</button>`).join("")}</aside>`;
  d.onclick = async e => {
    const b = e.target.closest("[data-m]");
    if (!b) { if (e.target === d) d.remove(); return; }
    const k = b.dataset.m; d.remove();
    if (k === "set") settings();
    else if (k === "plan") plan();
    else if (k === "help") chat("help");
    else if (k === "out") { try { await account.deleteSession("current"); } catch (er) {} U = null; signIn(); }
    else sheet(LEGAL[k].t, LEGAL[k].h);
  };
  document.body.appendChild(d);
}
function home(u) { U = u; if (!u.prefs.from || !u.prefs.to) return langView(); learn(); }

/* ---------- Choose course ---------- */
function langView() {
  const p = P(), opts = sel => LANGS.map(l => `<option ${l === sel ? "selected" : ""}>${l}</option>`).join("");
  shell("Choose your course", `<p class="sub">Pick the language you speak and the one you want to learn.</p><label class="lb">I speak</label><select id="f">${opts(p.from || "English")}</select><label class="lb">I want to learn</label><select id="t">${opts(p.to || "Spanish")}</select><button id="go" class="btn">Start learning</button>${p.from ? `<button id="cx" class="link">Cancel</button>` : ""}`);
  if ($("#cx")) $("#cx").onclick = learn;
  $("#go").onclick = async () => {
    const f = $("#f").value, t = $("#t").value;
    if (f === t) return msg("Choose two different languages.");
    await save({ from: f, to: t }); H.chat = [];
    learn();
  };
}

/* ---------- Learn: table of contents ---------- */
const done = (ui, li) => (P().d || {})[course() + ":" + ui + "-" + li];
function learn() {
  const flat = []; UNITS.forEach((u, ui) => u.l.forEach((_, li) => flat.push([ui, li])));
  const first = flat.findIndex(([a, b]) => done(a, b) === undefined);
  const n = flat.filter(([a, b]) => done(a, b) !== undefined).length, ex = P().ex || {}, sp = P().sp;
  const study = sp && sp.d.includes(new Date().getDay()) && P().ld !== day();
  frame(`${study ? `<div class="today">📅 Today is one of your study days (${esc(sp.t)}). Let’s do a lesson!</div>` : ""}
    <div class="course"><div><small>Your course</small><b>${P().from} → ${P().to}</b></div><button class="link" id="sw">Change</button></div>
    <div class="bar2"><i style="width:${Math.round(n / flat.length * 100)}%"></i></div><p class="sub">${n} of ${flat.length} lessons complete</p>
    ${UNITS.map((u, ui) => `<h3 class="unit">Unit ${ui + 1}: ${u.n}</h3>` + u.l.map((t, li) => {
      const k = flat.findIndex(([a, b]) => a === ui && b === li), dn = done(ui, li), lock = first !== -1 && k > first;
      return `<button class="les ${lock ? "lock" : ""}" data-ui="${ui}" data-li="${li}" ${lock ? "disabled" : ""}><span class="num">${dn !== undefined ? "✓" : lock ? "🔒" : k + 1}</span><span><b>${t}</b><small>${dn !== undefined ? "Best score " + dn + " of 6" : "Step-by-step lesson"}</small></span></button>`;
    }).join("") + (() => {
      const all = u.l.every((_, li) => done(ui, li) !== undefined), sc = ex[course() + ":" + ui];
      return `<button class="les exam ${all ? "" : "lock"}" data-ex="${ui}" ${all ? "" : "disabled"}><span class="num">🎓</span><span><b>Unit ${ui + 1} exam</b><small>${all ? (sc !== undefined ? "Best score " + sc + "%" : "10 questions, pass mark 70%") : "Finish every lesson in this unit first"}</small></span></button>`;
    })()).join("")}`, "learn", "Lessons");
  $("#sw").onclick = langView;
  document.querySelectorAll("[data-ui]").forEach(b => b.onclick = () => openLesson(+b.dataset.ui, +b.dataset.li));
  document.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => exam(+b.dataset.ex));
}
async function exam(ui) {
  const u = UNITS[ui];
  frame(`<div class="center"><div class="spin"></div><p class="sub">Nesty AI is writing your exam…</p></div>`, "learn", "Exam");
  let Q = [];
  try {
    const t = await ai("exam", { from: P().from, to: P().to, level: u.lv, topic: u.l.join(", ") });
    Q = (JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)).questions || []).map(q => ({ ...q, a: +q.a })).filter(q => q.q && q.o && q.o.length > 1 && q.a >= 0 && q.a < q.o.length);
    if (Q.length < 5) throw new Error("bad");
  } catch (e) {
    frame(`<div class="center"><p>The exam could not be prepared. Please try again.</p><button class="btn" id="bk">Back to lessons</button></div>`, "learn", "Exam");
    $("#bk").onclick = learn; return;
  }
  let i = 0, sc = 0; const miss = [];
  const draw = () => {
    if (i >= Q.length) return fin();
    const q = Q[i];
    frame(`<div class="bar2"><i style="width:${Math.round(i / Q.length * 100)}%"></i></div><p class="sub">Question ${i + 1} of ${Q.length}</p><h2 class="h2">${esc(q.q)}</h2>${q.o.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}<div id="fb"></div>`, "learn", "Unit " + (ui + 1) + " exam");
    document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const ok = +b.dataset.k === q.a;
      document.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add("good"); });
      if (ok) sc++; else { b.classList.add("bad"); miss.push(q); }
      $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><b>${ok ? "Correct!" : "Not quite."}</b> ${esc(q.why || "")}</div><button class="btn" id="nx">Continue</button>`;
      $("#nx").onclick = () => { i++; draw(); };
    });
  };
  async function fin() {
    const pct = Math.round(sc / Q.length * 100), pass = pct >= 70, k = course() + ":" + ui, ex = { ...(P().ex || {}) };
    ex[k] = Math.max(ex[k] || 0, pct);
    await save({ ex, xp: (P().xp || 0) + (pass ? 50 : 10) });
    if (pass) sfxWin();
    frame(`<div class="center"><div class="trophy">${pass ? "🎓" : "💪"}</div><h2>${pass ? "You passed!" : "Not yet"}</h2><p class="sub">You scored ${pct}% (${sc} of ${Q.length}). The pass mark is 70%.</p></div>${miss.length ? `<h3 class="unit">Review your mistakes</h3>` + miss.map(q => `<div class="rv"><b>${esc(q.q)}</b><br>Answer: ${esc(q.o[q.a])}<br><small>${esc(q.why || "")}</small></div>`).join("") : ""}<button class="btn" id="bk">Back to lessons</button>`, "learn", "Exam result");
    $("#bk").onclick = learn;
  }
  draw();
}
async function genLesson(ui, li) {
  const u = UNITS[ui], body = { from: P().from, to: P().to, level: u.lv, topic: u.l[li] };
  for (let a = 0; a < 2; a++) {
    const t = await ai("lesson", body);
    try { const L = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); if (L.steps && L.steps.length && L.words && L.words.length && L.quiz && L.quiz.length) return L; } catch (e) {}
  }
  throw new Error("The lesson could not be prepared. Please try again.");
}
async function openLesson(ui, li) {
  const key = "L2:" + course() + ":" + ui + "-" + li;
  frame(`<div class="center"><div class="spin"></div><p class="sub">Nesty AI is preparing your lesson…</p></div>`, "learn", "Lesson");
  let L = null; try { L = JSON.parse(LS(key)); } catch (e) {}
  if (!L) {
    try { L = await genLesson(ui, li); LS(key, JSON.stringify(L)); }
    catch (e) { frame(`<div class="center"><p>${esc(e.message)}</p><button class="btn" id="bk">Back to lessons</button></div>`, "learn", "Lesson"); $("#bk").onclick = learn; return; }
  }
  play(L, ui, li);
}
function play(L, ui, li) {
  const S = L.steps, Wd = L.words, Q = L.quiz.slice(0, 6).map(q => ({ ...q, a: +q.a })), ns = S.length;
  let ph = 0, i = 0, sc = 0, miss = [], res = null;
  const pct = () => Math.round((ph === 0 ? i : ph === 1 ? ns : ph === 2 ? ns + 1 + i : ns + 1 + Q.length) / (ns + 1 + Q.length) * 100);
  const top = h => frame(`<div class="bar2"><i style="width:${pct()}%"></i></div>${h}`, "learn", esc(UNITS[ui].l[li]));
  async function commit() {
    const key = course() + ":" + ui + "-" + li, d = { ...(P().d || {}) }, t = day();
    if (res.pass) d[key] = Math.max(d[key] || 0, sc);
    let st = P().st || 0; if (P().ld !== t) st = P().ld === day(1) ? st + 1 : 1;
    await save({ d, xp: (P().xp || 0) + res.xp, st, ld: t });
  }
  function draw() {
    if (ph === 0) {
      const s = S[i];
      top(`<div class="cardx"><small>Learn · step ${i + 1} of ${ns}</small><h2>${esc(s.h)}</h2><p>${esc(s.t)}</p></div><button class="btn" id="nx">Next</button>`);
      $("#nx").onclick = () => { if (++i >= ns) { ph = 1; i = 0; } draw(); };
    } else if (ph === 1) {
      top(`<h2 class="h2">Words and phrases</h2><p class="sub">Tap a word to hear it.</p>${Wd.map((w, k) => `<button class="wd" data-k="${k}"><span><b>${esc(w.w)}</b><small>${esc(w.p || "")}</small></span><span>${esc(w.m)}</span><i>🔊</i></button><p class="ex">${esc(w.ex || "")}<br><small>${esc(w.exm || "")}</small></p>`).join("")}<button class="btn" id="nx">Start the quiz</button>`);
      document.querySelectorAll(".wd").forEach(b => b.onclick = () => speak(Wd[+b.dataset.k].w, P().to));
      $("#nx").onclick = () => { ph = 2; i = 0; draw(); };
    } else if (ph === 2) {
      const q = Q[i];
      top(`<p class="sub">Question ${i + 1} of ${Q.length}</p><h2 class="h2">${esc(q.q)}</h2>${q.o.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("")}<div id="fb"></div>`);
      document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
        const ok = +b.dataset.k === q.a;
        document.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add("good"); });
        if (ok) sc++; else { b.classList.add("bad"); miss.push(q); }
        $("#fb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><b>${ok ? "Correct!" : "Not quite."}</b> ${esc(q.why || "")}</div><button class="btn" id="nx">Continue</button>`;
        $("#nx").onclick = () => {
          if (++i >= Q.length) { ph = 3; const pass = sc >= Math.ceil(Q.length * .6); res = { pass, xp: sc * 10 + (pass ? 20 : 0) }; commit(); (pass ? sfxWin : () => {})(); }
          draw();
        };
      });
    } else {
      top(`<div class="center"><div class="trophy">${res.pass ? "🏆" : "💪"}</div><h2>${res.pass ? "Lesson complete!" : "Keep practising"}</h2><p class="sub">You scored ${sc} of ${Q.length} and earned ${res.xp} XP.</p></div>
        ${miss.length ? `<h3 class="unit">Review your mistakes</h3>` + miss.map(q => `<div class="rv"><b>${esc(q.q)}</b><br>Answer: ${esc(q.o[q.a])}<br><small>${esc(q.why || "")}</small></div>`).join("") : ""}
        <button class="btn" id="nx">${res.pass ? "Back to lessons" : "Try again"}</button>${res.pass ? "" : `<button class="link" id="bk">Back to lessons</button>`}`);
      $("#nx").onclick = () => res.pass ? learn() : openLesson(ui, li);
      if ($("#bk")) $("#bk").onclick = learn;
    }
  }
  draw();
}
const sfxWin = () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); [523, 659, 784, 1047].forEach((f, k) => { const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.value = .12; o.connect(g); g.connect(c.destination); o.start(c.currentTime + k * .12); o.stop(c.currentTime + k * .12 + .15); }); } catch (e) {} };

/* ---------- Nesty AI (chat and help center) ---------- */
const BOT = `<svg class="bot" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f2b705"/></linearGradient></defs><g class="fl"><line x1="60" y1="14" x2="60" y2="26" stroke="#a97800" stroke-width="4" stroke-linecap="round"/><circle class="ant" cx="60" cy="11" r="6" fill="#d9442b"/><rect x="18" y="26" width="84" height="74" rx="30" fill="url(#bg)" stroke="#a97800" stroke-width="3"/><rect x="28" y="40" width="64" height="44" rx="20" fill="#fff"/><ellipse class="eye" cx="46" cy="60" rx="6" ry="8" fill="#1d1a12"/><ellipse class="eye" cx="74" cy="60" rx="6" ry="8" fill="#1d1a12"/><ellipse class="mo" cx="60" cy="76" rx="9" ry="3.5" fill="#d9442b"/><circle cx="36" cy="72" r="4" fill="#ffc9bd"/><circle cx="84" cy="72" r="4" fill="#ffc9bd"/></g></svg>`;
/* ---------- Voice ---------- */
const VOICES = [["Aoede", "Breezy"], ["Kore", "Firm"], ["Puck", "Upbeat"], ["Zephyr", "Bright"], ["Charon", "Informative"], ["Leda", "Youthful"], ["Achird", "Friendly"], ["Sulafat", "Warm"]];
let cur = null, micLang = "to";
const lvlName = () => { const c = course() + ":", n = Object.keys(P().d || {}).filter(k => k.startsWith(c)).length; return n < 5 ? "beginner" : n < 10 ? "elementary" : "intermediate"; };
async function say(t, lang, end) {
  try { speechSynthesis.cancel(); } catch (e) {}
  if (cur) { cur.pause(); cur = null; }
  const s = P().vs || {};
  if (!s.off) {
    try {
      const j = await api("ai", { mode: "tts", text: t.slice(0, 500), voice: s.v || "Aoede" });
      const pcm = Uint8Array.from(atob(j.pcm), c => c.charCodeAt(0)), h = new DataView(new ArrayBuffer(44));
      const w = (o, x) => [...x].forEach((c, k) => h.setUint8(o + k, c.charCodeAt(0)));
      w(0, "RIFF"); h.setUint32(4, 36 + pcm.length, true); w(8, "WAVEfmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
      h.setUint32(24, 24000, true); h.setUint32(28, 48000, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, pcm.length, true);
      const a = new Audio(URL.createObjectURL(new Blob([h, pcm], { type: "audio/wav" })));
      a.playbackRate = s.r || 1; a.onended = () => end && end(); cur = a; await a.play(); return;
    } catch (e) {}
  }
  speak(t, lang, end);
}
function chat(mode) {
  const help = mode === "help", hist = H[mode];
  const sug = help ? ["How do lessons work?", "How do I change my course?", "How do exams work?", "Is my data safe?"] : ["Teach me greetings", "Quiz me", "Explain a grammar rule", "Help me practise speaking"];
  frame(`<div class="cht"><div class="empty" id="empty">${BOT}<h2>${help ? "How can I help?" : "What shall we practise?"}</h2><div class="sg">${sug.map(c => `<button data-c="${c}">${c}</button>`).join("")}</div></div><div id="log" class="log2"></div></div>
    <div class="composer"><div class="pill"><textarea id="in" rows="1" maxlength="500" placeholder="${help ? "Ask about Nesty Languages" : "Message Nesty AI"}"></textarea>${help ? "" : `<button class="ib" id="mc" aria-label="Speak">🎤</button>`}<button class="ib go" id="sd" aria-label="Send">➤</button></div>
    ${help ? `<p class="fine c">Still stuck? Email isenyealvin@gmail.com</p>` : `<button class="ml" id="ml"></button>`}</div>`, help ? "" : "ai", help ? "Help Center" : "Nesty AI");
  const log = $("#log"), inp = $("#in"); let busy = false, rec = null;
  const ml = () => { if ($("#ml")) $("#ml").textContent = "🎤 Speaking " + P()[micLang] + " · tap to change"; };
  ml(); if ($("#ml")) $("#ml").onclick = () => { micLang = micLang === "to" ? "from" : "to"; ml(); };
  const add = (r, t) => {
    const d = document.createElement("div"); d.className = "msg " + r;
    if (r === "a") {
      d.innerHTML = `<span class="av2">${BOT}</span><div class="bd"><div class="tx"></div>${help ? "" : `<div class="act"><button data-s="1" aria-label="Listen">🔊</button><button data-cp="1" aria-label="Copy">📋</button></div>`}</div>`;
      d.querySelector(".tx").textContent = t;
      const s = d.querySelector("[data-s]"), c = d.querySelector("[data-cp]");
      if (s) s.onclick = () => say(t, P().to);
      if (c) c.onclick = () => { try { navigator.clipboard.writeText(t); c.textContent = "✓"; } catch (e) {} };
    } else d.textContent = t;
    log.appendChild(d); d.scrollIntoView({ block: "end" });
  };
  hist.forEach(m => add(m.role === "user" ? "u" : "a", m.content));
  if (hist.length) $("#empty").style.display = "none";
  async function send(txt) {
    txt = (txt || "").trim(); if (!txt || busy) return;
    busy = true; inp.value = ""; inp.style.height = "auto"; $("#empty").style.display = "none";
    add("u", txt); hist.push({ role: "user", content: txt });
    const ty = document.createElement("div"); ty.className = "msg a"; ty.innerHTML = `<span class="av2">${BOT}</span><div class="dots2"><i></i><i></i><i></i></div>`;
    log.appendChild(ty); ty.scrollIntoView({ block: "end" });
    try {
      const t = await ai(help ? "help" : "chat", { from: P().from, to: P().to, level: lvlName(), messages: hist.slice(-10) });
      hist.push({ role: "assistant", content: t }); ty.remove(); add("a", t);
    } catch (e) { hist.pop(); ty.remove(); add("a", e.message); }
    busy = false;
  }
  $("#sd").onclick = () => send(inp.value);
  inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inp.value); } };
  inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 120) + "px"; };
  document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => send(b.dataset.c));
  if ($("#mc")) $("#mc").onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return add("a", "Voice input is not supported in this browser. Please try Chrome.");
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = VOICE[P()[micLang]] || "en"; rec.interimResults = true;
    $("#mc").classList.add("rec");
    rec.onresult = e => { inp.value = [...e.results].map(r => r[0].transcript).join(""); };
    rec.onend = () => { $("#mc").classList.remove("rec"); rec = null; if (inp.value.trim()) send(inp.value); };
    rec.onerror = () => {};
    rec.start();
  };
}

/* ---------- Progress ---------- */
function progress() {
  const p = P(), d = p.d || {}, c = course(), mine = Object.keys(d).filter(k => k.startsWith(c + ":")), total = UNITS.reduce((a, u) => a + u.l.length, 0);
  const avg = mine.length ? Math.round(mine.reduce((a, k) => a + d[k], 0) / mine.length / 6 * 100) : 0;
  frame(`<div class="stats">${[["🔥", p.st || 0, "Day streak"], ["⭐", p.xp || 0, "Total XP"], ["✅", mine.length + "/" + total, "Lessons done"], ["🎯", avg + "%", "Average score"], ["🎓", Object.keys(p.ex || {}).filter(k => k.startsWith(c + ":") && p.ex[k] >= 70).length + "/" + UNITS.length, "Exams passed"]].map(([i, v, l]) => `<div class="stat"><i>${i}</i><b>${v}</b><small>${l}</small></div>`).join("")}</div>
    <h3 class="unit">${p.from} → ${p.to}</h3>${UNITS.map((u, ui) => { const n = u.l.filter((_, li) => done(ui, li) !== undefined).length; return `<div class="pu"><b>${u.n}</b> <small>${n} of ${u.l.length} lessons</small><div class="bar2"><i style="width:${n / u.l.length * 100}%"></i></div></div>`; }).join("")}`, "prog", "Progress");
}

/* ---------- Settings ---------- */
function settings() {
  const p = P(), s = p.vs || {};
  frame(`<h3 class="unit">Profile</h3>
    <div class="prof">${av(p)}<div><button class="btn sm" id="gal">Choose from gallery</button>${p.pic ? `<button class="link" id="rmp">Remove photo</button>` : ""}</div></div>
    <input id="ph" type="file" accept="image/*" hidden>
    <div class="avs">${EMO.map(a => `<button data-a="${a}">${a}</button>`).join("")}</div>
    <label class="lb">Username</label><input id="nm" value="${esc(U.name)}" maxlength="16"><button class="btn sm" id="sn">Save username</button>
    <h3 class="unit">Learning</h3><div class="course"><b>${p.from} → ${p.to}</b><button class="link" id="sw">Change</button></div>
    <button class="btn ghost" id="pl">Study plan and reminders</button>
    <h3 class="unit">Nesty AI voice</h3>
    <label class="lb">Voice</label><select id="vo">${VOICES.map(([v, d]) => `<option value="${v}" ${(s.v || "Aoede") === v ? "selected" : ""}>${v} (${d})</option>`).join("")}</select>
    <label class="lb">Speed</label><select id="vr">${[[.75, "Slow"], [1, "Normal"], [1.25, "Fast"], [1.5, "Very fast"]].map(([r, l]) => `<option value="${r}" ${(s.r || 1) === r ? "selected" : ""}>${l}</option>`).join("")}</select>
    <label class="lb"><input type="checkbox" id="vn" style="width:auto;margin-right:8px" ${s.off ? "" : "checked"}>Use the natural AI voice (turn off to use your phone’s voice)</label>
    <button class="btn sm ghost" id="vt">Play a sample</button>
    <h3 class="unit">Password</h3><p class="sub">For your safety, we email you a secure link to change your password.</p><button class="btn sm" id="rp">Email me a reset link</button>
    <p id="msg" class="msg"></p>`, "", "Settings");
  const vs = () => ({ v: $("#vo").value, r: +$("#vr").value, off: $("#vn").checked ? 0 : 1 });
  ["vo", "vr", "vn"].forEach(i => $("#" + i).onchange = () => save({ vs: vs() }));
  $("#vt").onclick = async () => { await save({ vs: vs() }); say("Hello! I am Nesty AI, your language tutor.", "English"); };
  $("#gal").onclick = () => $("#ph").click();
  $("#ph").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await save({ pic: await pickPhoto(f) }); settings(); } catch (er) { msg("That picture could not be used."); } };
  if ($("#rmp")) $("#rmp").onclick = async () => { await save({ pic: "" }); settings(); };
  document.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => { await save({ avatar: b.dataset.a, pic: "" }); settings(); });
  $("#sn").onclick = async () => {
    const v = $("#nm").value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) return msg("Username must be 3–16 letters, numbers or _.");
    try { await account.updateName(v); U.name = v; msg("Username saved.", true); } catch (e) { msg("Could not save the username."); }
  };
  $("#sw").onclick = langView; $("#pl").onclick = plan;
  $("#rp").onclick = async ev => {
    ev.target.disabled = true;
    try { await account.createRecovery(U.email, location.origin + location.pathname); msg("We sent a reset link to " + U.email + ". Open it to choose a new password.", true); }
    catch (e) { msg("Could not send the link. Please try again later."); }
    setTimeout(() => ev.target.disabled = false, 30000);
  };
}

/* ---------- Study plan and reminders ---------- */
const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], DC = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function download(d, t) {
  const [h, m] = t.split(":"), now = new Date(); let s = now;
  for (let k = 0; k < 8; k++) { s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, +h, +m); if (d.includes(s.getDay()) && s > now) break; }
  const p2 = x => String(x).padStart(2, "0"), f = x => x.getFullYear() + p2(x.getMonth() + 1) + p2(x.getDate()) + "T" + p2(x.getHours()) + p2(x.getMinutes()) + "00";
  const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nesty Languages//EN", "BEGIN:VEVENT", "UID:nesty-" + Date.now() + "@nestylanguages",
    "DTSTAMP:" + now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART:" + f(s), "DURATION:PT20M", "RRULE:FREQ=WEEKLY;BYDAY=" + d.map(i => DC[i]).join(","),
    "SUMMARY:Nesty Languages study time", "DESCRIPTION:Time for your " + P().to + " lesson!", "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY", "DESCRIPTION:Time to learn", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = "nesty-study-plan.ics"; a.click();
}
function plan() {
  const p = P().sp || { d: [1, 3, 5], t: "18:00" }; let d = [...p.d];
  frame(`<h3 class="unit">Study plan</h3><p class="sub">Choose your study days and time. Add it to your phone’s calendar to get a reminder, even when the app is closed.</p>
    <div class="chips">${DN.map((n, i) => `<button class="chip ${d.includes(i) ? "on" : ""}" data-d="${i}">${n}</button>`).join("")}</div>
    <label class="lb">Study time</label><input id="t2" type="time" value="${p.t}">
    <h3 class="unit">Your timetable</h3><div id="tt"></div>
    <button class="btn" id="ics">Add to phone calendar</button><button class="btn ghost" id="sv">Save plan</button><p id="msg" class="msg"></p>`, "", "Study plan");
  const tt = () => { $("#tt").innerHTML = DN.map((n, i) => `<div class="tr ${d.includes(i) ? "on" : ""}"><b>${n}</b><span>${d.includes(i) ? $("#t2").value + " · study time" : "Rest day"}</span></div>`).join(""); };
  tt(); $("#t2").onchange = tt;
  document.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { const i = +b.dataset.d; d = d.includes(i) ? d.filter(x => x !== i) : [...d, i]; b.classList.toggle("on"); tt(); });
  const keep = async () => { if (!d.length) { msg("Choose at least one day."); return null; } const t = $("#t2").value || "18:00"; await save({ sp: { d, t } }); return t; };
  $("#sv").onclick = async () => { if (await keep()) msg("Plan saved.", true); };
  $("#ics").onclick = async () => { const t = await keep(); if (t) { download(d, t); msg("Open the downloaded file to add it to your calendar.", true); } };
}

/* ---------- Connection problems ---------- */
function offline() {
  view(`<section class="hero"><img class="big" src="logo.svg" alt=""><h1>No connection</h1><p class="sub">Can not connect to Nesty Languages. Please check your internet connection and try again.</p><button class="btn" id="rt">Try again</button></section>`);
  $("#rt").onclick = () => location.reload();
}

/* ---------- Start ---------- */
(async () => {
  const q = new URLSearchParams(location.search), clean = () => history.replaceState(null, "", location.pathname);
  const wait = new Promise(r => setTimeout(r, 1100));
  if (typeof Appwrite === "undefined") return offline();
  if (q.get("oauth") && q.get("userId") && q.get("secret")) {
    try { await account.createSession(q.get("userId"), q.get("secret")); clean(); return after(await account.get(), false); }
    catch (e) { clean(); signIn(); return msg("Google sign-in failed. Please try again."); }
  }
  if (q.get("oauthfail")) { clean(); signIn(); return msg("Google sign-in was cancelled or failed."); }
  if (q.get("userId") && q.get("secret")) return resetView(q.get("userId"), q.get("secret"));
  try {
    const u = await Promise.race([account.get(), new Promise((_, no) => setTimeout(() => no({ code: 0 }), 12000))]);
    await wait;
    if (!u.emailVerification) { await account.deleteSession("current"); return welcome(); }
    after(u, false);
  } catch (e) {
    await wait;
    if (e && e.code === 401) LS("seen") ? signIn() : welcome(); else offline();
  }
})();
