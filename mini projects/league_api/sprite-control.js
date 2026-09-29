document.querySelector('#spritePreview').onclick = async () => {
  const status = document.querySelector('#spriteStatus');
  try {
    const r = await fetch('/sprite-preview', {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({level:Number(document.querySelector('#spriteLevel').value)})});
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Preview failed');
    status.textContent = 'Preview sent. League alerts must be on and unpaused.';
  } catch (e) { status.textContent = e.message; }
};
