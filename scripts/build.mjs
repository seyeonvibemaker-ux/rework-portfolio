// RE:WORK STUDIO 정적 사이트 빌더 (외부 의존성 없음)
// 사용법: node scripts/build.mjs
// 입력: content/insights/*.md  →  출력: index.html, insights/**, sitemap.xml, robots.txt, insights/feed.xml
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://reworkstudio.net';
const BRAND = 'RE:WORK STUDIO';
const AUTHOR = '정세연';
const KAKAO = 'https://pf.kakao.com/_xdxjbCX';
const INSTA = 'https://www.instagram.com/rework_studio99/';
const NAVER_BLOG = 'https://blog.naver.com/rework_studio';
const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Gothic+A1:wght@700;800;900&family=Noto+Sans+KR:wght@400;500;700&display=swap';
const ANALYTICS = "<!-- analytics -->\n<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>\n<script defer src=\"/_vercel/insights/script.js\"></script>\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-SNV7HETFL5\"></script>\n<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-SNV7HETFL5');</script>";

// ---------- utils ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (rel, content) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content, 'utf8'); };
const fmtDate = (d) => { const [y, m, dd] = d.split('-'); return `${y}.${m}.${dd}`; };
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ---------- frontmatter ----------
function parseDoc(raw) {
  const m = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('frontmatter 없음');
  const meta = {}; let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    let mm;
    if ((mm = line.match(/^([a-zA-Z_]+):\s*(.*)$/))) {
      key = mm[1];
      meta[key] = mm[2] === '' ? [] : mm[2].trim();
    } else if ((mm = line.match(/^-\s+q:\s*(.*)$/))) {
      meta[key].push({ q: mm[1].trim(), a: '' });
    } else if ((mm = line.match(/^\s+a:\s*(.*)$/))) {
      meta[key][meta[key].length - 1].a = mm[1].trim();
    } else if ((mm = line.match(/^-\s+(.*)$/))) {
      meta[key].push(mm[1].trim());
    } else if (key && Array.isArray(meta[key]) && meta[key].length && typeof meta[key][meta[key].length - 1] === 'object') {
      meta[key][meta[key].length - 1].a += ' ' + line.trim();
    }
  }
  meta.keywords = (meta.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
  meta.sources = (meta.sources || []).map(s => { const [title, by, date, url] = s.split(' | ').map(x => (x || '').trim()); return { title, by, date, url }; });
  meta.faq = meta.faq || [];
  meta.summary = meta.summary || [];
  return { meta, body: m[2] };
}

// ---------- markdown (subset) ----------
function inline(s) {
  let out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u) && !u.startsWith(SITE);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const html = []; const toc = [];
  let para = [], list = null, quote = [];
  const flushP = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushL = () => { if (list) { html.push(`<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.t}>`); list = null; } };
  const flushQ = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; } };
  const flush = () => { flushP(); flushL(); flushQ(); };
  let hn = 0;
  for (const line of lines) {
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      flush();
      const lv = m[1].length; const id = `s${++hn}`;
      if (lv === 2) toc.push({ id, text: m[2].replace(/\*\*/g, '') });
      html.push(`<h${lv} id="${id}">${inline(m[2])}</h${lv}>`); continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushP(); flushL(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    flushL(); flushQ(); para.push(line.trim());
  }
  flush();
  return { html: html.join('\n'), toc };
}

