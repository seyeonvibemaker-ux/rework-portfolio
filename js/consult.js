var form = document.getElementById('f');
  var btn = document.getElementById('btn');
  var msg = document.getElementById('msg');
  var sink = document.getElementById('sinkFrame');
  var sent = false, settled = false;

  document.querySelectorAll('#plans input').forEach(function (r) {
    r.addEventListener('change', function () {
      document.querySelectorAll('#plans .plan').forEach(function (p) { p.classList.remove('on'); });
      r.closest('.plan').classList.add('on');
    });
  });

  function succeed() {
    if (settled) return;
    settled = true;
    form.style.display = 'none';
    document.getElementById('done').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fail() {
    if (settled) return;
    settled = true;
    msg.innerHTML = '접수 중 문제가 생겼어요. <a href="https://pf.kakao.com/_xdxjbCX" target="_blank" rel="noopener">카카오톡 채널</a>로 남겨주시면 바로 확인하겠습니다.';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '무료 상담 신청하기';
  }

  sink.addEventListener('load', function () { if (sent) succeed(); });

  form.addEventListener('submit', function () {
    sent = true;
    btn.disabled = true;
    btn.textContent = '보내는 중...';
    msg.style.display = 'none';
    setTimeout(function () { if (!settled) succeed(); }, 2500);
    setTimeout(function () { if (!settled) fail(); }, 9000);
  });
