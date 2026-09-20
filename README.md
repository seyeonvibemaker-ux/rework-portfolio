# RE:WORK STUDIO — 포트폴리오 겸 상품설명서

1인 사업가를 위한 콘텐츠 브랜딩 스튜디오 소개 페이지.
순수 HTML / CSS / JavaScript (프레임워크·빌드도구 없음).

## 배포 경로

| URL | 설명 |
| --- | --- |
| `/portfolio` | 메인 페이지 — 포트폴리오 겸 상품설명서 (10개 섹션) |
| `/lead` | 무료 계정 분석 신청 페이지 |
| `/` | `/portfolio` 로 리다이렉트 |

도메인: **reworkstudio.net**

## 구성

| 파일 | 설명 |
| --- | --- |
| `portfolio/index.html` | 메인 페이지 (`/portfolio`) |
| `lead/index.html` | 무료 상담 신청 페이지 (`/lead`) |
| `css/style.css` | 메인 페이지 스타일 · 반응형 |
| `css/consult.css` | 신청 페이지 스타일 · 반응형 |
| `js/main.js` | 스크롤 진입 애니메이션 (IntersectionObserver) |
| `js/consult.js` | 폼 유효성 검사 · 제출 처리 · 완료 화면 전환 |
| `images/` | 포트폴리오 썸네일 12장, 대표 사진 2장, QR 1장 |
| `vercel.json` | `/` → `/portfolio`, 구주소(`index.html`/`consult.html`) → 새 경로 리다이렉트 |

## 로컬 실행

정적 서버로 루트 디렉토리를 서빙하세요 (자산이 절대경로 `/css`, `/js`, `/images` 를 참조하므로 `file://` 로 열면 깨집니다). 예:

```bash
npx serve .
```

## 기술 사항

- 외부 의존성: Google Fonts (Archivo, Gothic A1, Noto Sans KR)
- 반응형 브레이크포인트: 1024 / 820 / 560 / 430px
- 한글 줄바꿈 제어: `word-break: keep-all` + 절 단위 inline-block 래핑
- `prefers-reduced-motion` 대응
- JS 미동작 시에도 전체 콘텐츠가 보이는 progressive enhancement

자세한 페이지 구성은 [README.txt](README.txt) 참고.

---
정세연 · 2026.09
