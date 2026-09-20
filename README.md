# RE:WORK STUDIO — 포트폴리오 겸 상품설명서

1인 사업가를 위한 콘텐츠 브랜딩 스튜디오 소개 페이지.
순수 HTML / CSS / JavaScript (프레임워크·빌드도구 없음).

## 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 메인 페이지 — 포트폴리오 겸 상품설명서 (10개 섹션) |
| `consult.html` | 무료 계정 분석 신청 페이지 |
| `css/style.css` | 메인 페이지 스타일 · 반응형 |
| `css/consult.css` | 신청 페이지 스타일 · 반응형 |
| `js/main.js` | 스크롤 진입 애니메이션 (IntersectionObserver) |
| `js/consult.js` | 폼 유효성 검사 · 제출 처리 · 완료 화면 전환 |
| `images/` | 포트폴리오 썸네일 12장, 대표 사진 2장, QR 1장 |

## 로컬 실행

`index.html` 을 브라우저로 열면 됩니다. (별도 서버 불필요)

## 기술 사항

- 외부 의존성: Google Fonts (Archivo, Gothic A1, Noto Sans KR)
- 반응형 브레이크포인트: 1024 / 820 / 560 / 430px
- 한글 줄바꿈 제어: `word-break: keep-all` + 절 단위 inline-block 래핑
- `prefers-reduced-motion` 대응
- JS 미동작 시에도 전체 콘텐츠가 보이는 progressive enhancement

자세한 페이지 구성은 [README.txt](README.txt) 참고.

---
정세연 · 2026.09
