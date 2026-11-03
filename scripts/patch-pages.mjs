import { readFileSync, writeFileSync } from 'node:fs';
const SITE = 'https://reworkstudio.net';
const nav = (active) => `<header class="site-nav">
  <div class="site-nav__in">
    <a class="site-nav__logo" href="/" aria-label="RE:WORK STUDIO 홈">RE:WORK<span>STUDIO</span></a>
    <nav class="site-nav__links" aria-label="주요 메뉴">
      <a href="/portfolio"${active==='portfolio'?' aria-current="page"':''}><span class="nav-lg">서비스·포트폴리오</span><span class="nav-sm">서비스</span></a>
      <a href="/insights">인사이트</a>
      <a class="site-nav__cta" href="/lead">무료<span class="nav-lg"> 계정</span> 분석</a>
    </nav>
  </div>
</header>`;
function patch(file, { title, desc, path, active }) {
  let h = readFileSync(file, 'utf8');
  if (h.includes('site-nav')) { console.log('skip', file); return; }
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RE:WORK STUDIO">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/images/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F0F0F">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">`);
  h = h.replace(/(<link rel="stylesheet" href="\/css\/(style|consult)\.css">)/, `$1\n<link rel="stylesheet" href="/css/site.css">`);
  h = h.replace('<body>', `<body class="has-nav">\n${nav(active)}`);
  writeFileSync(file, h, 'utf8'); console.log('patched', file);
}
patch('portfolio/index.html', { title: '서비스·포트폴리오 | RE:WORK STUDIO 콘텐츠 브랜딩', desc: '코치·상담사·원장님을 위한 RE:WORK STUDIO의 방법론, 상품 구성(Self 100만원·Standard 220만원·Premium 300만원), 광고 없이 만든 대표 콘텐츠 12편과 성과를 소개합니다.', path: '/portfolio', active: 'portfolio' });
patch('lead/index.html', { title: '무료 계정 분석 신청 | RE:WORK STUDIO', desc: '대표님 인스타 계정을 직접 살펴보고 첫인상 진단, 반응이 없는 이유, 다음에 올릴 콘텐츠 3가지를 정리해 드립니다. 신청 후 3영업일 안에 1:1 리포트 발송.', path: '/lead', active: 'lead' });
