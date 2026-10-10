# Supabase DB 스키마 (BD Kimssam 프로젝트)

이 문서는 실제 Supabase DB의 테이블 구조를 기록해둔 참고 파일입니다.
코드(html)만 봐서는 DB 구조를 알 수 없기 때문에, 작업 전 추측하지 않고 이 파일을 먼저 확인합니다.

**마지막 확인일: 2026-10-05** (스키마가 바뀌면 이 날짜도 같이 갱신할 것)

스키마가 바뀐 것 같거나 이 파일에 없는 테이블/컬럼이 필요하면, 아래 쿼리를 Supabase SQL Editor에서 실행해서 결과를 다시 받아 이 파일을 갱신합니다 (100행 제한에 걸리지 않도록 테이블당 한 줄로 집계):

```sql
select
  table_name,
  string_agg(
    column_name || ' ' || data_type
      || case when is_nullable = 'NO' then ' NOT NULL' else '' end
      || case when column_default is not null then ' DEFAULT ' || column_default else '' end,
    ', ' order by ordinal_position
  ) as columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;
```

---

## 학생/학부모 기본 정보

### `student_codes` — 원장님이 발급하는 학생 코드 (최소 정보, 로그인 매칭용)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_name` text NOT NULL
- `student_code` text NOT NULL (PK 역할, 예: "26H-016")
- `parent_email` text NOT NULL — 카카오 로그인 매칭에 쓰이는 이메일
- `secret` text
- `first_enrolled_date` date
- `created_at` timestamptz NOT NULL DEFAULT now()
- `withdrawn` boolean NOT NULL DEFAULT false
- `withdrawn_at` timestamptz
- `last_login_at` timestamptz — 학부모 카카오 로그인 마지막 성공 시각 (47 마이그레이션). `index.html`의 로그인 성공 직후 `rpc_record_parent_login(p_email)`이 같은 이메일(대소문자·공백 무시)의 재원생 행에 기록 — **47 이전의 로그인은 기록 없음**.
- 가입 현황: `rpc_admin_list_signup_status(p_password)` — 원장님 전용, student_code별 `registered`(students에 행이 있고 `privacy_consent=true`일 때만 맞춤 학습 등록서 제출로 봄 — 원장님이 정보 수정 창에서 저장해 행이 생겨도 동의 체크 전에는 미제출, 52 마이그레이션), `registered_at`, `last_login_at`. 화면: `admin/student-list.html`의 '가입' 열 + 필터.

### `students` — 학생 상세 정보 (맞춤 학습 등록서로 채워짐)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text (student_codes.student_code 참조, FK 제약은 없음)
- `student_name` text NOT NULL
- `grade` text (예: "중3", "고1")
- `school` text
- `student_phone` text
- `parent_phone` text
- `parent_email` text
- `birth_date` text — **주의: date 타입이 아니라 text**
- `address` text
- `privacy_consent` boolean NOT NULL DEFAULT false
- `created_at` timestamptz NOT NULL DEFAULT now()
- `first_attend_date` date

### `student_classrooms` — 학생별 강의실 배정
- `student_code` text NOT NULL
- `student_name` text
- `classroom` text (예: "1강의실", "2강의실", "4강의실", "5강의실", "원장님")
- `grade` text
- `updated_at` timestamptz NOT NULL DEFAULT now()

---

## 공지/출결

### `announcements` — 공지사항
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `title` text NOT NULL
- `content` text
- `posted_date` date
- `created_at` timestamptz NOT NULL DEFAULT now()
- `target_grade` text NOT NULL DEFAULT '전체' — 학년별 타겟팅 (예: "전체", "중고등", "초3")

