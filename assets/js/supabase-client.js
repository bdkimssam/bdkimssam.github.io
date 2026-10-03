// ============================================================
// Supabase 공용 클라이언트 설정
// 모든 페이지(index.html, dashboard.html, admin/*.html)가 이 파일을 불러와 씁니다.
//
// "BD Kimssam" 프로젝트의 Project URL / anon public key (2026-10-03 연결)
// ============================================================
const SUPABASE_URL = 'https://reuzxqlhncwrwswadbvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldXp4cWxobmN3cndzd2FkYnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5OTQ2MjUsImV4cCI6MjEwNjU3MDYyNX0.ASZxYJgbvDgL1sMXibKvte3rY_WtzbGrbYbZBaOaXC8';

// 모든 페이지에서 window.sb 로 접근해서 쓸 수 있도록 전역에 노출
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

// ------------------------------------------------------------
// 관리자 로그인 비밀번호 — 원장님과 강사쌤 비밀번호를 다르게 둡니다.
// ------------------------------------------------------------
// DB쪽 함수(RPC)도 이 두 비밀번호로 역할을 구분합니다:
//  - 원장님 전용 기능(공지 작성/숙제인증 확인/TLP/학년 진급/학생 강의실 수정)은
//    DIRECTOR_PASSWORD만 통과하도록 DB에서 체크하고 있어서, 강사쌤 비밀번호로는 절대 안 됩니다.
//  - 강사쌤+원장님 공통 기능(주간진도표/교재요청/상벌점)은 두 비밀번호 다 통과합니다.
// 비밀번호를 바꾸면 이 두 줄과 DB쪽 함수(SQL)를 같이 맞춰줘야 합니다.
const DIRECTOR_PASSWORD = 'bdkimssam2026'; // 원장님 전용
const TEACHER_PASSWORD = 'bdkimssam';      // 강사쌤 4개 강의실 공통

// 로그인 화면의 "강의실" 선택지. 맨 앞 "원장님"은 역할 구분용이고, 나머지는 강사쌤용 강의실입니다.
// 실제 이름으로 바꾸고 싶으면 이 배열만 수정하면 됩니다.
const CLASSROOMS = ['원장님', '강의실 1', '강의실 2', '강의실 4', '강의실 5'];
const DIRECTOR_LABEL = '원장님';

// admin/login.html 에서 로그인 성공 시 세션 저장에 사용하는 키 이름들
const ADMIN_SESSION_KEY = 'admin_logged_in';
const ADMIN_CLASSROOM_KEY = 'admin_classroom';
const ADMIN_PASSWORD_KEY = 'admin_password'; // 로그인할 때 실제로 맞은 비밀번호(원장님/강사쌤)를 저장

// 관리자 화면들이 RPC 호출할 때 p_password 자리에 넣는 값.
// (로그인 시 저장된, 실제로 통과한 비밀번호를 그대로 돌려줌)
function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) || '';
}

// admin/*.html 페이지들이 맨 위에서 호출하는 인증 가드.
// 로그인 안 돼 있으면 login.html로 보냄.
function requireAdminAuth() {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
    window.location.href = 'login.html';
  }
}

// 현재 로그인한 선생님의 강의실/역할 (화면 상단에 표시하거나, 입력 데이터에 자동으로 붙일 때 사용)
function getAdminClassroom() {
  return sessionStorage.getItem(ADMIN_CLASSROOM_KEY) || '';
}

// 원장님으로 로그인했는지 여부 (공지 작성·숙제인증 확인처럼 원장님 전용 화면에서 사용)
function isAdminDirector() {
  return getAdminClassroom() === DIRECTOR_LABEL;
}

// 원장님 전용 화면 맨 위에서 호출. 강사쌤 계정으로 들어오면 관리자 홈으로 돌려보냄.
function requireDirector() {
  requireAdminAuth();
  if (!isAdminDirector()) {
    alert('원장님 전용 화면입니다.');
    window.location.href = 'index.html';
  }
}
