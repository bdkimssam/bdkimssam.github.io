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
- `visit_date` date — 방문날짜. 홈페이지에서는 아래 `consultation_slots` 기반 자체 예약으로 자동 입력, 전화상담은 원장님이 직접 입력
- `visit_time` time — 방문시간 (위와 동일)
- `notes` text — 비고 (노쇼, 참고사항 등)
- `created_at` timestamptz NOT NULL DEFAULT now()

### `consultation_slots` — 상담 가능 시간 (요일별 고정 템플릿, 원장님이 admin/consultation-slots.html에서 관리)
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `day_of_week` smallint NOT NULL — 0=일 ~ 6=토
- `start_time` time NOT NULL
- `end_time` time NOT NULL
- `slot_minutes` smallint NOT NULL DEFAULT 30 — 몇 분 간격으로 예약 슬롯을 쪼갤지
- `is_active` boolean NOT NULL DEFAULT true — 꺼두면 홈페이지에서 해당 시간대가 안 보임 (삭제 안 해도 임시로 숨길 수 있음)
- `created_at` timestamptz NOT NULL DEFAULT now()
- 홈페이지는 이 템플릿 + 이미 예약된 (visit_date, visit_time) 쌍을 받아서 프론트에서 향후 21일치 빈 시간을 계산함 (구글 캘린더 연동 없음)
