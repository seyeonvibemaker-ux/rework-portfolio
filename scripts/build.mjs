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

// ---------- shared chunks ----------
function head({ title, description, path, type = 'website', image = '/images/og-default.png', extra = '', css = ['/css/style.css', '/css/site.css'] }) {
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
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${BRAND} 인사이트" href="${SITE}/insights/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
${css.map(c => `<link rel="stylesheet" href="${c}">`).join('\n')}
${extra}
</head>`;
}

export function nav(active = '') {
  const a = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="site-nav">
  <div class="site-nav__in">
    <a class="site-nav__logo" href="/" aria-label="${BRAND} 홈">RE:WORK<span>STUDIO</span></a>
    <nav class="site-nav__links" aria-label="주요 메뉴">
      ${a('/portfolio', '<span class="nav-lg">서비스·포트폴리오</span><span class="nav-sm">서비스</span>', 'portfolio')}
      ${a('/insights', '블로그', 'insights')}
      <a class="site-nav__cta" href="/lead">무료<span class="nav-lg"> 계정</span> 분석</a>
    </nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="site-foot__top">
      <div>
        <div class="site-foot__brand">RE:WORK STUDIO</div>
        <p class="site-foot__desc">코치·상담사·원장님을 위한<br>인스타 콘텐츠 제작 스튜디오</p>
      </div>
      <nav class="site-foot__links" aria-label="하단 메뉴">
        <a href="/">홈</a><a href="/portfolio"><span class="nav-lg">서비스·포트폴리오</span><span class="nav-sm">서비스</span></a><a href="/insights">블로그</a><a href="/lead">무료 계정 분석</a>
      </nav>
      <div class="site-foot__links">
        <a href="${INSTA}" target="_blank" rel="noopener">Instagram</a>
        <a href="${NAVER_BLOG}" target="_blank" rel="noopener">네이버 블로그</a>
        <a href="${KAKAO}" target="_blank" rel="noopener">카카오톡 채널</a>
      </div>
    </div>
    <div class="site-foot__bottom">
      <span>대표 정세연 · <a href="tel:01037275522">010-3727-5522</a> · <a href="mailto:rework_studio@naver.com">rework_studio@naver.com</a></span>
      <span>© 2026 RE:WORK STUDIO</span>
    </div>
  </div>
</footer>`;
}

function ctaBand() {
  return `<section class="cta-band">
  <div class="wrap cta-band__in">
    <div>
      <div class="cta-band__tag">Free · 무료 계정 분석</div>
      <p class="cta-band__title">내 계정은 왜 문의가 없을까요?</p>
      <p class="cta-band__desc">무료로 살펴보고, 3영업일 안에 리포트로 알려 드려요.</p>
    </div>
    <a class="btn btn--red" href="/lead">무료 계정 분석 받기</a>
  </div>
</section>`;
}

const ORG = {
  '@type': 'ProfessionalService',
  '@id': `${SITE}/#org`,
  name: BRAND,
  alternateName: ['리워크 스튜디오', 'RE:WORK'],
  url: `${SITE}/`,
  image: `${SITE}/images/og-default.png`,
  logo: `${SITE}/favicon.svg`,
  description: '코치·상담사·원장 등 1인 전문가의 경험을 정리해 릴스·카드뉴스 콘텐츠로 만들고, 인지에서 상담까지 이어지는 흐름을 설계하는 콘텐츠 브랜딩 스튜디오',
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
  description: '스토리텔러 마케팅 전문가. 공기업에서 17년간 계획·기획 업무를 했고, 30팀 이상의 브랜드·계정 콘텐츠 기획을 맡았습니다. 『파워루틴핏』 저자.',
  worksFor: { '@id': `${SITE}/#org` },
  url: `${SITE}/`,
  sameAs: [INSTA],
};

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