### `attendance` — 출결
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text
- `student_name` text
- `attendance_date` date NOT NULL DEFAULT CURRENT_DATE
- `status` text NOT NULL DEFAULT '출석'
- `checked_by` text
- `created_at` timestamptz NOT NULL DEFAULT now()
- `memo` text — 출결 메모(사유·보강 내용 등, 모든 상태에서 입력 가능) (45 마이그레이션). `status`는 출석/지각/조퇴/결석/보강 — '보강'은 결석분 보강 수업에 온 날(출석 인원과 별도 집계, 메모에 어느 날 결석분인지 기록). 화면: `admin/attendance.html`(원장·강사 공통). RPC: `rpc_admin_list_attendance_v2(p_password, p_attendance_date)`(학생당 최근 1건: student_code, status, memo), `rpc_admin_mark_attendance_v2(p_password, p_student_code, p_student_name, p_attendance_date, p_status, p_checked_by, p_memo)`(같은 학생·날짜면 수정, 없으면 추가; 원장/강사 비밀번호 모두 허용). 기존 `rpc_admin_list_attendance`/`rpc_admin_mark_attendance`는 SQL 45 전 대비 폴백으로만 남김.
- `makeup_status` text('완료'|'불필요'|NULL=아직 보강 안 받음), `makeup_date` date — 결석·조퇴 기록의 보강 처리 (46 마이그레이션). 화면: `admin/makeup-pending.html`(원장·강사 공통). RPC: `rpc_admin_list_makeups(p_password, p_include_done default false)`(같은 학생·같은 날짜는 최근 1건만 보고 status in ('결석','조퇴')인 재원생만; student_name, grade, status 포함), `rpc_admin_set_makeup(p_password, p_id, p_status('완료'|'불필요'|''=되돌리기), p_date)`. 보강 수업 당일 기록은 별도로 status='보강'(결석 기록과 자동 연결은 안 됨 — 원장/강사가 보강 대기 목록에서 직접 완료 처리).
- **54 마이그레이션**: `attendance.makeup_planned_date` date(보강 예정일), `rpc_admin_set_makeup_planned(p_password, p_id, p_date)`(null이면 삭제, 원장/강사 공통), `rpc_admin_list_makeups`에 `makeup_planned_date` 추가(drop 후 재생성). `attendance_history` — attendance 입력/수정/삭제를 트리거(`log_attendance_change`)가 jsonb(old/new 행 전체)로 자동 기록, 최초 1회 기존 기록을 '기존기록'으로 적재, RLS 켜짐/정책 없음. `rpc_admin_list_attendance_history(p_password, p_student_code, p_date, p_limit)` 원장님 전용, `admin/attendance.html`의 "변경 이력" 버튼(선택한 날짜 기준, 원장님 로그인에서만 표시).

---

## 성적/진도/피드백/상벌점

### `monthly_scores` — 월간평가 성적
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text
- `student_name` text
- `exam_type` text (비어있거나 "월간평가"면 기존 방식, 아니면 "중간고사"/"기말고사"/"모의고사" 등)
- `exam_year` text
- `exam_month` text
- `score` numeric
- `created_at` timestamptz NOT NULL DEFAULT now()

### `weekly_progress` — 주간진도 + 선생님 피드백 (대시보드 "현재 진도"/"담당 선생님 피드백" 카드가 여기서 같이 조회)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text
- `student_name` text
- `grade` text
- `classroom` text
- `textbook_progress` text
- `homework_progress` text
- `homework_completion` text — 과제수행 점수/등급
- `attitude` text — 수업태도 점수/등급
- `teacher_comment` text
- `feedback_content` text
- `parent_notified` boolean NOT NULL DEFAULT false
- `director_confirmed` boolean NOT NULL DEFAULT false
- `recorded_date` date
- `created_at` timestamptz NOT NULL DEFAULT now()
- `textbook_progress_percent` numeric
- `homework_progress_percent` numeric

### `points_warnings` — 상점(포인트/스탬프)/경고, 한 행에 상점 또는 경고 중 하나만 채워짐
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text
- `student_name` text
- `warning_type` text
- `warning_reason` text
- `point_type` text (예: "포인트", "스탬프")
- `point_reason` text
- `created_at` timestamptz NOT NULL DEFAULT now()
- `given_by` text