// ---------- site data ----------
// 촬영 방식 3가지 × 콘텐츠 형식 2가지. 같은 가격 안에서 숏폼/롱폼을 고른다.
const TIERS = [
  { en: 'Self', ko: '직접 촬영', who: '대표님 직접 촬영', how: '촬영 가이드 제공' },
  { en: 'Standard', ko: '인터뷰 촬영', who: 'PD 1~2회 촬영', how: '인터뷰형 · 2캠', pick: true },
  { en: 'Premium', ko: '현장·특수 촬영', who: 'PD 2회 촬영', how: '인터뷰 외 형식 · 현장 세팅 + B롤', ex: '예: 수업·시술 현장, 제품 시연, 공간 투어' },
];
const FORMATS = [
  { en: 'Short-form', ko: '숏폼', unit: '릴스 8편', sub: '', prices: [100, 220, 300], notes: ['', '', ''],
    incl: [['기획', '인터뷰 · 대본 8편'], ['촬영', '장면별 촬영 가이드'], ['편집', '자막 · 썸네일'], ['수정', '편집 1회 · 오타 무제한']] },
  { en: 'Long-form', ko: '롱폼', unit: '영상 4편', sub: '편당 10분 내외', prices: [100, 220, 300], notes: ['숏폼 클립 별도 · 개당 5만원', '숏폼 클립 8개 서비스', '숏폼 클립 8개 서비스'],
    incl: [['기획', '인터뷰 · 구성안·대본 4편'], ['촬영', '장면별 촬영 가이드'], ['편집', '컷편집 · 자막 · 챕터 <br>썸네일 · 제목·설명란'], ['수정', '편집 1회 · 오타 무제한']] },
];
const ADDONS = [
  { name: '카드뉴스', price: '2만원', unit: '1장' },
  { name: '블로그 기획', price: '100만원', unit: '4편' },
  { name: 'SNS 디자인 기본 세팅', price: '50만원', unit: '' },
  { name: '홈페이지', price: '100만원', unit: '+ 월 5만원' },
];
const STEPS = [
  ['무료 계정 분석', '계정을 살펴보고 3영업일 안에 리포트를 보내 드려요'],
  ['정식 인터뷰', '인터뷰로 대표님도 몰랐던 강점을 찾아요'],
  ['기획', '무엇을 어떤 순서로 말할지 정해요'],
  ['대본', '고객이 바로 알아듣는 말로 대본을 써요'],
  ['촬영·편집', '직접 또는 PD 방문으로 찍고, 자막·썸네일까지 편집해요'],
  ['월간 리포트', '조회수와 팔로워 변화를 매달 정리해 드려요'],
];
const BRANDS = [
  ['48년 업력 식품 제조사', '마케팅 전체 대행'],
  ['뉴로인사이트', '뇌파훈련 브랜드 · 이름·로고부터 채널 기획'],
  ['제이미컬러랩', '컬러기질·뇌과학 기반 부모교육'],
  ['유앤미컬러랩', '유아교육 원장의 기질 상담 콘텐츠'],
  ['MJ관계연구소', '부부관계 회복 전문가 브랜딩'],
  ['마음색 작업실', '감정미술·사춘기 미술치료'],
  ['싸커맘 멘탈코치', '스포츠 멘탈코칭 브랜드'],
  ['어린이집 원장', '국공립 어린이집 · 교육 현장 콘텐츠'],
];
const FAQ = [
  { q: '어떤 대표님과 일하나요?', a: '코치, 상담사, 원장님 같은 전문직과 1인 대표님과 일해요. 실력은 있는데 SNS에서 잘 알려지지 않았다면 잘 맞아요.' },
  { q: '무료 계정 분석은 뭘 해 주나요?', a: '대표님 계정을 직접 보고 첫인상, 반응이 없는 이유, 다음에 올릴 콘텐츠 3가지를 정리해 드려요. 3영업일 안에 리포트로 보내 드리고, 원하시면 15분 통화도 해요.' },
  { q: '숏폼과 롱폼은 뭐가 다른가요?', a: '숏폼은 릴스 8편, 롱폼은 편당 10분 안팎의 영상 4편이에요. 가격은 같고, 롱폼 인터뷰 촬영·현장 촬영에는 숏폼 클립 8개가 함께 들어가요.' },
  { q: '제가 직접 찍어야 하나요?', a: '직접 촬영(SELF)은 대표님이 찍고 저희가 장면별 촬영 가이드를 드려요. 인터뷰 촬영(STANDARD)은 PD가 1~2회, 현장·특수 촬영(PREMIUM)은 PD가 2회 찾아가서 찍어요.' },
  { q: '기간은 얼마나 걸리고, 업로드도 해 주나요?', a: '진행 기간과 업로드 대행 여부는 계약 전에 대표님 일정에 맞춰 정해요.' },
  { q: '수정은 몇 번 되나요?', a: '편집 수정은 1번, 오타 수정은 횟수 제한 없이 해 드려요.' },
];