// ---------- article pages ----------
for (const p of posts) {
  const others = posts.filter(o => o.slug !== p.slug).slice(0, 2);
  const image = existsSync(join(ROOT, 'images', 'og', `${p.slug}.png`)) ? `/images/og/${p.slug}.png` : '/images/og-default.png';
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        dateModified: p.updated || p.date,
        inLanguage: 'ko-KR',
        mainEntityOfPage: `${SITE}${p.path}`,
        image: `${SITE}${image}`,
        keywords: p.keywords.join(', '),
        articleSection: p.category,
        author: { '@id': `${SITE}/#founder` },
        publisher: { '@id': `${SITE}/#org` },
        citation: p.sources.filter(s => s.url).map(s => ({ '@type': 'CreativeWork', name: s.title, url: s.url })),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '블로그', item: `${SITE}/insights` },
        { '@type': 'ListItem', position: 3, name: p.title, item: `${SITE}${p.path}` },
      ] },
      ...(p.faq.length ? [{ '@type': 'FAQPage', mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
      ORG, PERSON,
    ],
  };
  const page = `${head({ title: `${p.title} | ${BRAND}`, description: p.description, path: p.path, type: 'article', image,
    extra: `<meta property="article:published_time" content="${p.date}">\n<meta property="article:section" content="${esc(p.category)}">\n${jsonld(ld)}` })}
<body class="page page--article">
${nav('insights')}
<main>
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
    ${p.toc.length > 2 ? `<nav class="toc" aria-label="목차"><div class="toc__label">목차</div><ol>${p.toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
    <div class="prose">
${p.html}
    </div>
    ${p.faq.length ? `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h" class="faq__title">자주 묻는 질문</h2>${p.faq.map(f => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${inline(f.a)}</p></details>`).join('')}</section>` : ''}
    ${p.sources.length ? `<section class="sources" aria-labelledby="src-h"><h2 id="src-h" class="sources__title">참고한 자료</h2><ol>${p.sources.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}<span>${esc(s.by)}${s.date ? ` · ${esc(s.date)}` : ''}</span></li>`).join('')}</ol></section>` : ''}
    <aside class="author-box">
      <div class="author-box__photo" style="background-image:url(/images/img-13.jpg)" role="img" aria-label="정세연 대표 사진"></div>
      <div>
        <div class="author-box__name">${AUTHOR} <span>RE:WORK STUDIO 대표</span></div>
        <p>LH공사에서 17년 동안 기획 일을 했어요. 지금은 대표님들의 이야기를 인스타 콘텐츠로 만들어요. 30팀 넘는 브랜드와 함께했어요.</p>
        <a href="/portfolio">작업 사례 보기 →</a>
      </div>
    </aside>
  </div>
</article>
${others.length ? `<section class="related"><div class="wrap"><div class="kicker-row"><span class="eyebrow eyebrow--ko">다른 글</span><a class="more-link" href="/insights">전체 보기 →</a></div><div class="post-grid post-grid--2">${others.map(card).join('')}</div></div></section>` : ''}
${ctaBand()}
</main>
${footer()}
</body>
</html>
`;
  write(`insights/${p.slug}/index.html`, page);
}

// ---------- insights index ----------
{
  const cats = [...new Set(posts.map(p => p.category))];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Blog', '@id': `${SITE}/insights#blog`, name: `${BRAND} 인사이트`, url: `${SITE}/insights`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE}/#org` },
      blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}${p.path}`, datePublished: p.date })) },
    ORG, PERSON ] };
  const page = `${head({ title: `블로그 | 인스타·브랜딩 고민을 쉽게 풀어 드려요 | ${BRAND}`, description: '코치·상담사·원장님의 인스타·브랜딩 고민을 쉬운 말로 풀어 드려요. 연구와 공식 자료를 근거로, 바로 해 볼 수 있는 방법만 담았어요.', path: '/insights', extra: jsonld(ld) })}
<body class="page page--insights">
${nav('insights')}
<main>
<section class="page-hero">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">블로그</div>
    <h1 class="headline">인스타 고민,<br><span class="hl">쉽게 풀어 드려요</span></h1>
    <p class="subhead">연구와 공식 자료를 바탕으로, 바로 해 볼 수 있는 방법만 담았어요.</p>
    
  </div>
</section>
<section class="insights-list">
  <div class="wrap">
    ${posts.length ? `<div class="post-grid">${posts.map(card).join('')}</div>` : '<p class="empty">첫 글을 준비하고 있어요.</p>'}
  </div>
