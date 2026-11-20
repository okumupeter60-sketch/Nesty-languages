// Nesty AI backend (Cloudflare Pages Function). Keys live in Cloudflare settings, never in the app.
const AW = "https://sgp.cloud.appwrite.io/v1", PROJECT = "6afd7f47002168fc5d2a";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const clean = s => String(s || "").replace(/[^\p{L}\p{N} '’,.\-()&]/gu, "").slice(0, 40);

const APP = `You are Nesty AI, the help assistant of Nesty Languages. Answer briefly, kindly and in simple words, in the language the user writes in.
About the app: Nesty Languages teaches a language starting from one the user already speaks (for example Kiswahili to French). Users choose "I speak" and "I want to learn" when they start, and can change the course any time in Settings (three-bar menu). The Learn tab shows a table of contents of 3 units with 15 lessons. Each lesson first teaches step by step, then shows words and phrases with audio (tap the speaker), then a quiz where every answer is explained, then a review of mistakes. Passing a lesson unlocks the next one and earns XP and a daily streak. The Progress tab shows streak, XP, lessons done and average score. The Nesty AI tab is an animated robot tutor to chat with in the language being learned. Accounts: sign up with username, a password of at least 8 characters and an email verification code, or Continue with Google (a password must still be created). Forgot password: tap Reset password on the sign-in screen and a link is emailed. Settings lets users change username, course and password. Terms of Service and Privacy Policy are in the three-bar menu. Lessons and replies are made by AI and can contain mistakes. Coming soon: exams, study timetable, reminders, and deleting an account inside the app (until then, email support). Support email: isenyealvin@gmail.com. If you do not know something, say so and give the support email. Only talk about Nesty Languages.`;

async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b) return J({ error: "Bad request." }, 400);
  const v = await fetch(AW + "/account", { headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-JWT": String(b.jwt || "") } });
  if (!v.ok) return J({ error: "Please sign in again." }, 401);

  const from = clean(b.from) || "English", to = clean(b.to) || "Spanish", topic = clean(b.topic), level = clean(b.level) || "beginner";
  let system, messages;
  if (b.mode === "lesson") {
    system = `You are Nesty AI, an expert language teacher. Create a ${level} lesson on "${topic}" for a ${from} speaker learning ${to}. Write all explanations in ${from}. Return ONLY valid JSON, no markdown, in exactly this shape: {"title":"","steps":[{"h":"heading","t":"2 or 3 sentence explanation"}],"words":[{"w":"${to} word or phrase","m":"${from} meaning","p":"pronunciation written for a ${from} speaker","ex":"short example sentence in ${to}","exm":"${from} translation"}],"quiz":[{"q":"question","o":["option","option","option","option"],"a":0,"why":"one sentence explanation"}]}. Use exactly 3 steps, 6 words and 6 quiz questions. Quiz questions must test only what this lesson taught. "a" is the index of the correct option; vary it.`;
    messages = [{ role: "user", content: "Create the lesson now." }];
  } else {
    system = b.mode === "help" ? APP
      : `You are Nesty AI, a warm and patient language tutor inside the Nesty Languages app. The learner speaks ${from} and is learning ${to}. Chat mostly in simple ${to}. If they make a mistake, finish with a short line starting "Tip:" written in ${from} that corrects it and explains why. Keep replies under 80 words and end with a simple question to keep them talking.`;
    messages = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 600) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") return J({ error: "Bad request." }, 400);
  }

  // Providers are tried in order. If one hits its limit or fails, the next one is used.
  // Each *_API_KEY variable may hold several keys separated by commas.
  const sources = [
    ["https://api.groq.com/openai/v1/chat/completions", env.GROQ_MODEL || "llama-3.3-70b-versatile", env.GROQ_API_KEY],
    ["https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", env.GEMINI_MODEL || "gemini-2.5-flash", env.GEMINI_API_KEY],
    ["https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free", env.OPENROUTER_API_KEY]
  ];
  for (const [url, model, keys] of sources) {
    for (const key of String(keys || "").split(",").map(s => s.trim()).filter(Boolean)) {
      try {
        const r = await fetch(url, {
          method: "POST", signal: AbortSignal.timeout(28000),
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...messages], max_tokens: b.mode === "lesson" ? 2200 : 500, temperature: 0.6 })
        });
        if (!r.ok) continue;
        const j = await r.json(), text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (text) return J({ text });
      } catch (e) {}
    }
  }
  return J({ error: "Nesty AI is busy right now. Please try again in a minute." }, 503);
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
