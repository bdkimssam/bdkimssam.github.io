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
// 관리자(선생님) 로그인 공용 비밀번호
// ------------------------------------------------------------
// 이번 주말 안에 빠르게 끝내기 위해 "공유 비밀번호 1개 + 강의실 선택" 방식으로 둡니다.
// 비밀번호를 바꾸고 싶으면 아래 한 줄만 수정하면 전체 관리자 페이지에 바로 반영됩니다.
const ADMIN_PASSWORD = 'bdkimssam2026'; // TODO: 원하시는 비밀번호로 바꾸세요

// 강의실 목록 (관리자 로그인 시 선택). 실제 이름으로 바꾸고 싶으면 이 배열만 수정하면 됩니다.
const CLASSROOMS = ['강의실 1', '강의실 2', '강의실 4', '강의실 5'];

// admin/login.html 에서 로그인 성공 시 세션 저장에 사용하는 키 이름들
const ADMIN_SESSION_KEY = 'admin_logged_in';
const ADMIN_CLASSROOM_KEY = 'admin_classroom';

// admin/*.html 페이지들이 맨 위에서 호출하는 인증 가드.
// 로그인 안 돼 있으면 login.html로 보냄.
function requireAdminAuth() {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
    window.location.href = 'login.html';
  }
}

// 현재 로그인한 선생님의 강의실 (화면 상단에 표시하거나, 입력 데이터에 자동으로 붙일 때 사용)
function getAdminClassroom() {
  return sessionStorage.getItem(ADMIN_CLASSROOM_KEY) || '';
}