// ---------- shared chunks ----------
function head({ title, description, path, type = 'website', image = '/images/og-default.png', extra = '' }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F0F0F">
<meta name="google-site-verification" content="v3fNLwtkdVQPlgarLbiVW8clAr4Ra_K3E5ATx12H4wE">
<meta name="naver-site-verification" content="1fd86cd4a57c1fd9f72b173e4379241b2b30e0e6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${BRAND} 블로그" href="${SITE}/insights/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/site.css">
${extra}
${ANALYTICS}
</head>`;
}

const MENU = [['/about', '회사 소개', 'about'], ['/services', '서비스', 'services'], ['/portfolio', '포트폴리오', 'portfolio'], ['/insights', '블로그', 'insights']];
function nav(active = '') {
  const links = MENU.map(([h, l, k]) => `<a href="${h}"${active === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  return `<header class="site-nav" id="site-nav">
  <div class="site-nav__in">
    <a class="site-nav__logo" href="/" aria-label="${BRAND} 홈">RE:WORK<span>STUDIO</span></a>
    <nav class="site-nav__links" aria-label="주요 메뉴">${links}</nav>
    <a class="site-nav__cta" href="/lead">무료 계정 분석</a>
    <button class="site-nav__toggle" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="site-nav-panel"><span></span><span></span></button>
  </div>
  <nav class="site-nav__panel" id="site-nav-panel" aria-label="모바일 메뉴">${links}<a class="site-nav__panel-cta" href="/lead">무료 계정 분석 받기</a></nav>
  <script>(function(){var h=document.getElementById('site-nav'),b=h.querySelector('.site-nav__toggle');b.addEventListener('click',function(){var o=h.classList.toggle('is-open');b.setAttribute('aria-expanded',o);b.setAttribute('aria-label',o?'메뉴 닫기':'메뉴 열기');});})();</script>
</header>`;
}

function footer() {
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="site-foot__top">
      <div>
        <div class="site-foot__brand">RE:WORK STUDIO</div>
        <p class="site-foot__desc">전문직과 1인 대표님을 위한 <br>SNS 콘텐츠 기획·제작 스튜디오</p>
      </div>
      <nav class="site-foot__links" aria-label="하단 메뉴">
        <a href="/about">회사 소개</a><a href="/services">서비스</a><a href="/portfolio">포트폴리오</a><a href="/insights">블로그</a><a href="/lead">무료 계정 분석</a>
      </nav>
      <div class="site-foot__links">
        <a href="${INSTA}" target="_blank" rel="noopener">인스타그램</a>
        <a href="${KAKAO}" target="_blank" rel="noopener">카카오톡 채널</a>
        <a href="${NAVER_BLOG}" target="_blank" rel="noopener">네이버 블로그</a>
      </div>
    </div>
    <div class="site-foot__bottom">
      <span>대표 정세연 · <a href="tel:01037275522">010-3727-5522</a> · <a href="mailto:rework_studio@naver.com">rework_studio@naver.com</a></span>
      <span><a class="site-foot__privacy" href="/privacy">개인정보처리방침</a> · © 2026 RE:WORK STUDIO</span>
    </div>
  </div>
</footer>`;
}

function finalCta(title = '먼저 무료로 계정 분석부터 받아 보세요') {
  return `<section class="chapter page-cta">
  <div class="wrap">
    <h2 class="closing-head">${title}</h2>
    <p class="home-final__desc">3영업일 안에 리포트로 보내 드려요.</p>
    <div class="home-hero__actions">
      <a class="btn btn--ink" href="/lead">무료 계정 분석 받기</a>
      <a class="btn btn--line" href="${KAKAO}" target="_blank" rel="noopener">카카오톡으로 물어보기</a>
    </div>
  </div>
</section>`;
}

function ctaBand() {
  return `<section class="cta-band">
  <div class="wrap cta-band__in">
    <div>
      <div class="cta-band__tag">무료 계정 분석</div>
      <p class="cta-band__title">내 계정은 왜 문의가 없을까요?</p>
      <p class="cta-band__desc">무료로 살펴보고, 3영업일 안에 리포트로 알려 드려요.</p>
    </div>
    <a class="btn btn--ink" href="/lead">무료 계정 분석 받기</a>
  </div>
</section>`;
}

const secHead = (eyebrow, title, more) => `<div class="sec-head"><div><div class="eyebrow eyebrow--ko">${eyebrow}</div><h2 class="headline">${title}</h2></div>${more ? `<a class="more-link" href="${more[0]}">${more[1]} →</a>` : ''}</div>`;
// 하위 페이지 머리: 슬로건 없이 페이지 이름 + 한 줄 설명
const subHero = (title, lede) => `<section class="sub-head"><div class="wrap"><h1 class="sub-head__title">${title}</h1>${lede ? `<p class="sub-head__lede">${lede}</p>` : ''}</div></section>`;
// 가격표: 위에 촬영 방식 3칸, 아래로 숏폼·롱폼 줄. 모바일에선 형식별로 세로로 쌓인다.
const priceMatrix = () => `<div class="pm">
  <div class="pm__tiers"><div class="pm__corner"></div>${TIERS.map(t => `<div class="pm-tier${t.pick ? ' is-pick' : ''}"><div class="pm-tier__en">${t.en}${t.pick ? ' <span>추천</span>' : ''}</div><div class="pm-tier__ko">${t.ko}</div><p class="pm-tier__who">${t.who}</p><p class="pm-tier__how">${t.how}</p>${t.ex ? `<p class="pm-tier__ex">(${t.ex})</p>` : ''}</div>`).join('')}</div>
  ${FORMATS.map(f => `<div class="pm__fmt">
    <div class="pm__row">
      <div class="pm-fmt"><div class="pm-fmt__en">${f.en}</div><div class="pm-fmt__ko">${f.ko}</div><p class="pm-fmt__unit">${f.unit}</p>${f.sub ? `<p class="pm-fmt__sub">${f.sub}</p>` : ''}</div>
      ${f.prices.map((p, i) => `<div class="pm-price${TIERS[i].pick ? ' is-pick' : ''}"><div class="pm-price__tier">${TIERS[i].ko} <em>${TIERS[i].en}</em></div><div class="pm-price__num num">${p}<span>만원</span></div>${f.notes[i] ? `<p class="pm-price__note${f.notes[i].includes('서비스') ? ' is-bonus' : ''}">${f.notes[i]}</p>` : ''}</div>`).join('')}
    </div>
    <ul class="pm-incl">${f.incl.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('')}</ul>
  </div>`).join('')}
</div>`;
const faqList = (items) => `<div class="faq faq--home">${items.map(f => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
const proof = (url, img, stat, who) => `<a class="proof-card" href="${url}" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/${img})"></div><div class="proof-card__cap"><b>${stat}</b><span>${who}</span></div></a>`;

const ORG = {
  '@type': 'ProfessionalService',
  '@id': `${SITE}/#org`,
  name: BRAND,
  alternateName: ['리워크 스튜디오', 'RE:WORK'],
  url: `${SITE}/`,
  image: `${SITE}/images/og-default.png`,
  logo: `${SITE}/favicon.svg`,
  description: '전문직과 1인 대표님을 위한 SNS 콘텐츠 기획·제작 스튜디오. 대표님 이야기를 인터뷰해 릴스 대본, 촬영, 편집까지 만들어 문의가 오는 SNS를 만듭니다.',
  email: 'rework_studio@naver.com',
  telephone: '+82-10-3727-5522',
  areaServed: 'KR',
  founder: { '@id': `${SITE}/#founder` },
  sameAs: [INSTA, NAVER_BLOG, KAKAO],
};
const PERSON = {
  '@type': 'Person',
  '@id': `${SITE}/#founder`,
  name: AUTHOR,
  jobTitle: 'RE:WORK STUDIO 대표',
  description: 'LH공사에서 16년 넘게 도시계획 일을 했고, 책을 쓰고 온라인 쇼핑몰과 창업을 거쳐 지금은 대표님들의 이야기를 SNS 콘텐츠로 만듭니다.',
  worksFor: { '@id': `${SITE}/#org` },
  url: `${SITE}/about`,
  sameAs: [INSTA],
};
const page = (o, body) => `${head(o)}
<body class="page ${o.cls || ''}">
${nav(o.active)}
<main>
${body}
</main>
${footer()}
<script src="/js/main.js"></script>
</body>
</html>
`;

// ---------- load posts ----------
const postsDir = join(ROOT, 'content', 'insights');
const posts = existsSync(postsDir)
  ? readdirSync(postsDir).filter(f => f.endsWith('.md')).map(f => {
      const { meta, body } = parseDoc(readFileSync(join(postsDir, f), 'utf8'));
      if (!meta.slug) meta.slug = f.replace(/\.md$/, '');
      const r = md(body);
      const chars = body.replace(/\s/g, '').length;
      return { ...meta, html: r.html, toc: r.toc, minutes: Math.max(3, Math.round(chars / 500)), path: `/insights/${meta.slug}` };
    }).sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug))
  : [];

const card = (p) => `<a class="post-card" href="${p.path}">
  <div class="post-card__meta"><span class="post-card__cat">${esc(p.category)}</span><time datetime="${p.date}">${fmtDate(p.date)}</time></div>
  <h3 class="post-card__title">${esc(p.title)}</h3>
  <p class="post-card__desc">${esc(p.description)}</p>
  <span class="post-card__more">읽어보기 →</span>
</a>`;

// ---------- 홈: 편지처럼 — 대표가 직접 건네는 인사 (가격·포트폴리오 없음) ----------
// 레퍼런스: sive.rs, austinkleon.com — 1인칭 자기소개로 시작, 블록 대신 이어지는 글, 연락은 한 문장으로.
{
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: BRAND, url: `${SITE}/`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE}/#org` } },
    ORG, PERSON ] };
  write('index.html', page({ title: `${BRAND} | 정세연`, description: '안녕하세요, 정세연입니다. 대표님과 대화하고, 알아가고, 하시는 일을 이해한 다음에 콘텐츠를 만들어요.', path: '/', extra: jsonld(ld), cls: 'page--home page--letter', active: 'home' }, `
<section class="letter">
  <div class="letter__in">
    <p class="story-hello" id="story-hello" hidden></p>
    <div class="letter__photo" style="background-image:url(/images/profile-03.jpg)" role="img" aria-label="정세연 대표"></div>
    <h1 class="letter__hi">안녕하세요, <br>정세연입니다.</h1>

    <div class="letter__body">
      <p>저는 대표님들과 이야기 나누는 걸 좋아해요. <br>하시는 일 이야기부터, 살아오신 이야기까지요.</p>
      <p>어떤 고객을 만나시는지, 어떻게 이 일을 시작하게 되셨는지, <br>그동안 어떤 길을 걸어오셨는지. <br>그렇게 이야기를 나누다 보면 대표님 일이 조금씩 보여요.</p>
      <p>콘텐츠는 그다음이에요. <br>하시는 일을 제가 충분히 이해했다고 느낄 때 만들기 시작해요.</p>
      <p>저도 지나 보니 많은 경험을 했네요. <br>16년 넘게 회사에 다니다 나와서 책을 쓰고, <br>SNS로 저를 알려 보고, 온라인 쇼핑몰도 하고, 직접 창업도 해 봤어요. <br>그래서 대표님들의 이야기가 남 일 같지 않아요.</p>
      <p>대화하고, 알아가고, 업을 이해하는 것. <br><strong>제가 제일 잘하는 일이에요.</strong></p>
    </div>

    <div class="letter__now">
      <h2 class="letter__label">요즘은</h2>
      <p>대표님, 상담사, 원장님, 코치님들과 이야기를 나누고 <br>그 이야기를 릴스와 영상으로 만들고 있어요.</p>
    </div>

    ${posts.length ? `<div class="letter__now">
      <h2 class="letter__label">최근에 쓴 글</h2>
      <ul class="letter__posts">${posts.slice(0, 3).map(p => `<li><a href="${p.path}">${esc(p.title)}</a><time datetime="${p.date}">${fmtDate(p.date)}</time></li>`).join('')}</ul>
    </div>` : ''}

    <div class="letter__end">
      <p>대표님 이야기도 듣고 싶어요. <br>정리되지 않은 상태 그대로 괜찮아요.</p>
      <p><a href="${KAKAO}" target="_blank" rel="noopener">카카오톡으로 편하게 말 걸어 주세요</a>. 제가 직접 답변드릴게요. <br>계정부터 봐 드리길 원하시면 <a href="/lead">무료 계정 분석</a>을 신청해 주셔도 좋아요.</p>
      <p class="letter__sign">정세연 <span>RE:WORK STUDIO</span></p>
    </div>

  </div>
  <script>(function(){var s=new URLSearchParams(location.search).get('utm_source'),m={threads:'스레드',linkedin:'링크드인'};if(m[s]){var e=document.getElementById('story-hello');e.textContent=m[s]+'에서 글 보고 오셨군요. 반가워요.';e.hidden=false;}})();</script>
</section>
`));
}

