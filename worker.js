// Nesty AI backend (Cloudflare Pages Function). Keys live in Cloudflare settings, never in the app.
const AW = "https://sgp.cloud.appwrite.io/v1", PROJECT = "6afd7f47002168fc5d2a";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const clean = (s, n = 40) => String(s || "").replace(/[^\p{L}\p{N} '’,.\-()&]/gu, "").slice(0, n);

const APP = `You are Nesty AI, the help assistant of Nesty Languages. Nesty Languages and Nesty AI were created by Red Element. If asked who made you or what powers you, say you are Nesty AI, created by Red Element, and never name any AI company, model or provider. Answer briefly, kindly and in simple words, in the language the user writes in.
About the app: Nesty Languages teaches a language starting from one the user already speaks (for example Kiswahili to French). Users choose "I speak" and "I want to learn" when they start, and can change the course any time on the Learn tab (Change button) or in Settings, and progress is kept for each course. The Learn tab is a table of contents of 3 units with 15 lessons. Each lesson first teaches step by step with detailed explanations and examples, then shows words and phrases with audio (tap the speaker), then a quiz where every answer is explained, then a review of mistakes. Passing a lesson unlocks the next one and earns XP and a daily streak. After finishing all lessons of a unit, the unit exam unlocks: 10 questions, pass mark 70 percent, new questions each time. The Progress tab shows streak, XP, lessons done, average score and exams passed. The Nesty AI tab is a ChatGPT-style tutor: type or tap the microphone to speak, and tap the speaker on a reply to hear it. In Settings users can choose a natural AI voice and its speed, change their username, choose a profile picture from their gallery or an emoji, and request a secure password reset link by email. The Study plan screen (menu or Settings) lets users pick study days and time, shows a weekly timetable, and downloads a calendar file so the phone gives reminders. Accounts: sign up with username, a password of at least 8 characters and an email verification code, or Continue with Google (a password must still be created). Forgot password: tap Reset password on the sign-in screen and a link is emailed. Terms of Service and Privacy Policy are in the three-bar menu. Lessons and replies are made by AI and can contain mistakes. Not available yet: deleting an account inside the app (email support to delete it). Support email: isenyealvin@gmail.com. If you do not know something, say so and give the support email. Only talk about Nesty Languages.`;

// Asks each provider which models are available to the key, then picks suitable chat models.
const cache = {};
const ver = s => parseFloat((s.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
const sz = s => +((s.match(/(\d+)b/i) || [0, 0])[1]);
const LIST = {
  groq: "https://api.groq.com/openai/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/models",
  openrouter: "https://openrouter.ai/api/v1/models"
};
async function models(name, key, fallback) {
  const ck = name + key.slice(-6), hit = cache[ck];
  if (hit && Date.now() - hit.t < 600000) return hit.m;
  let ids = [];
  try {
    const r = await fetch(LIST[name], { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(8000) });
    if (r.ok) ids = ((await r.json()).data || []).map(m => String(m.id).replace(/^models\//, ""));
  } catch (e) {}
  const bad = /whisper|tts|guard|embed|image|audio|live|vision|moderation|safeguard|transcri|speech|orpheus|veo|imagen|aqa|robotics|computer|thinking|preview|exp/i;
  let pick = ids.filter(i => !bad.test(i));
  if (name === "groq") pick = [...pick.filter(i => /llama/i.test(i)).sort((a, b) => sz(b) - sz(a)), ...pick.filter(i => /gpt-oss|qwen/i.test(i))];
  else if (name === "gemini") pick = pick.filter(i => /^gemini-[\d.]+-flash/.test(i)).sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || ver(b) - ver(a));
  else pick = pick.filter(i => /:free$/.test(i) && /llama|gemma|qwen|mistral|deepseek|gpt-oss/i.test(i)).sort((a, b) => sz(b) - sz(a));
  const m = [...new Set([...pick.slice(0, 3), ...fallback.filter(Boolean)])];
  cache[ck] = { t: Date.now(), m };
  return m;
}

const VOICES = ["Aoede", "Kore", "Puck", "Zephyr", "Charon", "Leda", "Achird", "Sulafat"];
async function tts(b, env) {
  const text = String(b.text || "").slice(0, 500), voice = VOICES.includes(b.voice) ? b.voice : "Aoede";
  if (!text) return J({ error: "Nothing to say." }, 400);
  const keys = String(env.GEMINI_API_KEY || "").split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (!keys.length) return J({ error: "Voice is not set up." }, 503);
  for (const key of keys) {
    const names = [env.GEMINI_TTS_MODEL];
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
      if (r.ok) names.push(...((await r.json()).models || []).map(m => String(m.name).replace("models/", "")).filter(n => /tts/.test(n) && !/preview-0|exp/.test(n)));
    } catch (e) {}
    names.push("gemini-2.5-flash-preview-tts");
    for (const model of [...new Set(names.filter(Boolean))].slice(0, 3)) {
      try {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
          method: "POST", signal: AbortSignal.timeout(30000), headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say this warmly and clearly: " + text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } })
        });
        if (!r.ok) continue;
        const part = (((await r.json()).candidates || [])[0]?.content?.parts || []).find(p => p.inlineData);
        if (part) return J({ pcm: part.inlineData.data });
      } catch (e) {}
    }
  }
  return J({ error: "The voice is busy. Using your phone’s voice instead." }, 503);
}

async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b) return J({ error: "Bad request." }, 400);
  const v = await fetch(AW + "/account", { headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-JWT": String(b.jwt || "") } });
  if (!v.ok) return J({ error: "Please sign in again." }, 401);
  if (b.mode === "tts") return tts(b, env);

  const from = clean(b.from) || "English", to = clean(b.to) || "Spanish", topic = clean(b.topic, 140), level = clean(b.level) || "beginner";
  const ME = "You were created by Red Element. If asked who made you or what powers you, say you are Nesty AI, created by Red Element, and never name any AI company, model or provider.";
  let system, messages;
  if (b.mode === "lesson") {
    system = `You are Nesty AI, a patient private language tutor. ${ME} Create a ${level} lesson on "${topic}" for a ${from} speaker learning ${to}. Teach it properly: assume the learner knows nothing, explain slowly and thoroughly in ${from}, never rush. Return ONLY valid JSON, no markdown, exactly in this shape: {"title":"","steps":[{"h":"heading","t":"explanation"}],"words":[{"w":"${to} word or phrase","m":"${from} meaning","p":"pronunciation written for a ${from} speaker","ex":"short example sentence in ${to}","exm":"${from} translation"}],"quiz":[{"q":"question","o":["option","option","option","option"],"a":0,"why":"1 or 2 sentence explanation"}]}. Rules: exactly 5 steps, from the easiest idea to the hardest. Each step's "t" has 5 to 7 full sentences in plain words, gives at least two examples written in ${to}, each followed by its pronunciation in brackets and its ${from} meaning, and adds a short tip about a common mistake or about culture when useful. Exactly 8 words and 6 quiz questions. Quiz questions test only what was taught. "a" is the index of the correct option; vary it.`;
    messages = [{ role: "user", content: "Create the lesson now." }];
  } else if (b.mode === "exam") {
    system = `You are Nesty AI. ${ME} Write a ${level} exam for a ${from} speaker learning ${to} covering these lessons: ${topic}. Return ONLY valid JSON: {"questions":[{"q":"question","o":["option","option","option","option"],"a":0,"why":"1 or 2 sentence explanation"}]}. Exactly 10 multiple-choice questions mixing vocabulary, translation, grammar and understanding. Write the instructions in ${from} and use ${to} examples. "a" is the index of the correct option; vary it.`;
    messages = [{ role: "user", content: "Write the exam now." }];
  } else {
    system = b.mode === "help" ? APP : `You are Nesty AI, a warm, patient language tutor. ${ME} The learner speaks ${from}, is learning ${to} and is at ${level} level. Always write your main reply in ${from} so the learner understands you. When you teach or practise, show each ${to} word or sentence with its pronunciation and its ${from} meaning. For a beginner use only a few simple ${to} words at a time and never write whole paragraphs in ${to}; only intermediate learners may get mostly ${to} with ${from} help. If the learner writes ${to} with mistakes, correct them kindly and explain why in ${from}. Be encouraging, keep replies under 120 words, and end with one small question or task. When the learner asks you to write something they can copy, such as a message, a list or a short text, put only that text inside a markdown code block so it appears in a copy box. Use a markdown table when listing words with several columns.`;
    messages = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") return J({ error: "Bad request." }, 400);
  }

  // Providers are tried in order. If one hits its limit or fails, the next one is used.
  // Each *_API_KEY variable may hold several keys separated by commas.
  const sources = [
    ["groq", "https://api.groq.com/openai/v1/chat/completions", [env.GROQ_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"], env.GROQ_API_KEY],
    ["gemini", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", [env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"], env.GEMINI_API_KEY],
    ["openrouter", "https://openrouter.ai/api/v1/chat/completions", [env.OPENROUTER_MODEL, "meta-llama/llama-3.3-70b-instruct:free"], env.OPENROUTER_API_KEY]
  ];
  const notes = [];
  for (const [name, url, fallback, keys] of sources) {
    const list = String(keys || "").split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (!list.length) { notes.push(name + ": no key found"); continue; }
    for (const key of list) {
      for (const model of await models(name, key, fallback)) {
        try {
          const r = await fetch(url, {
            method: "POST", signal: AbortSignal.timeout(45000),
            headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...messages], max_tokens: b.mode === "lesson" ? 4000 : b.mode === "exam" ? 2800 : 600, temperature: 0.6 })
          });
          if (r.ok) {
            const j = await r.json(), text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
            if (text) return J({ text });
            notes.push(name + " " + model + " empty reply");
            continue;
          }
          notes.push(name + " " + model + " " + r.status + " " + (await r.text()).replace(/\s+/g, " ").slice(0, 110));
          if (r.status === 401 || r.status === 403) break;
        } catch (e) { notes.push(name + " " + model + " no response"); }
      }
    }
  }
  return J({ error: "Nesty AI is busy right now. Please try again in a minute.", detail: notes }, 503);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ai") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return onRequestPost({ request, env });
    }
    return env.ASSETS.fetch(request);
  }
};