### `tlp_results` — TLP 학습심리검사 결과
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text
- `student_name` text
- `test_date` date
- `self_efficacy` / `self_regulation` / `learning_interest` / `learning_habit` / `cognitive_strategy` / `test_anxiety` / `parent_child_comm` / `hagwon_dependency` — 전부 text (등급)
- `comment` text — 원장님 코멘트
- `created_at` timestamptz NOT NULL DEFAULT now()

---

## 숙제인증 (텍스트북 → 범위 계층 구조, v2 최종 설계)

### `homework_textbooks` — 교재 (대단원 역할)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `textbook_name` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

### `homework_textbook_ranges` — 교재별 범위 (중단원 역할, 전체 미리 등록)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `textbook_id` uuid NOT NULL (→ homework_textbooks.id)
- `range_order` integer NOT NULL
- `range_text` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

### `homework_verification_students` — 학생별 교재 배정 (다대다)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text NOT NULL
- `student_name` text
- `grade` text
- `textbook_id` uuid NOT NULL (→ homework_textbooks.id)
- `added_at` timestamptz NOT NULL DEFAULT now()

### `homework_verifications` — 실제 제출 (append-only, 기록 보존)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_code` text NOT NULL
- `student_name` text
- `grade` text
- `textbook_id` uuid NOT NULL
- `range_id` uuid NOT NULL (→ homework_textbook_ranges.id)
- `image_urls` text[] NOT NULL DEFAULT '{}' — 최대 10장
- `submitted_at` timestamptz NOT NULL DEFAULT now()

### `homework_verification_reviews` — 원장님 확인/피드백 (verification 1:1)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `verification_id` uuid NOT NULL (→ homework_verifications.id)
- `status` text NOT NULL DEFAULT 'pending' — 'pending' | 'approved' | 'redo'
- `feedback` text
- `reviewed_at` timestamptz

> **구버전(사용 안 함, DB에서 이미 삭제됨):** `homework_assignments` — 과목/학생/날짜 단위 숙제 배정 구조였던 1차 설계. 지금은 안 씀. CSV에 남아있다면 삭제 반영이 덜 된 것이니 재확인 필요.

---

## 교재/커리큘럼

### `curriculum_units` — 진도책 커리큘럼 단원
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `textbook_code` text NOT NULL
- `unit_order` integer NOT NULL
- `major_unit` text NOT NULL — 대단원
- `minor_unit` text — 중단원
- `created_at` timestamptz NOT NULL DEFAULT now()

### `textbook_curriculum` — 교재 자체 정보 (학년/학기별)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `textbook_code` text NOT NULL
- `grade` text NOT NULL
- `textbook_name` text NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `category` text
- `semester` integer

