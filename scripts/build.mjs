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
      ${a('/insights', '인사이트', 'insights')}
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
        <p class="site-foot__desc">코치·상담사·원장님의 전문성을 이야기로 정리해<br>고객이 선택할 이유로 만드는 콘텐츠 브랜딩 스튜디오</p>
      </div>
      <nav class="site-foot__links" aria-label="하단 메뉴">
        <a href="/">홈</a><a href="/portfolio"><span class="nav-lg">서비스·포트폴리오</span><span class="nav-sm">서비스</span></a><a href="/insights">인사이트</a><a href="/lead">무료 계정 분석</a>
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
      <p class="cta-band__title">내 계정은 왜 문의로 이어지지 않을까요?</p>
      <p class="cta-band__desc">대표님 계정을 직접 살펴보고 첫인상 진단, 반응이 없는 이유, 다음에 올릴 콘텐츠 3가지를 정리해 드립니다. 신청 후 3영업일 안에 1:1 리포트로 보내드려요.</p>
    </div>
    <a class="btn btn--red" href="/lead">무료 분석 신청하기</a>
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
        { '@type': 'ListItem', position: 2, name: '인사이트', item: `${SITE}/insights` },
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
      <nav class="crumbs" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/insights">인사이트</a><span>/</span><span>${esc(p.category)}</span></nav>
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
        <p>공기업에서 17년간 계획·기획 일을 하다가, 지금은 코치·상담사·원장님의 전문성을 이야기로 정리하는 콘텐츠를 기획합니다. 30팀 이상의 브랜드·계정 콘텐츠를 맡았고, 『파워루틴핏』을 썼습니다.</p>
        <a href="/portfolio">포트폴리오 보기 →</a>
      </div>
    </aside>
  </div>
