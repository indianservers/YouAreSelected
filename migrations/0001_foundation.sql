CREATE SCHEMA IF NOT EXISTS yas;
CREATE TABLE yas.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, email text NOT NULL UNIQUE CHECK(email=lower(trim(email))),
 email_verified boolean NOT NULL DEFAULT false, image text, phone text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'student' CHECK(role IN ('admin','student')),
 approval_status text NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')), account_status text NOT NULL DEFAULT 'active' CHECK(account_status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz
);
CREATE INDEX users_approval_idx ON yas.users(approval_status,account_status,created_at DESC);
CREATE TABLE yas.user_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES yas.users(id) ON DELETE CASCADE,institution text NOT NULL DEFAULT '',avatar_url text,bio text,date_of_birth date,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE yas.auth_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES yas.users(id) ON DELETE CASCADE,token text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,ip_address text,user_agent text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user_idx ON yas.auth_sessions(user_id);
CREATE TABLE yas.auth_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES yas.users(id) ON DELETE CASCADE,account_id text NOT NULL,provider_id text NOT NULL,password_hash text,access_token text,refresh_token text,id_token text,access_token_expires_at timestamptz,refresh_token_expires_at timestamptz,scope text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider_id,account_id));
CREATE INDEX accounts_user_idx ON yas.auth_accounts(user_id);
CREATE TABLE yas.auth_verifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),identifier text NOT NULL,value text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX verifications_identifier_idx ON yas.auth_verifications(identifier);
CREATE TABLE yas.rate_limits(key text PRIMARY KEY,count integer NOT NULL,last_request bigint NOT NULL);
CREATE TABLE yas.exams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_code text NOT NULL UNIQUE,title text NOT NULL,description text NOT NULL DEFAULT '',category text NOT NULL DEFAULT '',subject text NOT NULL DEFAULT '',instructions text NOT NULL DEFAULT '',
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),total_marks numeric(12,4) NOT NULL DEFAULT 0,passing_percentage numeric(6,2) NOT NULL DEFAULT 40 CHECK(passing_percentage BETWEEN 0 AND 100),negative_marking_enabled boolean NOT NULL DEFAULT true,max_attempts integer NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 100),
 default_marks numeric(10,4) NOT NULL DEFAULT 2 CHECK(default_marks>0),default_negative_marks numeric(10,4) NOT NULL DEFAULT 0.5 CHECK(default_negative_marks>=0),randomize_questions boolean NOT NULL DEFAULT false,randomize_options boolean NOT NULL DEFAULT false,allow_question_navigation boolean NOT NULL DEFAULT true,allow_section_navigation boolean NOT NULL DEFAULT true,result_visibility_mode text NOT NULL DEFAULT 'review' CHECK(result_visibility_mode IN ('score','review')),
 publication_status text NOT NULL DEFAULT 'draft' CHECK(publication_status IN ('draft','published','archived')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES yas.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exams_status_idx ON yas.exams(publication_status);
CREATE TABLE yas.exam_sections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES yas.exams(id) ON DELETE CASCADE,section_name text NOT NULL,description text NOT NULL DEFAULT '',display_order integer NOT NULL,default_marks numeric(10,4) NOT NULL,default_negative_marks numeric(10,4) NOT NULL,UNIQUE(exam_id,id));
CREATE INDEX sections_exam_idx ON yas.exam_sections(exam_id,display_order);
CREATE TABLE yas.questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES yas.exams(id) ON DELETE CASCADE,section_id uuid NOT NULL,question_text text NOT NULL CHECK(length(trim(question_text))>0),question_type text NOT NULL DEFAULT 'single' CHECK(question_type='single'),difficulty text NOT NULL CHECK(difficulty IN ('Easy','Medium','Hard')),topic text NOT NULL DEFAULT '',tags text[] NOT NULL DEFAULT '{}',marks numeric(10,4) NOT NULL CHECK(marks>0),negative_marks numeric(10,4) NOT NULL CHECK(negative_marks>=0),explanation text NOT NULL DEFAULT '',image_url text,display_order integer NOT NULL,created_by uuid NOT NULL REFERENCES yas.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(exam_id,section_id) REFERENCES yas.exam_sections(exam_id,id) ON DELETE CASCADE);
CREATE INDEX questions_exam_idx ON yas.questions(exam_id,display_order);
CREATE TABLE yas.question_options(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),question_id uuid NOT NULL REFERENCES yas.questions(id) ON DELETE CASCADE,option_text text NOT NULL CHECK(length(trim(option_text))>0),image_url text,is_correct boolean NOT NULL DEFAULT false,display_order integer NOT NULL,UNIQUE(question_id,id));
CREATE UNIQUE INDEX one_correct_option_idx ON yas.question_options(question_id) WHERE is_correct;
CREATE FUNCTION yas.validate_mcq() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE qid uuid; n integer; correct integer;
BEGIN
 IF TG_TABLE_NAME='questions' THEN qid:=COALESCE(NEW.id,OLD.id); ELSE qid:=COALESCE(NEW.question_id,OLD.question_id); END IF;
 IF EXISTS(SELECT 1 FROM yas.questions WHERE id=qid) THEN
   SELECT count(*),count(*) FILTER(WHERE is_correct) INTO n,correct FROM yas.question_options WHERE question_id=qid;
   IF n<2 OR correct<>1 THEN RAISE EXCEPTION 'Single-correct MCQ requires at least two options and exactly one correct answer' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER questions_validate AFTER INSERT OR UPDATE ON yas.questions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION yas.validate_mcq();
