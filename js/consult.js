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
    if (window.gtag) gtag('event', 'generate_lead', { form_name: 'free_account_analysis' });
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
    btn.textContent = '무료 계정 분석 신청하기';
  }

  sink.addEventListener('load', function () { if (sent) succeed(); });

  // 어떻게 알고 오셨나요: '기타'를 고르면 직접 적는 칸을 보여 준다 (적는 건 선택)
  var src = document.getElementById('src');
  var srcOther = document.getElementById('src-other');
  var srcWrap = document.getElementById('src-other-wrap');
  srcWrap.hidden = true;
  src.addEventListener('change', function () {
    srcWrap.hidden = src.value !== '__other_option__';
    if (!srcWrap.hidden) srcOther.focus();
  });

  form.addEventListener('submit', function () {
    // 구글폼은 '기타'를 고르고 칸을 비우면 접수를 거절한다. 비어 있으면 '기타'로 채운다.
    if (src.value === '__other_option__' && !srcOther.value.trim()) srcOther.value = '기타';
    sent = true;
    btn.disabled = true;
    btn.textContent = '보내는 중...';
    msg.style.display = 'none';
    setTimeout(function () { if (!settled) succeed(); }, 2500);
    setTimeout(function () { if (!settled) fail(); }, 9000);
  });