</article>
${others.length ? `<section class="related"><div class="wrap"><div class="kicker-row"><span class="eyebrow">More Insights</span><a class="index" href="/insights">전체 보기 →</a></div><div class="post-grid post-grid--2">${others.map(card).join('')}</div></div></section>` : ''}
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
  const page = `${head({ title: `인사이트 | 1인 전문가를 위한 브랜딩·콘텐츠 마케팅 | ${BRAND}`, description: '코치·상담사·원장님을 위한 퍼스널 브랜딩, 스토리 브랜딩, 인스타 문의 동선 이야기. 연구와 공식 자료를 근거로 대표님 계정에 바로 적용할 방법을 정리합니다.', path: '/insights', extra: jsonld(ld) })}
<body class="page page--insights">
${nav('insights')}
<main>
<section class="page-hero">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Insights</span><span class="index num">${String(posts.length).padStart(2, '0')} posts</span></div>
    <h1 class="headline">전문성이 <span class="hl">선택받는 이유</span>가 되도록,<br>근거로 정리한 브랜딩 이야기</h1>
    <p class="subhead">해외 연구와 플랫폼 공식 자료를 읽고, 코치·상담사·원장님 계정에 바로 적용할 수 있는 방법으로 풀어 씁니다.</p>
    ${cats.length > 1 ? `<div class="cat-chips">${cats.map(c => `<span class="cat-chip">${esc(c)}</span>`).join('')}</div>` : ''}
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
    { q: 'RE:WORK STUDIO는 어떤 대표님과 일하나요?', a: '코치, 컨설턴트, 상담사, 학원·어린이집 원장님처럼 자기 분야의 전문성을 가진 1인 사업가와 일합니다. 전문성은 있는데 SNS에서 고객에게 선택받지 못하고 있다면 가장 잘 맞습니다.' },
    { q: '무료 계정 분석은 어떻게 진행되나요?', a: '신청서를 남겨주시면 대표님 계정을 직접 살펴보고 첫인상 진단, 반응이 없는 이유, 다음에 올릴 콘텐츠 3가지를 정리해 3영업일 안에 1:1 리포트로 보내드립니다. 원하시면 15분 통화로 함께 짚어드립니다.' },
    { q: '제가 직접 촬영해야 하나요?', a: 'Self 구성은 대표님이 직접 촬영하시고, 장면별 촬영 가이드와 프롬프트를 드립니다. Standard와 Premium 구성은 PD가 방문해 촬영합니다.' },
    { q: '비용은 얼마인가요?', a: '릴스 8편 기준 Self 100만원, Standard 220만원, Premium 300만원이며 VAT 별도입니다(2026년 9월 기준). 진행 기간과 업로드 대행 여부는 계약 전에 대표님 일정에 맞춰 확정합니다.' },
  ];
  const latest = posts.slice(0, 3);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: BRAND, url: `${SITE}/`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE}/#org` } },
    { ...ORG, makesOffer: [
      { '@type': 'Offer', name: 'Self · 릴스 8편 (직접 촬영)', price: '1000000', priceCurrency: 'KRW' },
      { '@type': 'Offer', name: 'Standard · 릴스 8편 (PD 방문 촬영 2회)', price: '2200000', priceCurrency: 'KRW' },
      { '@type': 'Offer', name: 'Premium · 릴스 8편 (세팅 촬영 3회)', price: '3000000', priceCurrency: 'KRW' },
    ] },
    PERSON,
    { '@type': 'FAQPage', mainEntity: homeFaq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ] };
  const page = `${head({ title: `${BRAND} | 코치·상담사·원장님을 위한 콘텐츠 브랜딩 스튜디오`, description: '전문성은 있는데 SNS에서 선택받지 못하는 대표님을 위해, 흩어진 경험을 정리해 릴스·카드뉴스로 만들고 인지에서 상담까지 이어지는 흐름을 설계합니다. 무료 계정 분석 신청 가능.', path: '/', extra: jsonld(ld) })}
<body class="page page--home">
${nav('home')}
<main>

<section class="chapter chapter--dark home-hero">
  <div class="wrap">
    <div class="home-hero__kicker">코치 · 상담사 · 원장님을 위한 콘텐츠 브랜딩 스튜디오</div>
    <h1 class="home-hero__title">대표님의 전문성을<br>고객이 <span>선택할 이유</span>로 바꿉니다.</h1>
    <p class="home-hero__lede"><span class="nb">흩어진 경험을 정리해 언어로 만들고,</span> <span class="nb">그 언어를 릴스와 카드뉴스로 완성합니다.</span> <span class="nb">인지에서 상담까지 이어지는 흐름을 함께 설계합니다.</span></p>
    <div class="home-hero__actions">
      <a class="btn btn--red" href="/lead">무료 계정 분석 신청</a>
      <a class="btn btn--ghost" href="/portfolio">서비스·포트폴리오 보기</a>
    </div>
    <dl class="home-hero__proof">
      <div><dt class="num">200만+</dt><dd>기획·제작 콘텐츠 누적 조회수</dd></div>
      <div><dt class="num">30팀+</dt><dd>콘텐츠 기획을 맡은 브랜드·계정</dd></div>
      <div><dt class="num">0원</dt><dd>광고 집행 없이 스토리 콘텐츠로</dd></div>
    </dl>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">The Problem</span><span class="index num">01</span></div>
    <h2 class="headline">설명만 하는 계정은 스쳐 지나가고,<br><span class="hl">이야기가 있는 계정</span>만 남습니다</h2>
    <ul class="pain-list">
      <li><span class="pain-list__no num">01</span><span><span class="nb">매일 올리는데</span> <span class="nb">팔로워도, 문의도 늘지 않나요?</span></span></li>
      <li><span class="pain-list__no num">02</span><span><span class="nb">내 전문성을 뭐라고 소개해야 할지</span> <span class="nb">아직도 애매하신가요?</span></span></li>
      <li><span class="pain-list__no num">03</span><span><span class="nb">콘텐츠는 쌓이는데,</span> <span class="nb">수익화는 대체 언제 되나 싶으신가요?</span></span></li>
      <li><span class="pain-list__no num">04</span><span><span class="nb">SNS가 중요하다는 건 알겠는데,</span> <span class="nb">무엇부터 시작할지 막막하신가요?</span></span></li>
    </ul>
    <p class="subhead subhead--punch">답은 콘텐츠 개수가 아니라, <span class="hl">정리된 이야기</span>에 있습니다.</p>
  </div>
</section>

<section class="chapter chapter--dim">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">How We Work</span><span class="index num">02</span></div>
    <h2 class="headline">소재를 더 찾기 전에,<br><span class="hl">순서</span>부터 바로잡습니다</h2>
    <p class="subhead"><span class="nb">전문성이 깊을수록 고객에게 쉽게 설명하는 일은 더 어렵습니다.</span> <span class="nb">그래서 정리부터 시작합니다.</span></p>
    <div class="steps">
      <div class="step"><div class="step-no num">01</div><div class="step-title">정리</div><div class="step-desc">경험·이력·강점을 인터뷰로 꺼내 정리합니다</div></div>
      <div class="step"><div class="step-no num">02</div><div class="step-title">언어화</div><div class="step-desc">핵심 메시지와 시그니처 문장을 만듭니다</div></div>
      <div class="step is-dark"><div class="step-no num">03</div><div class="step-title">스토리</div><div class="step-desc">릴스·카드뉴스로 이야기를 완성합니다</div></div>
      <div class="step"><div class="step-no num">04</div><div class="step-title">자산</div><div class="step-desc">계정에 쌓여 다음 콘텐츠의 기반이 됩니다</div></div>
    </div>
    <div class="journey">
      <div class="journey-row journey-row--ours"><span class="journey-tag">리워크가 하는 일</span><div class="journey-cells"><span>정리</span><span>언어화</span><span>스토리</span><span>자산</span></div></div>
      <div class="journey-row journey-row--theirs"><span class="journey-tag">고객에게 일어나는 일</span><div class="journey-cells"><span>인지</span><span>신뢰</span><span>상품 이해</span><span>상담·구매</span></div></div>
    </div>
  </div>
</section>

<section class="chapter chapter--dark">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Proof</span><span class="index num">03</span></div>
    <h2 class="headline">조회수는 시작입니다.<br>대표님의 <span class="hl">상품</span>까지 이어져야 합니다</h2>
    <p class="subhead">아래는 모두 광고 집행 없이 스토리 기반 콘텐츠만으로 만든 결과입니다. 카드를 누르면 실제 게시물로 연결됩니다.</p>
    <div class="proof-grid">
      <a class="proof-card" href="https://www.instagram.com/p/DayqhlbE3a7/" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/img-01.jpg)"></div><div class="proof-card__cap"><b>@cpa_jamiecoach</b><span>카드뉴스 · 댓글 8,000</span></div></a>
      <a class="proof-card" href="https://www.instagram.com/youandme_colorlab/" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/img-04.jpg)"></div><div class="proof-card__cap"><b>@youandme_colorlab</b><span>릴스 · 조회수 37.6만</span></div></a>
      <a class="proof-card" href="https://www.instagram.com/roko_725/" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/img-07.jpg)"></div><div class="proof-card__cap"><b>@roko_725</b><span>릴스 · 조회수 30.1만</span></div></a>
      <a class="proof-card" href="https://www.instagram.com/heart.and.color_/" target="_blank" rel="noopener"><div class="proof-card__img" style="background-image:url(/images/img-10.jpg)"></div><div class="proof-card__cap"><b>@heart.and.color_</b><span>릴스 · 조회수 25.4만</span></div></a>
    </div>
    <p class="footnote footnote--dark">2026년 9월까지 기획·제작한 콘텐츠 기준 수치입니다. <a href="/portfolio">대표 콘텐츠 12편 전체 보기 →</a></p>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Service</span><span class="index num">04</span></div>
    <h2 class="headline">대표님은 이야기만 들려주세요.<br><span class="hl">무엇을 어떤 순서로</span> 말할지는 저희가 설계합니다</h2>
    <div class="plan-mini">
      <div class="plan-mini__item"><div class="plan-mini__name">Self</div><div class="plan-mini__price num">100<span>만원</span></div><p>릴스 8편 · 대표님이 직접 촬영<br>촬영 가이드·프롬프트 제공</p></div>
      <div class="plan-mini__item is-pick"><div class="plan-mini__badge">가장 많이 선택</div><div class="plan-mini__name">Standard</div><div class="plan-mini__price num">220<span>만원</span></div><p>릴스 8편 · PD 방문 촬영 2회<br>인터뷰형 촬영</p></div>
      <div class="plan-mini__item"><div class="plan-mini__name">Premium</div><div class="plan-mini__price num">300<span>만원</span></div><p>릴스 8편 · PD 방문 촬영 3회<br>제품·공간 세팅 대응</p></div>
    </div>
    <p class="footnote"><b>공통 포함</b> 브랜드 스토리 인터뷰 · 릴스 스크립트 8편 · 장면별 촬영 가이드 · 편집(자막·썸네일) · 월 1회 성과 리포트. 2026년 9월 기준, VAT 별도. <a href="/portfolio">상품 구성 자세히 보기 →</a></p>
  </div>
</section>

${latest.length ? `<section class="chapter chapter--dim">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Insights</span><a class="index" href="/insights">전체 보기 →</a></div>
    <h2 class="headline">근거로 정리한 <span class="hl">브랜딩 이야기</span></h2>
    <p class="subhead">연구와 플랫폼 공식 자료를 읽고, 대표님 계정에 바로 적용할 방법으로 풀어 씁니다.</p>
    <div class="post-grid">${latest.map(card).join('')}</div>
  </div>