CREATE CONSTRAINT TRIGGER options_validate AFTER INSERT OR UPDATE OR DELETE ON yas.question_options DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION yas.validate_mcq();
CREATE TABLE yas.exam_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES yas.exams(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES yas.users(id),assigned_by uuid NOT NULL REFERENCES yas.users(id),assigned_at timestamptz NOT NULL DEFAULT now(),assignment_status text NOT NULL DEFAULT 'active' CHECK(assignment_status IN ('active','revoked')),UNIQUE(exam_id,user_id));
CREATE INDEX assignments_user_idx ON yas.exam_assignments(user_id,assignment_status);
CREATE TABLE yas.exam_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL UNIQUE REFERENCES yas.exams(id) ON DELETE CASCADE,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,timezone text NOT NULL,duration_minutes integer NOT NULL CHECK(duration_minutes>0),schedule_status text NOT NULL DEFAULT 'active' CHECK(schedule_status IN ('active','cancelled')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
CREATE TABLE yas.exam_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES yas.exams(id),user_id uuid NOT NULL REFERENCES yas.users(id),attempt_number integer NOT NULL CHECK(attempt_number>0),started_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,submitted_at timestamptz,status text NOT NULL DEFAULT 'in-progress' CHECK(status IN ('in-progress','submitted')),submission_reason text CHECK(submission_reason IN ('manual','expired')),time_taken_seconds integer,current_index integer NOT NULL DEFAULT 0,revision integer NOT NULL DEFAULT 0,exam_version integer NOT NULL,passing_percentage numeric(6,2) NOT NULL,sections_snapshot jsonb NOT NULL,allow_revisit boolean NOT NULL,allow_sections boolean NOT NULL,show_review boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(exam_id,user_id,attempt_number),CHECK(expires_at>started_at));
CREATE UNIQUE INDEX one_active_attempt_idx ON yas.exam_attempts(exam_id,user_id) WHERE status='in-progress';
CREATE INDEX attempts_deadline_idx ON yas.exam_attempts(expires_at) WHERE status='in-progress';
CREATE INDEX attempts_user_idx ON yas.exam_attempts(user_id,created_at DESC);
CREATE TABLE yas.attempt_questions(id uuid PRIMARY KEY,attempt_id uuid NOT NULL REFERENCES yas.exam_attempts(id) ON DELETE CASCADE,source_question_id uuid NOT NULL,snapshot jsonb NOT NULL,display_order integer NOT NULL,UNIQUE(attempt_id,id),UNIQUE(attempt_id,display_order));
CREATE INDEX attempt_questions_attempt_idx ON yas.attempt_questions(attempt_id,display_order);
CREATE TABLE yas.student_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attempt_id uuid NOT NULL REFERENCES yas.exam_attempts(id) ON DELETE CASCADE,question_id uuid NOT NULL,selected_option_id uuid,marked_for_review boolean NOT NULL DEFAULT false,visited boolean NOT NULL DEFAULT true,answered_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(attempt_id,question_id),FOREIGN KEY(attempt_id,question_id) REFERENCES yas.attempt_questions(attempt_id,id));
CREATE TABLE yas.exam_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attempt_id uuid NOT NULL UNIQUE REFERENCES yas.exam_attempts(id),user_id uuid NOT NULL REFERENCES yas.users(id),exam_id uuid NOT NULL REFERENCES yas.exams(id),earned_marks numeric(12,4) NOT NULL,maximum_marks numeric(12,4) NOT NULL,percentage numeric(18,4) NOT NULL,correct_count integer NOT NULL,incorrect_count integer NOT NULL,unattempted_count integer NOT NULL,passed boolean NOT NULL,section_results jsonb NOT NULL,calculated_at timestamptz NOT NULL DEFAULT now(),publication_status text NOT NULL DEFAULT 'withheld' CHECK(publication_status IN ('withheld','published')),published_at timestamptz,published_by uuid REFERENCES yas.users(id));
CREATE INDEX results_exam_idx ON yas.exam_results(exam_id,publication_status);
CREATE TABLE yas.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_user_id uuid REFERENCES yas.users(id),action text NOT NULL,entity_type text NOT NULL,entity_id text,changes_summary jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audits_created_idx ON yas.audit_logs(created_at DESC);
CREATE TABLE yas.settings(key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO yas.settings(key,value) VALUES('workspace','{"organization":"YouAreSelected","supportEmail":""}');
CREATE TABLE yas.bootstrap_state(id integer PRIMARY KEY CHECK(id=1),completed_at timestamptz NOT NULL DEFAULT now(),user_id uuid NOT NULL REFERENCES yas.users(id));

