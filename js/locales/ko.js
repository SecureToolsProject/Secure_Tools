export const ko = {
  metadata: {
    home: { title: "Secure Tools — 일상 파일을 위한 프라이빗 도구", description: "파일을 업로드하지 않고 브라우저에서 비공개로 변환, 확인, 처리하세요. 계정, 분석, 추적이 없습니다." },
    privacy: { title: "개인정보 보호 — Secure Tools", description: "Secure Tools가 파일을 로컬에서 처리하고 추적을 배제하며 환경설정에만 로컬 저장소를 사용하는 방식입니다." },
    about: { title: "소개 — Secure Tools", description: "Secure Tools가 단순히 믿는 대신 직접 검증할 수 있는 오픈 소스 로컬 우선 파일 도구를 만드는 이유입니다." },
    notFound: { title: "페이지를 찾을 수 없음 — Secure Tools", description: "요청한 Secure Tools 페이지를 찾을 수 없습니다." },
    imageToPdf: { title: "이미지를 PDF로 — Secure Tools", description: "JPEG, PNG, WebP 이미지를 브라우저에서만 처리해 하나의 PDF로 만드세요." },
  },
  common: {
    skip: "본문으로 건너뛰기", brandTagline: "기기에서 처리되는 프라이빗 유틸리티",
    nav: { tools: "도구", privacy: "개인정보 보호", source: "소스", about: "소개" },
    language: "언어", theme: "테마", themes: { system: "시스템", light: "라이트", dark: "다크" }, footerStatement: "파일은 사용자의 기기에 머뭅니다.",
  },
  hero: {
    eyebrow: "로컬 우선 파일 유틸리티", title: "일상 파일을 위한 프라이빗 도구.", description: "파일을 기기에서 직접 변환하고 확인하고 처리하세요. 업로드, 계정, 추적이 없습니다.",
    primary: "도구 살펴보기", secondary: "개인정보 보호 확인", trust: "로컬 처리 · 오픈 소스 · 추적 없음", proofLabel: "기기 밖으로 나가는 것", proofValue: "없음", proofNote: "핵심 도구는 브라우저 메모리에서 파일 내용을 처리합니다.",
  },
  tools: {
    eyebrow: "도구", title: "쓸모에 집중하고, 상태는 정직하게.", description: "로컬에서 작동하는 핵심 파일 도구 모음입니다. 사용할 수 있는 도구와 개발 중인 도구를 명확히 구분합니다.",
    categories: { pdf: "PDF", image: "이미지", privacy: "개인정보 보호" }, imagesToPdf: "이미지를 PDF로", mergePdf: "PDF 합치기", splitPdf: "PDF 나누기", imageConverter: "이미지 변환기", imageCompressor: "이미지 압축기", imageResizer: "이미지 크기 조절", metadataInspector: "메타데이터 확인", metadataCleaner: "메타데이터 제거",
    available: "사용 가능", comingSoon: "준비 중", availabilityNote: "현재 프로토타입은 분리되어 있으며, 정식 도구는 이후 스프린트에서 준비됩니다.",
  },
  why: {
    eyebrow: "Secure Tools를 선택하는 이유", title: "더 단순한 개인정보 보호 모델.", description: "Secure Tools는 핵심 파일 처리 과정에서 서버를 제외해 신뢰해야 할 대상을 줄입니다.",
    local: { title: "로컬 처리", body: "파일은 브라우저 안에서 사용자의 기기로 처리됩니다." }, accounts: { title: "계정 없음", body: "기본 도구는 가입이나 개인 프로필 없이 작동합니다." }, tracking: { title: "추적 없음", body: "분석, 행동 추적기, 광고 픽셀이 없습니다." }, network: { title: "최소한의 네트워크 의존", body: "핵심 처리는 외부 런타임 서비스에 의존하지 않습니다." },
  },
  verify: {
    eyebrow: "개인정보 보호 확인", title: "저희 말을 그대로 믿지 마세요.", description: "네트워크 활동을 직접 살펴보고 파일이 기기 밖으로 나가지 않는지 확인할 수 있습니다.",
    step1: "브라우저 개발자 도구를 엽니다.", step2: "네트워크 탭을 선택합니다.", step3: "샘플 파일로 Secure Tool을 실행합니다.", step4: "파일이 업로드되지 않는지 확인합니다.", source: "소스 보기", architecture: "개인정보 보호 구조",
  },
  openSource: { eyebrow: "오픈 소스", title: "처음부터 열려 있습니다.", description: "Secure Tools는 개인정보 보호 주장을 단순히 믿는 대신 직접 살펴볼 수 있도록 만들어집니다.", action: "소스 둘러보기" },
  privacy: {
    eyebrow: "개인정보 보호 모델", title: "개인정보 보호는 구조적 선택입니다.", intro: "Secure Tools는 파일 내용을 브라우저에서 로컬로 처리하도록 설계되었습니다. 이 페이지는 미완성 기능에 대한 약속이 아닌 현재의 기술 모델을 설명합니다.",
    localTitle: "로컬 파일 처리", localBody: "지원되는 도구는 브라우저 메모리에서 파일을 읽고 변환합니다. 파일 내용은 Secure Tools 서버로 전송되지 않습니다.", collectionTitle: "계정과 분석 없음", collectionBody: "이 웹 허브에는 사용자 계정, 분석, 행동 추적, 광고, 추적 픽셀이 없습니다.", storageTitle: "환경설정 저장", storageBody: "localStorage는 이 기기에서 선택한 언어와 테마를 기억하는 용도로만 사용됩니다.", linksTitle: "외부 링크", linksBody: "GitHub 같은 외부 링크를 열면 Secure Tools를 벗어나며 해당 서비스의 정책이 적용됩니다.",
  },
  about: {
    eyebrow: "소개", title: "작은 도구, 검증 가능한 신뢰.", intro: "Secure Tools는 브라우저에서 로컬로 작동하는 일상 파일 도구를 모은 개인정보 보호 중심 프로젝트입니다.",
    purposeTitle: "만든 이유", purposeBody: "일상적인 파일 작업 때문에 개인 문서를 알 수 없는 서버에 올리거나 계정을 만들 필요는 없어야 합니다.", philosophyTitle: "로컬 우선, 그리고 개방성", philosophyBody: "이 프로젝트는 누구나 소스와 네트워크 검사를 통해 검증할 수 있는 정적이고 이해하기 쉬운 코드와 개인정보 보호 모델을 지향합니다.",
  },
  imageToPdf: {
    eyebrow: "이미지 도구", title: "이미지를 PDF로", description: "JPEG, PNG, WebP 이미지를 원하는 순서로 정리해 하나의 PDF로 저장하세요. 모든 처리는 이 기기에서 이루어집니다.",
    drop: { title: "이미지 추가", description: "파일을 여기에 놓거나 선택기를 사용하세요. JPEG, PNG, WebP를 함께 추가할 수 있습니다.", choose: "이미지 선택", localTitle: "로컬에서 처리됩니다.", localBody: "이미지는 이 기기를 떠나지 않습니다.", privacyLink: "개인정보 보호 방식" },
    queue: { title: "이미지 순서", count: "이미지: {count}개", empty: "아직 선택한 이미지가 없습니다. 추가한 순서대로 PDF 페이지가 만들어집니다.", previewAlt: "{name} 미리보기", meta: "{size} · {page}페이지", moveUp: "이미지를 위로 이동", moveDown: "이미지를 아래로 이동", remove: "이미지 제거" },
    settings: {
      title: "PDF 설정", filename: "출력 파일명", filenameHelp: ".pdf 확장자는 자동으로 추가됩니다.", pageSize: "페이지 크기", a4: "A4", letter: "Letter", imageSize: "이미지 크기에 맞춤",
      orientation: "페이지 방향", auto: "자동", portrait: "세로", landscape: "가로", fit: "이미지 맞춤", contain: "전체 이미지 표시", cover: "페이지 채우기", margin: "여백 (mm)",
      quality: "이미지 품질", qualityBest: "최고", qualityHigh: "높음", qualityBalanced: "균형", qualitySmall: "용량 절약", autoDownload: "생성 후 자동 다운로드", clearAfterSave: "저장 후 이미지 참조 정리", pdfFile: "PDF 문서",
    },
    actions: { generate: "PDF 생성 및 저장", add: "이미지 더 추가", clear: "전체 비우기" },
    status: {
      added: "이미지 {count}개를 추가했습니다.", addedWithRejected: "지원되는 이미지 {added}개를 추가하고 지원하지 않는 파일 {rejected}개를 건너뛰었습니다.", removed: "이미지를 제거했습니다.", reordered: "이미지 순서를 변경했습니다.", cleared: "이미지 목록을 비웠습니다.",
      generating: "기기에서 PDF를 생성하고 있습니다…", progress: "{total}페이지 중 {completed}페이지 처리 중…", saved: "{count}페이지 PDF를 저장했습니다.", downloaded: "{name} 파일을 다운로드했습니다.", savedAndCleared: "PDF를 저장하고 이미지 참조를 정리했습니다.", saveCancelled: "저장을 취소했습니다. 파일은 기록되지 않았습니다.",
    },
    errors: {
      unsupported: "JPEG, PNG 또는 WebP 이미지 파일을 선택하세요.", noFiles: "PDF를 생성하기 전에 이미지를 하나 이상 추가하세요.", decode: "{name} 파일을 읽을 수 없습니다. 파일이 손상되었거나 이 브라우저에서 지원하지 않을 수 있습니다.",
      imageExport: "이미지가 너무 크거나 PDF용으로 준비할 수 없습니다.", canvas: "이 브라우저에서는 PDF용 이미지를 준비할 수 없습니다.", library: "로컬 PDF 라이브러리를 불러오지 못했습니다.", generation: "PDF를 생성하지 못했습니다. 이미지 수나 크기를 줄여 다시 시도하세요.", save: "저장 위치를 열 수 없습니다. 다시 시도하세요.",
    },
  },
  notFound: { eyebrow: "404", title: "이 페이지는 존재하지 않습니다.", description: "주소가 오래되었거나 잘못 입력되었을 수 있습니다.", action: "홈으로 돌아가기" },
};