### `textbook_requests` — 교재 제작 요청
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_name` text
- `grade` text
- `semester` text
- `classroom` text
- `requested_textbook` text
- `expected_textbook` text
- `deadline` text
- `copies` integer
- `completed` boolean NOT NULL DEFAULT false
- `completed_date` date
- `notes` text
- `requested_at` timestamptz NOT NULL DEFAULT now()

---

## 기타

### `blog_posts` — 네이버 블로그 자동 수집 글 (Edge Function + cron으로 매일 수집)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `title` text NOT NULL
- `link` text NOT NULL
- `published_at` timestamptz
- `fetched_at` timestamptz NOT NULL DEFAULT now()

### `consultations` — 상담 신청 (홈페이지 폼 + 전화상담 직접입력)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `student_name` text NOT NULL
- `parent_phone` text NOT NULL
- `student_grade` text
- `inquiry` text
- `referral_source` text — 상담경로: 소개/검색/블로그/인스타/전화상담/기타
- `is_registered` boolean NOT NULL DEFAULT false — 등록여부 (원장님이 상담 후 체크)
- `visit_date` date — 방문날짜. 홈페이지에서는 아래 `consultation_open_slots` 중 하나를 고르면 자동 입력, 전화상담은 원장님이 직접 입력
- `visit_time` time — 방문시간 (위와 동일)
- `notes` text — 비고 (노쇼, 참고사항 등)
- `created_at` timestamptz NOT NULL DEFAULT now()

### `consultation_open_slots` — 상담 가능한 날짜+시간 (원장님이 admin/consultation-slots.html에서 하나씩 직접 추가/수정/삭제)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `slot_date` date NOT NULL
- `slot_time` time NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- 요일 반복 템플릿이 아니라, 원장님이 실제로 가능한 날짜+시간을 그때그때 직접 추가하는 방식 (수업/보강/개인일정마다 스케줄이 달라서 반복 패턴이 안 맞았음)
- 학부모가 홈페이지에서 하나를 고르면 `rpc_submit_consultation_visit_time`이 이 행을 지우고 `consultations.visit_date`/`visit_time`에 복사함 (중복예약 방지)
- (예전에 있던 요일별 반복 템플릿 테이블 `consultation_slots`는 28o 마이그레이션에서 삭제됨)

---

## 텔레그램 알림 (트리거, 29 마이그레이션)

원장님 텔레그램(`@BDKimssam_bot`, chat_id `7714692275`)으로 아래 두 경우 자동 알림:

- `homework_verifications` AFTER INSERT → `notify_telegram_homework_submission()` 트리거 — 숙제 인증 제출마다
- `consultations` AFTER INSERT → `notify_telegram_consultation()` 트리거 — 상담 신청마다 (홈페이지 폼 신청 / 관리자 전화상담 직접입력 모두 같은 테이블이라 둘 다 알림)

`pg_net`(`net.http_post`)으로 Telegram Bot API `sendMessage`를 비동기 호출. 봇 토큰은 각 트리거 함수 안에 하드코딩됨 (다른 RPC들의 비밀번호 하드코딩과 같은 패턴). 타임아웃 10초(`timeout_milliseconds`, 기본 5초로는 가끔 타임아웃 발생해서 늘림).

### 숙제 알림 자동 재발송 (48 마이그레이션)
2026-10-07 밤 `pg_net` 요청이 10초 타임아웃(DNS 지연)으로 알림 1건이 누락돼서 추가. 토큰은 SQL/채팅에 노출하지 않고, DO 블록이 기존 `notify_telegram_homework_submission()` 함수 본문에서 토큰을 뽑아 `telegram_send(p_text)`(bigint 반환, 타임아웃 20초, anon/authenticated 실행 권한 회수)를 만들어 둠. 이후 토큰은 `telegram_send` 안에만 있음(토큰 변경 시 이 함수만 수정).
- `telegram_homework_log`(verification_id PK, message, request_id, attempts, sent, created_at, last_try_at) — RLS 켜짐/정책 없음. 트리거가 발송 때마다 기록(기록/발송 오류는 숙제 제출을 막지 않도록 예외 무시).
- `retry_failed_telegram()` — pg_cron이 1분마다 실행(`retry-telegram` 작업). 90초 지난 미성공 건 중 `net._http_response`에서 status 200이 아니거나 응답이 없는 것을 `(재발송)` 접두어로 다시 보냄(최대 5회, 1시간 이내 건만). 7일 지난 기록 삭제.
- 상담·수학학력평가 알림은 아직 이전 방식(재발송 없음).

### 숙제인증 확인 화면 페이지 나누기 (49 마이그레이션)
`admin/homework-review.html`이 예전에는 `rpc_admin_list_homework_verifications`로 **전체 제출을 한 번에** 받아 사진까지 전부 그렸음(PostgREST 기본 최대 1000행 제한에 걸려 오래된 건이 잘릴 위험도 있었음). 지금은 `rpc_admin_list_homework_page(p_password, p_status, p_search, p_date, p_limit=10, p_offset=0)` — **원장님 전용**. 반환에 `total_count`(조건에 맞는 전체 건수) 포함, 제출일(한국 날짜)·상태·이름 검색 필터, 최신순, `p_limit`은 1~50으로 제한. 화면은 기본으로 오늘 제출분을 보여주고 날짜 이동(◀ ▶/달력/전체 날짜)·10건씩 이전/다음. 49를 아직 안 돌렸으면(PGRST202) 예전 함수로 폴백하고 안내 문구 표시. 사진은 `loading="lazy"`.

### 상담 신청 1단계 통합 (30 마이그레이션)
`rpc_submit_consultation`에 `p_slot_id uuid default null` 파라미터 추가 — 상담 정보 입력과 시간 선택을 홈페이지에서 한 번에 처리(제출 한 번으로 `consultations` insert + 선택한 `consultation_open_slots` 행 삭제가 원자적으로 처리됨). `p_slot_id`가 없으면 방문날짜/시간 없이 신청만 접수(전화로 추후 조율). 옛 2단계용 `rpc_submit_consultation_visit_time`는 더 이상 호출되지 않지만 아직 삭제 안 함.

### 수학학력평가(KMA/HME) 원클릭 신청 (32 마이그레이션)
초등부 학생만 대상. 학부모 대시보드에 "수학학력평가 신청" 카드 — 버튼 누르면 KMA/HME 중 선택, 학생 정보(이름/학교/학년/학부모연락처/생년월일)는 `students`에서 자동으로 가져와 저장. 서버에서도 `grade like '초%'`가 아니면 거부(이중 체크).

- `math_exam_rounds` — **학기별 이력 관리로 전환 (36 마이그레이션)**. `id` PK, `exam_type`('HME'/'KMA') + `semester_year`(연도) + `semester_term`(1 또는 2학기)로 회차 구분, `exam_date`/`label`/`apply_deadline`, `is_current`(지금 신청받는 회차인지). unique(exam_type, semester_year, semester_term). **학기가 바뀌면 관리자 페이지("시험 회차 관리")에서 새 학기 정보를 입력 — 수정이 아니라 추가** 방식이라 지난 학기 회차는 `is_current=false`로 자동 전환되며 이력으로 남음(지우지 않음). 공개 RPC(`rpc_get_exam_rounds`, `rpc_apply_math_exam`)는 `is_current=true`인 회차만 사용.
- 접수 마감일(`apply_deadline`)이 지나면 대시보드에서 해당 회차 신청 버튼이 사라짐(이미 신청한 학생은 "신청완료"로 계속 표시). `rpc_apply_math_exam`에서도 마감일 체크(이중 체크).
- `rpc_admin_get_exam_rounds(p_password)` — 원장님 전용. 전체 회차 이력 조회(현재+지난 학기). 관리자 페이지 "지난 회차 이력 보기"에서 사용.
- `rpc_admin_add_exam_round(p_password, p_exam_type, p_semester_year, p_semester_term, p_exam_date, p_apply_deadline, p_label)` — 원장님 전용. 새 학기 회차 추가(같은 exam_type의 기존 current 회차는 자동으로 `is_current=false`). 같은 연도+학기를 다시 입력하면 그 회차 정보만 덮어씀.
- `math_exam_applications` — 신청 기록. student_code/student_name/school/grade/parent_phone/birth_date(신청 시점 students에서 복사) + exam_type + exam_date + `predicted_score`(예상점수, 추후 원장님이 직접 입력)/`final_score`(최종점수) + applied_at. `unique(student_code, exam_type, exam_date)`로 같은 회차 중복신청 방지.
- `rpc_get_student_grade(p_student_code)` — 공개. 대시보드가 초등부인지 판단해서 카드 노출 여부 결정.
- `rpc_get_exam_rounds()` — 공개. 신청 가능한 회차+날짜 목록.
- `rpc_get_my_exam_applications(p_student_code)` — 공개. 이미 신청한 회차 조회(버튼 "신청완료" 표시용).
- `rpc_apply_math_exam(p_student_code, p_exam_type)` — 공개. 원클릭 신청 처리 + `notify_telegram_math_exam()` AFTER INSERT 트리거로 원장님께 텔레그램 알림.

#### 신청 관리자 페이지 (33 마이그레이션)
`admin/exam-applications.html` — 관리자 홈 "학습 관리" 섹션에 "수학학력평가 신청 관리" 카드 추가. 전체/HME/KMA 필터, 신청자별 예상점수/최종점수 입력, 삭제(테스트/오신청 정리용).
- `rpc_admin_list_exam_applications(p_password)` — 원장님 전용. 전체 신청 목록(날짜/회차/학생명 순 정렬).
- `rpc_admin_update_exam_scores(p_password, p_id, p_predicted_score, p_final_score, p_notes)` — 원장님 전용. 예상점수/최종점수/비고 입력·수정 (35 마이그레이션에서 `p_notes` 추가, 기존 4-인자 함수는 삭제됨).
- `rpc_admin_delete_exam_application(p_password, p_id)` — 원장님 전용. 신청 삭제.
- `math_exam_applications.notes` — 비고(35 마이그레이션). 예: "아파서 응시 못함" 같은 메모. 관리자 페이지 수정 패널에서 입력.

### 상담 문자(SMS) 알림 — 솔라피 (31 마이그레이션)
`consultations`에 `reminder_sent boolean NOT NULL DEFAULT false` 컬럼 추가(1시간 전 리마인더 중복 발송 방지용).
- `notify_sms_consultation_confirm()` — `consultations` AFTER INSERT 트리거. 신청 직후 학부모님께 접수 확인 문자(방문시간 있으면 시간 포함, 없으면 "곧 연락드리겠습니다"). 홈페이지 신청/관리자 전화상담 직접입력 둘 다.
- `consultation_reminder_check()` — `pg_cron`으로 5분마다 실행(`consultation-reminder-check` job). 방문 1시간 이내로 다가온(아직 리마인더 안 보낸) 상담 건에 리마인더 문자 발송.
- `solapi_send_sms(p_to, p_text)` — 공통 발송 함수. 솔라피 API(`api.solapi.com/messages/v4/send`), HMAC-SHA256 인증(`pgcrypto`의 `hmac()`). API Key/Secret/발신번호는 함수 안에 하드코딩(다른 비밀번호 하드코딩과 같은 패턴). 텔레그램(원장님 개인 알림)과 별개로, 학부모님께 가는 문자는 솔라피를 사용.
- **(업데이트, 2026-10-06)** 출석체크/결제 미납 알림은 카카오 알림톡(실패 시 문자 대체)로 솔라피를 통해 보내기로 확정 — 알리고/반값문자 등 다른 서비스로 갈아타는 계획은 취소됨. 카카오 비즈니스 채널 연동(발신프로필 등록, 템플릿 승인)은 별도 진행 중.

## 출석체크 (1단계 키오스크 구현됨 — 42 마이그레이션, 알림/지각결석 기록은 아직 구현 전)
- 학부모 연락처 뒷 4자리 입력 → 이름 목록에서 선택(로그인 없는 키오스크 화면) → 등원/하원 버튼.
- **구현 (42 마이그레이션, 2026-10-07)**: `attendance-kiosk.html`(홈페이지 루트, 로그인 없음).
  - `attendance_checks` — 등원/하원 기록(쌓기만 함). `student_code`, `student_name`, `check_type`('등원'|'하원'), `checked_at` timestamptz, `check_date` date(한국 날짜 기준 기본값). RLS 켜져 있고 정책 없음 → 화면에서 직접 접근 불가, 아래 함수로만 접근. 기존 `attendance` 테이블(선생님이 입력하는 출석/지각/결석)과는 별개.
  - `rpc_kiosk_verify(p_kiosk_code)` — 출석체크 기기 비밀번호 확인. **비밀번호는 이 함수 안에 하드코딩**(다른 RPC 비밀번호와 같은 패턴). 바꾸려면 함수 안 값만 수정하고, 태블릿은 주소 뒤에 `?lock=1`을 붙여 열어 다시 잠금해제.
  - `rpc_kiosk_find_students(p_kiosk_code, p_last4)` — `student_codes.attendance_phone` / `attendance_phone2` **또는** `students.parent_phone`(둘 다 숫자만 추려 뒷 4자리)이 일치하는 **재원생**(`student_codes.withdrawn=false`)과 오늘의 마지막 등원/하원 기록을 돌려줌. 학년은 `student_classrooms.grade` 우선. 홈페이지 가입(맞춤 학습 등록서)은 자율이라 `students`에 행이 없을 수 있어서, `students`는 있으면 보조로만 쓰고 없어도 조회됨(그 경우 학년은 `student_classrooms`에 없으면 빈 값).
  - `student_codes.attendance_phone` / `attendance_phone2` text — **출석용 학부모 전화번호 2개**(기본 + 추가, 숫자만 저장). **휴대폰 번호만 허용**(`^01[016789][0-9]{7,8}$`, +82는 0으로 변환 — `attendance_normalize_phone()`). 추후 솔라피 알림톡을 두 번호 모두에 보낼 예정. 가입 여부와 무관하게 원장님이 관리. 입력은 `admin/attendance-phones.html`(일괄 붙여넣기: 한 줄에 번호 2개 가능) 또는 학생 목록 수정창. (43 마이그레이션에서 추가)
  - `rpc_admin_list_attendance_phones(p_password)`(반환: student_code, attendance_phone, attendance_phone2) / `rpc_admin_set_attendance_phone(p_password, p_student_code, p_phone, p_phone2)` / `rpc_admin_bulk_set_attendance_phones(p_password, p_items jsonb)` — **원장님 전용**(개인정보라 강사 비밀번호 불가). 저장 시 숫자만 남기고 휴대폰 형식 검사, 빈 값이면 삭제, 두 번호가 같으면 추가 번호는 비움. 일괄 저장은 한 건이라도 오류면 전체 취소이며 `phone2` 키가 없으면 추가 번호는 그대로 둠. `p_items` 예: `[{"student_code":"26H-001","phone":"010-1234-5678","phone2":"010-9999-8888"}]`.
  - `rpc_kiosk_check(p_kiosk_code, p_student_code, p_check_type)` — 기록 추가. 같은 학생·같은 구분을 2분 안에 또 보내면 새로 쌓지 않고 기존 기록을 돌려줌(중복 터치 방지). 반환 컬럼은 `r_check_type`, `r_checked_at`, `r_student_name`.
  - 기기 잠금: 태블릿에서 비밀번호를 한 번 입력하면 그 브라우저(localStorage)에 저장됨.
- 수업 시간표와 연결하지 않음(학생마다 등원 요일/시간이 달라 복잡도가 너무 커짐 — 단순화 결정). 알림톡엔 실제 찍은 시각만 표시.
- 지각/결석/조퇴는 강사가 자기 강의실 학생만 사유와 함께 기록 (학부모 번호·결제 정보는 못 보게 권한 제한 필요). 학부모에게는 알림 안 보냄 — 내부 기록용.
- 재원생 목록(퇴원생 제외): `rpc_admin_list_active_students(p_password, p_classroom default null)` (51 마이그레이션) → `student_code, student_name, grade, classroom`. 강사쌤은 자기 강의실만, 비우거나 '원장님'이면 전체. 출결/상점경고/교재신청/주간진도/TLP/보강 화면이 `supabase-client.js`의 `fetchActiveStudents()`로 호출하고, 함수가 없으면 예전 `rpc_admin_list_students`로 돌아감(그땐 퇴원생도 보임). 강사쌤 4개 강의실이 같은 비밀번호라서 강의실 구분은 화면 수준(실수 방지)이지 보안 경계는 아님.
- 별도 관리 앱은 만들지 않고 이 홈페이지에 통합하기로 함(12월에 따로 만들려던 학원관리 앱 계획은 취소).

## 결제 관리 (38 마이그레이션)
원장님 전용 장부. 재원생(`student_codes.withdrawn = false`) 기준으로 매달 납부 여부를 자동 판단.
- `tuition_rates` — 초등/중등/고등별 기본 수강료(class_type PK, amount). 현재 초등 18만/중등 26만/고등 31만. **내년에 교육청 분당단가 인상되면 이 금액만 바꾸면 됨** — 과거 납부 기록(`payments.amount`)은 그때 금액 그대로 남아있어서 영향 없음.
- `payments` — 학생×월(`billing_month`, 항상 해당 월 1일) 유니크. `amount`(실제 낸 금액, 기본은 요금표에서 가져오되 입력 시 수정 가능 — 신규생 첫달 비례 청구 같은 경우), `paid_date`, `memo`(예: "6개월 선납"). 선납은 자동화 없이 원장님이 해당 월들을 수동으로 하나씩 결제완료 처리.
- `rpc_admin_get_tuition_rates(p_password)` / `rpc_admin_update_tuition_rate(p_password, p_class_type, p_amount)` — 요금표 조회/수정.
- `payments.payment_method` — 결제수단(40 마이그레이션). '카드' | '현금'(입금 포함).
- `rpc_admin_list_payment_status(p_password, p_billing_month)` — 해당 월 재원생 전체의 납부 상태. 학년은 `student_classrooms.grade`를 우선 사용(없으면 `students.grade` 보조) — 학년 일괄 진급 등으로 최신 상태가 `student_classrooms`에 반영되기 때문 (41 마이그레이션에서 수정). 초/중/고 자동 분류 + 기본 요금 + 실제 납부 여부/금액/날짜/결제수단/메모.
- `rpc_admin_save_payment(p_password, p_student_code, p_billing_month, p_amount, p_paid_date, p_payment_method, p_memo)` — 납부 입력/수정(upsert, 같은 학생+같은 달이면 덮어씀). 40 마이그레이션에서 `p_payment_method` 추가, 기존 6-인자 함수는 삭제됨.
- `rpc_admin_delete_payment(p_password, p_id)` — 납부 취소(미납 상태로 되돌림).
- `payment_history` (53) — `payments` 의 입력/수정/취소를 AFTER INSERT/UPDATE/DELETE 트리거(`log_payment_change`)가 자동 기록. 변경 전/후 행 전체를 jsonb(`old_data`/`new_data`)로 저장하므로 payments 컬럼이 늘어도 그대로 동작. 내용이 안 바뀐 upsert는 기록 안 함. 최초 실행 시 기존 납부분은 action='기존기록'으로 1회 적재. RLS 켜짐/정책 없음. **원칙: 돈·신청 등 기록성 테이블은 처음부터 변경 이력을 남긴다 (방학특강·알림톡 발송 기록도 동일).**
- `rpc_admin_list_payment_history(p_password, p_student_code default null, p_limit default 300)` — 원장님 전용 이력 조회. `admin/payments.html` 의 학생별 "이력" 버튼 / "전체 변경 이력" 버튼.
- `admin/payments.html` — 관리자 홈 "결제" 섹션. 월 이동, 납부완료/미납/수납액 통계, 요금표 수정, 학생별 납부 입력.
- `notify_sms_payment_confirm()` — `payments` AFTER INSERT 트리거(39 마이그레이션). 새 납부 기록 최초 입력 시(수정/upsert 땐 재발송 안 됨) 학부모께 수납 확인 문자. 메시지엔 "오늘"이 아니라 입력된 `paid_date`를 그대로 표시(늦게 입력해도 자연스럽게). 지금은 솔라피 일반 SMS, 카카오 채널 승인되면 알림톡으로 전환 예정.
- 미납 학생 알림톡 발송 기능은 카카오 채널 연동 완료 후 추가 예정.

- `rpc_admin_list_attendance_checks(p_password, p_date)` — 원장님 전용, 특정 날짜의 `attendance_checks` 기록 조회 (44 마이그레이션, `admin/attendance-today.html`)