</section>` : ''}

<section class="chapter chapter--dark founder-chapter">
  <div class="founder-bg" style="background-image:url(/images/img-13.jpg)"></div>
  <div class="founder-bg founder-bg--m" style="background-image:url(/images/img-14.jpg)"></div>
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Founder</span><span class="index num">05</span></div>
    <div class="founder-row"><div>
      <div class="founder-name">정세연</div>
      <div class="founder-role">RE:WORK STUDIO 대표</div>
      <div class="founder-quote">“브랜딩은 스토리다 — 저는 스토리텔러 마케팅 전문가입니다”</div>
      <div class="founder-stats">
        <div class="stat"><div class="stat-num num">17년</div><div class="stat-label">LH공사 근무<br>계획·기획 업무</div></div>
        <div class="stat"><div class="stat-num num">30팀+</div><div class="stat-label">콘텐츠 기획을 맡은<br>브랜드·계정</div></div>
        <div class="stat"><div class="stat-num num">7팀</div><div class="stat-label">현재 진행 중인<br>클라이언트</div></div>
        <div class="stat"><div class="stat-num num">200만+</div><div class="stat-label">기획·제작 콘텐츠<br>누적 조회수</div></div>
      </div>
      <div class="founder-list">
        <div class="founder-item"><div class="founder-tag">현</div><div>RE:WORK STUDIO 대표 — 콘텐츠 브랜딩 &amp; SNS 기획대행</div></div>
        <div class="founder-item"><div class="founder-tag">저서</div><div>『파워루틴핏』 저자</div></div>
      </div>
    </div></div>
  </div>
</section>

<section class="chapter">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">FAQ</span><span class="index num">06</span></div>
    <h2 class="headline">자주 묻는 질문</h2>
    <div class="faq faq--home">${homeFaq.map(f => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>
</section>

<section class="chapter chapter--dark">
  <div class="wrap">
    <div class="kicker-row"><span class="eyebrow">Start</span><span class="index num">07</span></div>
    <h2 class="closing-head">이야기를 정리하면, 브랜드가 됩니다.<br><span class="line2">다음 주인공은 대표님입니다.</span></h2>
    <div class="closing-cards">
      <a class="cl-card cl-card--hero" href="/lead">
        <div>
          <div class="cl-tag">Start · 이번 달 신청분 한정</div>
          <div class="cl-title">무료 계정 분석 신청 →</div>
          <div class="cl-desc"><span class="nb">대표님 계정을 직접 뜯어보고</span> <span class="nb"><b>첫인상 진단 · 반응이 없는 이유 ·</b></span> <span class="nb"><b>다음에 올릴 콘텐츠 3가지</b>를 정리해 드립니다.</span> <span class="nb">신청 후 <b>3영업일 안에</b> 1:1 리포트로 보내드리고,</span> <span class="nb">원하시면 15분 통화로 짚어드립니다.</span></div>
        </div>
        <span class="cl-go">무료 신청하기</span>
      </a>
      <a class="cl-card cl-card--kakao" href="${KAKAO}" target="_blank" rel="noopener">
        <div>
          <div class="cl-tag">Follow</div>
          <div class="cl-title">카카오톡 채널 추가 →</div>
          <div class="cl-desc"><span class="nb">채널을 추가하시면</span> <span class="nb">상담 문의와 콘텐츠 소식을</span> <span class="nb">카톡으로 바로 받아보실 수 있어요.</span></div>
        </div>
        <img class="cl-qr" src="/images/img-15.png" alt="리워크 스튜디오 카카오톡 채널 QR">
      </a>
      <a class="cl-card" href="${INSTA}" target="_blank" rel="noopener">
        <div class="cl-tag">Ask</div>
        <div class="cl-title">인스타그램 DM →</div>
        <div class="cl-desc">@rework_studio99 로 편하게 메시지 주세요.</div>
      </a>
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

console.log(`built: home, insights(${posts.length}), sitemap(${posts.length + 4} urls), robots, feed`);
