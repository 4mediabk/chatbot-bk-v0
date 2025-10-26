// api/chat.js - Node (Vercel Serverless)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const RATE_LIMIT_MAX = 8; // max 8 request per IP per window

// in-memory store (cukup untuk hobby project). Serverless ephemeral — oke untuk proteksi dasar.
const ipStore = new Map();

async function callOpenAI(apiKey, userMessage) {
  const payload = {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Kamu adalah konselor BK yang ramah, pendengar yang empatik, dan memberikan saran umum. Jangan memberi diagnosa medis atau instruksi yang berbahaya. Jika pengguna menyebutkan upaya bunuh diri atau bahaya, sarankan menghubungi layanan darurat." },
      { role: "user", content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 500
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${txt}`);
  }
  const json = await r.json();
  const reply = json?.choices?.[0]?.message?.content;
  return reply || null;
}

function mockReply(message) {
  const t = (message || "").toLowerCase();
  if (!t) return "Bisa ceritakan sedikit lebih banyak?";
  if (t.includes("bunuh") || t.includes("bunuh diri") || t.includes("ingin mati") || t.includes("selesai")) {
    return "Saya mendengar kamu bilang hal yang serius. Jika kamu dalam bahaya segera hubungi layanan darurat setempat atau nomor bantuan krisis di daerahmu. Kalau mau, ceritakan apa yang membuatmu merasa seperti itu—aku mendengarkan.";
  }
  if (t.includes("sedih") || t.includes("galau") || t.includes("sedih banget")) {
    return "Aku turut sedih mendengar itu. Mau cerita lebih detil apa yang membuatmu sedih belakangan ini?";
  }
  if (t.includes("cemas") || t.includes("takut")) {
    return "Perasaan cemas itu wajar. Coba tarik napas dalam-dalam 3 kali. Mau kita coba identifikasi satu hal kecil yang bisa mengurangi rasa cemasmu sekarang?";
  }
  if (t.includes("marah")) return "Marah itu wajar. Kalau mau, ceritakan situasinya sedikit—kita coba cari cara menyalurkannya dengan aman.";
  if (t.includes("sendiri") || t.includes("kesepian")) return "Kesepian berat ya. Terima kasih sudah berbagi. Mau cerita kapan biasanya rasa itu muncul?";
  if (t.includes("terima kasih")) return "Sama-sama. Senang bisa mendengarkanmu.";
  return "Terima kasih sudah berbagi. Aku di sini untuk mendengarkan — lanjutkan ceritamu, aku akan menemanimu.";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ message: "Method not allowed" });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown').split(',')[0].trim();

    // rate limit per IP
    const now = Date.now();
    const record = ipStore.get(ip) || { count: 0, start: now };
    if (now - record.start > RATE_LIMIT_WINDOW_MS) {
      // reset window
      record.count = 0;
      record.start = now;
    }
    record.count++;
    ipStore.set(ip, record);
    if (record.count > RATE_LIMIT_MAX) {
      res.status(429).json({ message: "Terlalu banyak permintaan. Coba beberapa saat lagi." });
      return;
    }

    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ message: "Bad request: 'message' wajib di body" });
      return;
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_KEY) {
      // fallback mock response (gratis)
      const reply = mockReply(message);
      res.status(200).json({ reply });
      return;
    }

    // Use OpenAI
    try {
      const reply = await callOpenAI(OPENAI_KEY, message);
      if (!reply) throw new Error("No reply from OpenAI");
      res.status(200).json({ reply });
    } catch (err) {
      console.error("OpenAI call failed:", err.message || err);
      // fallback to mock if OpenAI fails
      const fallback = mockReply(message);
      res.status(200).json({ reply: fallback, note: "fallback" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}
