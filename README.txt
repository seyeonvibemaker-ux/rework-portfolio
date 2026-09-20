RE:WORK STUDIO — 포트폴리오 겸 상품설명서
빌더 트랙 1주차 과제 제출본 / 정세연 / 2026.09

■ 실행 방법
  index.html 을 브라우저로 열면 됩니다. (별도 서버 불필요)

■ 파일 구조
  index.html        메인 페이지 — 포트폴리오 겸 상품설명서 (10개 섹션)
  consult.html      서브 페이지 — 무료 계정 분석 신청 (index.html 마지막 장 CTA로 연결)
  css/style.css     메인 페이지 스타일 · 반응형
  css/consult.css   신청 페이지 스타일 · 반응형
  js/main.js        스크롤 진입 애니메이션 (IntersectionObserver)
  js/consult.js     폼 유효성 검사 · 제출 처리 · 완료 화면 전환
  images/           포트폴리오 썸네일 12장, 대표 사진 2장, 카카오톡 QR 1장

■ 페이지 구성
  01 커버            고객 고민 4가지 + 콘텐츠 흐름(인지→신뢰→상품 이해→상담)
  02 ABOUT          브랜드 정의와 3가지 축
  03 방법론          정리 → 언어화 → 스토리 → 자산
  04 매니페스토      선택받는 브랜드는 운이 아니라 스토리입니다
  05 상품            제공 콘텐츠 6종 + 플랜 3종 + 추가 상품
  06 포트폴리오      인스타그램 피드 재구성 (클릭 시 실제 게시물로 이동)
                    + CTA 유형별 설계 6종
  07 CAPABILITY     end-to-end 제작 역량 6가지
  08 대표 프로필
  09 협업 브랜드
  10 클로징          무료 계정 분석 신청 · 카카오톡 채널 · DM

■ 무료 상담 신청 페이지 (consult.html)
  - 구글 폼 UI를 쓰지 않고 브랜드 디자인에 맞춰 직접 제작
  - 입력값은 숨김 iframe을 통해 구글 폼 엔드포인트로 전송 → 구글 시트에 자동 수집
  - 필수값 검증, 전송 중 버튼 잠금, 완료 화면 전환까지 JS로 처리
  - 개인정보 수집·이용 동의 항목 포함

■ 기술 사항
  - 순수 HTML / CSS / JavaScript (프레임워크·빌드도구 없음)
  - 외부 의존성: Google Fonts (Archivo, Gothic A1, Noto Sans KR)
  - 반응형: 1024 / 820 / 560 / 430px 브레이크포인트
  - 한글 줄바꿈 제어: word-break: keep-all + 절 단위 inline-block 래핑
  - prefers-reduced-motion 대응 (애니메이션 비활성화)
  - JS 미동작 시에도 전체 콘텐츠가 보이도록 progressive enhancement 적용