</section>
${ctaBand()}
</main>
${footer()}
</body>
</html>
`;
  write('insights/index.html', page);
}

// ---------- home ----------
{
  const homeFaq = [
    { q: '어떤 대표님과 일하나요?', a: '코치, 상담사, 학원·어린이집·필라테스 원장님처럼 실력은 있는데 인스타에서 잘 알려지지 않은 1인 대표님과 일해요.' },
    { q: '무료 계정 분석은 뭘 해 주나요?', a: '대표님 계정을 직접 보고 첫인상, 반응이 없는 이유, 다음에 올릴 콘텐츠 3가지를 정리해 드려요. 신청 후 3영업일 안에 리포트로 보내 드리고, 원하시면 15분 통화도 해요.' },
    { q: '제가 직접 찍어야 하나요?', a: '직접 촬영(100만원)은 대표님이 찍고 저희가 촬영 가이드를 드려요. 방문 촬영과 세팅 촬영은 PD가 찾아가서 찍어요.' },
    { q: '비용은 얼마인가요?', a: '릴스 8편 기준 100만원, 220만원, 300만원이에요(VAT 별도, 2026년 9월 기준). 기간과 업로드 대행은 계약 전에 일정에 맞춰 정해요.' },
  ];
  const latest = posts.slice(0, 3);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: BRAND, url: `${SITE}/`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE}/#org` } },
    { ...ORG, makesOffer: [
      { '@type': 'Offer', name: '직접 촬영 (Self) · 릴스 8편', price: '1000000', priceCurrency: 'KRW' },
      { '@type': 'Offer', name: '방문 촬영 (Standard) · 릴스 8편', price: '2200000', priceCurrency: 'KRW' },
      { '@type': 'Offer', name: '세팅 촬영 (Premium) · 릴스 8편', price: '3000000', priceCurrency: 'KRW' },
    ] },
    PERSON,
    { '@type': 'FAQPage', mainEntity: homeFaq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ] };
  const step = (no, title, desc, dark) => `<div class="step${dark ? ' is-dark' : ''}"><div class="step-no num">${no}</div><div class="step-title">${title}</div><div class="step-desc">${desc}</div></div>`;
  const proof = (url, img, who, stat) => `<a class="proof-card" href="${url}" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/${img})"></div><div class="proof-card__cap"><b>${stat}</b><span>${who}</span></div></a>`;
  const plan = (en, ko, price, desc, pick) => `<div class="plan-mini__item${pick ? ' is-pick' : ''}">${pick ? '<div class="plan-mini__badge">가장 많이 선택</div>' : ''}<div class="plan-mini__name">${ko} <em>${en}</em></div><div class="plan-mini__price num">${price}<span>만원</span></div><p>${desc}</p></div>`;
  const page = `${head({ title: `${BRAND} | 코치·상담사·원장님을 위한 인스타 콘텐츠 제작`, description: '실력은 있는데 인스타에서 문의가 없는 대표님께. 인터뷰, 대본, 촬영, 편집까지 함께 해서 문의가 오는 인스타를 만듭니다. 무료 계정 분석 신청 가능.', path: '/', extra: jsonld(ld) })}
<body class="page page--home">
${nav('home')}
<main>

<section class="chapter chapter--dark home-hero">
  <div class="wrap">
    <div class="home-hero__kicker">코치 · 상담사 · 원장님을 위한 인스타 콘텐츠 제작</div>
    <h1 class="home-hero__title">대표님 이야기로<br><span>문의가 오는</span> 인스타를<br class="br-m"> 만듭니다.</h1>
    <p class="home-hero__lede">인터뷰부터 대본, 촬영, 편집까지 함께 해요.</p>
    <div class="home-hero__actions">
      <a class="btn btn--red" href="/lead">무료 계정 분석 받기</a>
      <a class="btn btn--ghost" href="/portfolio">작업 사례 보기</a>
    </div>
    <dl class="home-hero__proof">
      <div><dt class="num">200만+</dt><dd>만든 콘텐츠 누적 조회수</dd></div>
      <div><dt class="num">30팀+</dt><dd>함께한 브랜드</dd></div>
      <div><dt class="num">17년</dt><dd>대표의 공기업 기획 경력</dd></div>
    </dl>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">이런 대표님께 맞아요</div>
    <ul class="pain-list pain-list--3">
      <li>매일 올리는데<br>문의가 없어요</li>
      <li>내 일을 뭐라고<br>소개할지 모르겠어요</li>
      <li>뭘 올려야 할지<br>막막해요</li>
    </ul>
  </div>
</section>

<section class="chapter chapter--dim">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">진행 방식</div>
    <h2 class="headline">대표님은 이야기만 해 주세요.<br><span class="hl">나머지는 저희가</span> 해요.</h2>
    <div class="steps">
      ${step('01', '이야기 듣기', '인터뷰로 대표님의 경험과 강점을 들어요')}
      ${step('02', '할 말 정리', '고객이 바로 알아듣는 말로 바꿔요')}
      ${step('03', '영상 만들기', '대본, 촬영 가이드, 편집까지 해 드려요', true)}
      ${step('04', '문의로 연결', '영상을 본 고객이 상담을 신청하게 만들어요')}
    </div>
  </div>
</section>

<section class="chapter chapter--dark">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">결과</div>
    <h2 class="headline">광고비 없이 만든 <span class="hl">결과</span>예요</h2>
    <div class="proof-grid">
      ${proof('https://www.instagram.com/p/DayqhlbE3a7/', 'img-01.jpg', '부모교육 코치', '댓글 8,000개')}
      ${proof('https://www.instagram.com/youandme_colorlab/', 'img-04.jpg', '어린이집 원장', '조회수 37.6만')}
      ${proof('https://www.instagram.com/roko_725/', 'img-07.jpg', '부부관계 상담가', '조회수 30.1만')}
      ${proof('https://www.instagram.com/heart.and.color_/', 'img-10.jpg', '아동 미술치료', '조회수 25.4만')}
    </div>
    <p class="footnote footnote--dark"><a href="/portfolio">작업 사례 12편 모두 보기 →</a></p>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">비용</div>
    <h2 class="headline">촬영 방법만 고르시면 돼요</h2>
    <div class="plan-mini">
      ${plan('Self', '직접 촬영', 100, '대표님이 찍어요.<br>촬영 가이드를 드려요.')}
      ${plan('Standard', '방문 촬영', 220, 'PD가 2번 찾아가서<br>인터뷰처럼 찍어요.', true)}
      ${plan('Premium', '세팅 촬영', 300, 'PD가 3번 찾아가서<br>제품·공간까지 세팅해 찍어요.')}
    </div>
    <p class="footnote">모두 릴스 8편 · 대본 · 편집 · 월 1회 리포트 포함 · VAT 별도 <a href="/portfolio">자세히 보기 →</a></p>
  </div>
</section>

${latest.length ? `<section class="chapter chapter--dim">
  <div class="wrap">
    <div class="kicker-row kicker-row--plain"><span class="eyebrow eyebrow--ko">블로그</span><a class="more-link" href="/insights">전체 보기 →</a></div>
    <h2 class="headline">인스타 고민, 쉽게 풀어 드려요</h2>
    <div class="post-grid post-grid--compact">${latest.map(card).join('')}</div>
  </div>