// ---------- 회사 소개 ----------
write('about/index.html', page({ title: `회사 소개 | ${BRAND}`, description: 'RE:WORK STUDIO는 전문직과 1인 대표님을 위한 SNS 콘텐츠 기획·제작 스튜디오예요. 대표 정세연과 함께한 브랜드를 소개합니다.', path: '/about', extra: jsonld({ '@context': 'https://schema.org', '@graph': [ORG, PERSON] }), cls: 'page--sub', active: 'about' }, `
${subHero('회사 소개', '전문직과 1인 대표님 중, 실력은 있는데 SNS에서 잘 알려지지 않은 분들과 일해요.')}

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">저희가 믿는 것</div>
    <p class="belief">설명만 하는 계정은 스쳐 지나가고, <br><span>이야기가 있는 계정</span>이 기억에 남아요.</p>
    <p class="subhead">정보는 검색하면 나와요. 사람들이 찾아오는 건 그 정보를 말하는 사람의 이야기예요.</p>
  </div>
</section>

<section class="chapter chapter--dim">
  <div class="wrap">
    ${secHead('하는 일', '세 가지를 해요', ['/services', '서비스와 가격 보기'])}
    <div class="three-up">
      <div class="three-up__item"><div class="num">01</div><b>이야기 정리</b><p>대표님의 경험과 강점을 하나의 이야기로 정리해요</p></div>
      <div class="three-up__item"><div class="num">02</div><b>콘텐츠 제작</b><p>릴스 대본부터 카드뉴스, 캡션까지 만들어요</p></div>
      <div class="three-up__item"><div class="num">03</div><b>계정 운영 상담</b><p>프로필과 계정 방향을 같이 잡아요</p></div>
    </div>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">대표 소개</div>
    <div class="founder-story">
      <div class="founder-story__photo" style="background-image:url(/images/profile-02.jpg)" role="img" aria-label="정세연 대표"></div>
      <div class="founder-story__text">
        <p>LH공사에서 16년 넘게 도시계획 일을 했어요.</p>
        <p>회사를 나와서는 하나씩 부딪혀 봤어요. <br>책을 썼고, 저를 알리고 싶어서 SNS를 붙잡고 여러 번 시도했어요. <br>온라인 쇼핑몰을 몇 곳 운영하면서 온라인 시장을 배웠고, <br>힐링 스튜디오를 열었다가 문을 닫기도 했어요.</p>
        <p>이 경험들을 어떻게 이어야 할지 오래 고민했어요. <br>그런데 돌아보니, 허투루 보낸 날은 하루도 없었더라고요.</p>
        <p>지금은 대표님들과 이야기를 나누고, 그 이야기를 콘텐츠로 만들어요. <br>잘하고, 좋아하고, 결과까지 나는 일을 이제야 찾은 것 같아요.</p>
        <p class="founder-story__sign">정세연 <span>RE:WORK STUDIO 대표</span></p>
      </div>
    </div>
  </div>
</section>

<section class="chapter chapter--dim">
  <div class="wrap">
    ${secHead('함께한 브랜드', '이런 분들과 <span class="hl">함께했어요</span>', ['/portfolio', '포트폴리오 보기'])}
    <ul class="brand-list">${BRANDS.map(([n, d]) => `<li><b>${n}</b><span>${d}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">연락처</div>
    <ul class="contact-list">
      <li><b>전화</b><a href="tel:01037275522">010-3727-5522</a></li>
      <li><b>이메일</b><a href="mailto:rework_studio@naver.com">rework_studio@naver.com</a></li>
      <li><b>인스타그램</b><a href="${INSTA}" target="_blank" rel="noopener">@rework_studio99</a></li>
      <li><b>카카오톡</b><a href="${KAKAO}" target="_blank" rel="noopener">채널 추가하기</a></li>
    </ul>
  </div>
</section>

${finalCta()}
`));

// ---------- 서비스 ----------
{
  const offers = FORMATS.flatMap(f => TIERS.map((t, i) => ({ '@type': 'Offer', name: `${f.ko} ${f.unit} · ${t.ko} (${t.en})`, price: String(f.prices[i] * 10000), priceCurrency: 'KRW' })));
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Service', name: '인스타 릴스 콘텐츠 제작', provider: { '@id': `${SITE}/#org` }, areaServed: 'KR', offers },
    { '@type': 'FAQPage', mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ORG ] };
  write('services/index.html', page({ title: `서비스와 가격 | 숏폼·롱폼 100·220·300만원 | ${BRAND}`, description: '숏폼(릴스 8편)과 롱폼(10분 내외 4편)을 같은 가격으로. 직접 촬영 100만원, 인터뷰 촬영 220만원, 현장·특수 촬영 300만원(VAT 별도). 진행 순서와 자주 묻는 질문.', path: '/services', extra: jsonld(ld), cls: 'page--sub', active: 'services' }, `
${subHero('서비스와 가격', '촬영 방식과 형식(숏폼·롱폼)을 고르시면, 기획부터 편집까지 함께 해요.')}

<section class="chapter">
  <div class="wrap">
    ${secHead('진행 순서', '이렇게 진행해요')}
    <ol class="flowchart">${STEPS.map(([t], i) => `<li><span class="flowchart__no num">${i + 1}</span><b>${t}</b></li>`).join('')}</ol>
  </div>
</section>

<section class="chapter chapter--dim" id="price">
  <div class="wrap">
    ${secHead('가격', '촬영 방식 × <span class="hl">숏폼·롱폼</span>')}
    ${priceMatrix()}
    <p class="footnote">VAT 별도 · 진행 기간과 업로드 대행 여부는 계약 전에 협의해요.</p>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    ${secHead('추가 상품', '필요한 것만 <span class="hl">더할 수</span> 있어요')}
    <ul class="addon-list addon-list--ask">${ADDONS.map(a => `<li><b>${a.name}</b><em>별도 문의</em></li>`).join('')}</ul>
    <p class="footnote">추가 상품 가격은 <a href="${KAKAO}" target="_blank" rel="noopener">카카오톡으로</a> 편하게 물어봐 주세요.</p>
  </div>
</section>

<section class="chapter chapter--dim">
  <div class="wrap">
    ${secHead('자주 묻는 질문', '궁금한 점')}
    ${faqList(FAQ)}
  </div>
</section>

${finalCta('어떤 구성이 맞을지 모르겠다면, 무료 분석부터 받아 보세요')}
`));
}

