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

## 출석체크 (설계 확정, 아직 구현 전)
- 학부모 연락처 뒷 4자리 입력 → 이름 목록에서 선택(로그인 없는 키오스크 화면) → 등원/하원 버튼.
- 수업 시간표와 연결하지 않음(학생마다 등원 요일/시간이 달라 복잡도가 너무 커짐 — 단순화 결정). 알림톡엔 실제 찍은 시각만 표시.
- 지각/결석/조퇴는 강사가 자기 강의실 학생만 사유와 함께 기록 (학부모 번호·결제 정보는 못 보게 권한 제한 필요). 학부모에게는 알림 안 보냄 — 내부 기록용.
- 별도 관리 앱은 만들지 않고 이 홈페이지에 통합하기로 함(12월에 따로 만들려던 학원관리 앱 계획은 취소).

## 결제 관리 (38 마이그레이션)
원장님 전용 장부. 재원생(`student_codes.withdrawn = false`) 기준으로 매달 납부 여부를 자동 판단.
- `tuition_rates` — 초등/중등/고등별 기본 수강료(class_type PK, amount). 현재 초등 18만/중등 26만/고등 31만. **내년에 교육청 분당단가 인상되면 이 금액만 바꾸면 됨** — 과거 납부 기록(`payments.amount`)은 그때 금액 그대로 남아있어서 영향 없음.
- `payments` — 학생×월(`billing_month`, 항상 해당 월 1일) 유니크. `amount`(실제 낸 금액, 기본은 요금표에서 가져오되 입력 시 수정 가능 — 신규생 첫달 비례 청구 같은 경우), `paid_date`, `memo`(예: "6개월 선납"). 선납은 자동화 없이 원장님이 해당 월들을 수동으로 하나씩 결제완료 처리.
- `rpc_admin_get_tuition_rates(p_password)` / `rpc_admin_update_tuition_rate(p_password, p_class_type, p_amount)` — 요금표 조회/수정.
- `rpc_admin_list_payment_status(p_password, p_billing_month)` — 해당 월 재원생 전체의 납부 상태(학생 grade로 초/중/고 자동 분류 + 기본 요금 + 실제 납부 여부/금액/날짜/메모).
- `rpc_admin_save_payment(p_password, p_student_code, p_billing_month, p_amount, p_paid_date, p_memo)` — 납부 입력/수정(upsert, 같은 학생+같은 달이면 덮어씀).
- `rpc_admin_delete_payment(p_password, p_id)` — 납부 취소(미납 상태로 되돌림).
- `admin/payments.html` — 관리자 홈 "결제" 섹션. 월 이동, 납부완료/미납/수납액 통계, 요금표 수정, 학생별 납부 입력.
- 미납 학생 알림톡 발송 기능은 카카오 채널 연동 완료 후 추가 예정.