</section>` : ''}

<section class="chapter chapter--dark founder-chapter">
  <div class="founder-bg" style="background-image:url(/images/img-13.jpg)"></div>
  <div class="founder-bg founder-bg--m" style="background-image:url(/images/img-14.jpg)"></div>
  <div class="wrap">
    <div class="founder-row"><div>
      <div class="eyebrow eyebrow--ko">대표 소개</div>
      <div class="founder-name">정세연</div>
      <div class="founder-quote">“브랜딩은 결국 이야기예요.”</div>
      <p class="founder-plain">LH공사에서 17년 동안 기획 일을 했어요.<br>지금은 대표님들의 이야기를 콘텐츠로 만들어요.<br>『파워루틴핏』을 썼어요.</p>
    </div></div>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="eyebrow eyebrow--ko">자주 묻는 질문</div>
    <div class="faq faq--home">${homeFaq.map(f => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>
</section>

<section class="chapter chapter--dark home-final">
  <div class="wrap">
    <h2 class="closing-head">먼저 무료로<br><span class="line2">내 계정 분석부터 받아 보세요.</span></h2>
    <p class="home-final__desc">3영업일 안에 리포트로 보내 드려요.</p>
    <div class="home-hero__actions">
      <a class="btn btn--red" href="/lead">무료 계정 분석 받기</a>
      <a class="btn btn--ghost" href="${KAKAO}" target="_blank" rel="noopener">카카오톡으로 물어보기</a>
    </div>
  </div>
</section>

</main>
${footer()}
<script src="/js/main.js"></script>
</body>
</html>
`;
  write('index.html', page);
}

// ---------- sitemap / robots / feed ----------
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', lastmod: today, pr: '1.0' },
    { loc: '/portfolio', lastmod: today, pr: '0.9' },
    { loc: '/lead', lastmod: today, pr: '0.8' },
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
<title>${BRAND} 인사이트</title>
<link>${SITE}/insights</link>
<atom:link href="${SITE}/insights/feed.xml" rel="self" type="application/rss+xml"/>
<description>코치·상담사·원장님을 위한 브랜딩·콘텐츠 마케팅 인사이트</description>
<language>ko</language>
${posts.map(p => `<item><title>${esc(p.title)}</title><link>${SITE}${p.path}</link><guid>${SITE}${p.path}</guid><pubDate>${new Date(p.date + 'T09:00:00+09:00').toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.description)}</description></item>`).join('\n')}
</channel>
</rss>
`);
}

// ---------- 쉬운 말 검사: 화면에 보이는 글에 어려운 말이 있으면 경고 ----------
{
  const HARD = ['언어화', '퍼널', '동선', '전환율', '내러티브', '운송', '서사', '구조화', '시그니처', 'end-to-end', '프로파일', '리드', '어트리뷰션', '인지 단계', '자산화'];
  const pages = ['index.html', 'insights/index.html', ...posts.map(p => `insights/${p.slug}/index.html`), 'portfolio/index.html', 'lead/index.html'];
  let warn = 0;
  for (const rel of pages) {
    const f = join(ROOT, rel); if (!existsSync(f)) continue;
    const text = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<[^>]+>/g, ' ');
    for (const w of HARD) { const n = text.split(w).length - 1; if (n) { console.warn(`  [쉬운 말] ${rel}: "${w}" ${n}회`); warn++; } }
  }
  console.log(warn ? `쉬운 말 검사: 경고 ${warn}건` : '쉬운 말 검사: 통과');
}
console.log(`built: home, insights(${posts.length}), sitemap(${posts.length + 4} urls), robots, feed`);