// ---------- 포트폴리오 ----------
{
  const cases = readFileSync(join(ROOT, 'content', 'partials', 'work-cases.html'), 'utf8');
  write('portfolio/index.html', page({ title: `포트폴리오 | 광고 없이 만든 인스타 콘텐츠 | ${BRAND}`, description: '부모교육 코치, 어린이집 원장, 부부관계 상담가, 아동 미술치료 대표님과 만든 릴스·카드뉴스. 광고 없이 누적 조회수 200만+.', path: '/portfolio', extra: jsonld({ '@context': 'https://schema.org', '@graph': [ORG] }), cls: 'page--sub page--work', active: 'portfolio' }, `
${subHero('포트폴리오', '단순 조회수가 아니라, <br>팬이 생기고 실제 매출로 이어지는 <br>콘텐츠를 만듭니다.')}

<section class="chapter">
  <div class="wrap">
    <div class="stat-row stat-row--plain">
      <div class="stat"><div class="stat-num num">200만+</div><div class="stat-label">만든 콘텐츠 <br>누적 조회수</div></div>
      <div class="stat"><div class="stat-num num">3천+</div><div class="stat-label">릴스 1편 <br>최고 댓글 수</div></div>
      <div class="stat"><div class="stat-num num">약 8천</div><div class="stat-label">카드뉴스 1편 <br>최고 댓글 수</div></div>
      <div class="stat"><div class="stat-num num">3천+</div><div class="stat-label">카드뉴스 1편 뒤 <br>늘어난 팔로워</div></div>
    </div>
    ${cases}
  </div>
</section>

${finalCta('대표님 계정도 함께 살펴볼게요')}
`));
}

