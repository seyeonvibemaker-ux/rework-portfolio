# reworkstudio.net 홈페이지 기획 (2026-11-03)

## 왜 바꾸나
- 9/17 기획: 홈페이지는 방법론·사례·진단 기준을 쌓는 **원본 자산 채널**, 네이버 블로그는 각색한 배포 채널. 모든 콘텐츠의 종착지는 **무료 계정 분석 신청(/lead)**.
- 9/20 배포본은 `/portfolio`(상품설명서)와 `/lead`(신청) 두 장뿐. `/`는 `/portfolio`로 임시 이동.
- 빠진 것: 홈페이지 블로그(인사이트), 사이트 메뉴, 검색 기본 설정(robots·sitemap·canonical·OG·구조화 데이터), www/apex 중복 주소 정리.

## 사이트 구조
| 주소 | 역할 |
|---|---|
| `/` | 홈. 누구를 돕는지, 방식, 성과, 상품 요약, 최신 인사이트, 대표 소개, FAQ, 신청 |
| `/portfolio` | 서비스·포트폴리오 상세 (기존 유지, 상단 메뉴만 추가) |
| `/insights` | 인사이트 목록 (홈페이지 원본 글) |
| `/insights/{slug}` | 인사이트 글 |
| `/lead` | 무료 계정 분석 신청 (기존 유지, 메뉴·메타만 추가) |

상단 메뉴: 로고(홈) · 서비스·포트폴리오 · 인사이트 · [무료 계정 분석]

## 인사이트 운영
- 카테고리: 퍼스널 브랜딩 / 스토리 브랜딩 / 문의 동선 (필요 시 확장)
- 글 양식: `rework-content-writing-rules.md` 그대로 (훅 → 3줄 요약 → 근거 → 리워크 해석 → 업종 적용 → 실행 3가지 → 무료 분석 CTA) + FAQ + 출처 목록 + 저자 박스
- 네이버 블로그 글을 그대로 복사하지 않는다 (유사문서 위험). 같은 주제라도 홈페이지용으로 새로 쓴다.
- 글 추가 방법: `content/insights/{slug}.md` 작성 → `node scripts/build.mjs` → 커밋·푸시

## 검색(SEO·GEO) 기본
- 대표 주소: `https://reworkstudio.net` (www → apex 301)
- 모든 페이지 canonical, description, OG/Twitter 카드
- 구조화 데이터: 홈 ProfessionalService + Person + FAQPage, 글 BlogPosting + BreadcrumbList + FAQPage
- `robots.txt`, `sitemap.xml`, `/insights/feed.xml`(RSS)
- 배포 후 할 일(관리자 권한 필요): Google Search Console·네이버 서치어드바이저 소유 확인, 사이트맵 제출

## 이번에 하지 않는 것
- 상담 폼 구조·가격·성과 수치 변경
- 로그인·결제 (7월 Next.js 기획의 Phase 2)
