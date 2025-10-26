// frontend logic (vanilla) - menghubungkan ke /api/chat
const chatEl = document.getElementById('chat');
const form = document.getElementById('composer');
const input = document.getElementById('input');

function addMessage(text, role = 'bot') {
  const el = document.createElement('div');
  el.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  el.innerText = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// pesan pembuka
addMessage('Hai! Aku chatbot BK sekolah ✨ Siap mendengarkan. Kalau ada hal darurat, hubungi layanan darurat ya.');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  input.value = '';
  // show loading status
  const loading = document.createElement('div');
  loading.className = 'msg bot';
  loading.innerText = 'Sedang mengetik...';
  chatEl.appendChild(loading);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    // remove loading
    loading.remove();
    if (!res.ok) {
      addMessage('Maaf, terjadi masalah: ' + (data?.message || data?.error || res.statusText));
      return;
    }
    addMessage(data.reply || 'Maaf, aku belum bisa jawab sekarang.');
  } catch (err) {
    loading.remove();
    console.error(err);
    addMessage('Terjadi kesalahan jaringan. Coba lagi nanti.');
  }
});