// ---------- 블로그 글 ----------
for (const p of posts) {
  const others = posts.filter(o => o.slug !== p.slug).slice(0, 2);
  const image = existsSync(join(ROOT, 'images', 'og', `${p.slug}.png`)) ? `/images/og/${p.slug}.png` : '/images/og-default.png';
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BlogPosting', headline: p.title, description: p.description, datePublished: p.date, dateModified: p.updated || p.date, inLanguage: 'ko-KR',
        mainEntityOfPage: `${SITE}${p.path}`, image: `${SITE}${image}`, keywords: p.keywords.join(', '), articleSection: p.category,
        author: { '@id': `${SITE}/#founder` }, publisher: { '@id': `${SITE}/#org` },
        citation: p.sources.filter(s => s.url).map(s => ({ '@type': 'CreativeWork', name: s.title, url: s.url })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '블로그', item: `${SITE}/insights` },
        { '@type': 'ListItem', position: 3, name: p.title, item: `${SITE}${p.path}` } ] },
      ...(p.faq.length ? [{ '@type': 'FAQPage', mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
      ORG, PERSON,
    ],
  };
  write(`insights/${p.slug}/index.html`, page({ title: `${p.title} | ${BRAND}`, description: p.description, path: p.path, type: 'article', image, cls: 'page--article', active: 'insights',
    extra: `<meta property="article:published_time" content="${p.date}">\n<meta property="article:section" content="${esc(p.category)}">\n${jsonld(ld)}` }, `
<article class="article">
  <header class="article__head">
    <div class="wrap wrap--narrow">
      <nav class="crumbs" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/insights">블로그</a><span>/</span><span>${esc(p.category)}</span></nav>
      <div class="article__cat">${esc(p.category)}</div>
      <h1 class="article__title">${esc(p.title)}</h1>
      <div class="article__byline">
        <span class="article__author">${AUTHOR} <em>RE:WORK STUDIO 대표</em></span>
        <span><time datetime="${p.date}">${fmtDate(p.date)}</time> · ${p.minutes}분 읽기</span>
      </div>
    </div>
  </header>
  <div class="wrap wrap--narrow article__body-wrap">
    ${p.summary.length ? `<section class="tldr" aria-label="3줄 요약"><div class="tldr__label">3줄 요약</div><ol>${p.summary.map(s => `<li>${inline(s)}</li>`).join('')}</ol></section>` : ''}
    <div class="prose">
${p.html}
    </div>
    ${p.faq.length ? `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h" class="faq__title">자주 묻는 질문</h2>${p.faq.map(f => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${inline(f.a)}</p></details>`).join('')}</section>` : ''}
    ${p.sources.length ? `<section class="sources" aria-labelledby="src-h"><h2 id="src-h" class="sources__title">참고한 자료</h2><ol>${p.sources.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}<span>${esc(s.by)}${s.date ? ` · ${esc(s.date)}` : ''}</span></li>`).join('')}</ol></section>` : ''}
    <aside class="author-box">
      <div class="author-box__photo" style="background-image:url(/images/img-13.jpg)" role="img" aria-label="정세연 대표 사진"></div>
      <div>
        <div class="author-box__name">${AUTHOR} <span>RE:WORK STUDIO 대표</span></div>
        <p>LH공사에서 16년 넘게 일했어요. 지금은 대표님들의 이야기를 콘텐츠로 만들어요.</p>
        <a href="/about">회사 소개 보기 →</a>
      </div>
    </aside>
  </div>
</article>
${others.length ? `<section class="related"><div class="wrap">${secHead('다른 글', '같이 읽어 보세요', ['/insights', '글 전체 보기'])}<div class="post-grid post-grid--2">${others.map(card).join('')}</div></div></section>` : ''}
${ctaBand()}
`));
}

// ---------- 개인정보처리방침 ----------
write('privacy/index.html', page({ title: `개인정보처리방침 | ${BRAND}`, description: 'RE:WORK STUDIO 개인정보처리방침. 무료 계정 분석 신청서와 홈페이지 방문 분석에서 처리하는 개인정보 항목, 목적, 보관 기간, 위탁, 국외 이전, 이용자 권리를 안내합니다.', path: '/privacy', cls: 'page--article', active: '' }, `
<article class="article">
  <header class="article__head">
    <div class="wrap wrap--narrow">
      <nav class="crumbs" aria-label="현재 위치"><a href="/">홈</a><span>/</span><span>개인정보처리방침</span></nav>
      <h1 class="article__title">개인정보처리방침</h1>
      <div class="article__byline"><span>시행일 2026년 11월 3일</span></div>
    </div>
  </header>
  <div class="wrap wrap--narrow article__body-wrap">
    <div class="prose">
${readFileSync(join(ROOT, 'content', 'partials', 'privacy.html'), 'utf8')}
    </div>
  </div>
</article>
`));

// ---------- 블로그 목록 ----------
write('insights/index.html', page({ title: `블로그 | 콘텐츠·브랜딩 고민을 쉽게 풀어 드려요 | ${BRAND}`, description: '코치·상담사·원장님의 인스타·브랜딩 고민을 쉬운 말로 풀어 드려요. 연구와 공식 자료를 근거로, 바로 해 볼 수 있는 방법만 담았어요.', path: '/insights', cls: 'page--sub', active: 'insights',
  extra: jsonld({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Blog', '@id': `${SITE}/insights#blog`, name: `${BRAND} 블로그`, url: `${SITE}/insights`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE}/#org` },
      blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}${p.path}`, datePublished: p.date })) }, ORG, PERSON ] }) }, `
${subHero('블로그', '콘텐츠와 브랜딩 고민을, 연구와 공식 자료를 바탕으로 쉽게 풀어 드려요.')}
<section class="chapter">
  <div class="wrap">
    ${posts.length ? `<div class="post-grid">${posts.map(card).join('')}</div>` : '<p class="empty">첫 글을 준비하고 있어요.</p>'}
  </div>
</section>
${ctaBand()}
`));

// ---------- 신청 페이지 메뉴 갱신 ----------
{
  const f = join(ROOT, 'lead', 'index.html');
  let h = readFileSync(f, 'utf8');
  h = h.replace(/<header class="site-nav"[\s\S]*?<\/header>/, nav('lead'));
  if (!h.includes('<!-- analytics -->')) h = h.replace('</head>', ANALYTICS + '\n</head>');
  writeFileSync(f, h, 'utf8');
}

// ---------- sitemap / robots / feed ----------
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', lastmod: today, pr: '1.0' },
    { loc: '/services', lastmod: today, pr: '0.9' },
    { loc: '/portfolio', lastmod: today, pr: '0.9' },
    { loc: '/about', lastmod: today, pr: '0.8' },
    { loc: '/lead', lastmod: today, pr: '0.8' },
    { loc: '/privacy', lastmod: '2026-11-03', pr: '0.3' },
    { loc: '/insights', lastmod: posts[0]?.date || today, pr: '0.8' },
    ...posts.map(p => ({ loc: p.path, lastmod: p.updated || p.date, pr: '0.7' })),
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.pr}</priority></url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);
  write('insights/feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${BRAND} 블로그</title>
<link>${SITE}/insights</link>
<atom:link href="${SITE}/insights/feed.xml" rel="self" type="application/rss+xml"/>
<description>코치·상담사·원장님을 위한 인스타·브랜딩 이야기</description>
<language>ko</language>
${posts.map(p => `<item><title>${esc(p.title)}</title><link>${SITE}${p.path}</link><guid>${SITE}${p.path}</guid><pubDate>${new Date(p.date + 'T09:00:00+09:00').toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.description)}</description></item>`).join('\n')}
</channel>
</rss>
`);
}

// ---------- 쉬운 말 검사: 화면에 보이는 글에 어려운 말이 있으면 경고 ----------
{
  const HARD = ['언어화', '퍼널', '동선', '전환율', '내러티브', '운송', '서사', '구조화', '시그니처', 'end-to-end', '프로파일', '리드', '어트리뷰션', '인지 단계', '자산화'];
  const pages = ['index.html', 'about/index.html', 'services/index.html', 'portfolio/index.html', 'insights/index.html', 'lead/index.html', ...posts.map(p => `insights/${p.slug}/index.html`)];
  let warn = 0;
  for (const rel of pages) {
    const f = join(ROOT, rel); if (!existsSync(f)) continue;
    const text = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<[^>]+>/g, ' ');
    for (const w of HARD) { const n = text.split(w).length - 1; if (n) { console.warn(`  [쉬운 말] ${rel}: "${w}" ${n}회`); warn++; } }
  }
  console.log(warn ? `쉬운 말 검사: 경고 ${warn}건` : '쉬운 말 검사: 통과');
}

console.log(`built: home, about, services, work, blog(${posts.length}), sitemap, robots, feed`);
