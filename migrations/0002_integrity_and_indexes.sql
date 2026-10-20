-- Additive hardening. Never rewrite an applied migration or delete user records.
CREATE INDEX results_user_idx ON yas.exam_results(user_id,publication_status);
CREATE INDEX attempts_exam_created_idx ON yas.exam_attempts(exam_id,created_at DESC);
CREATE INDEX assignments_exam_status_idx ON yas.exam_assignments(exam_id,assignment_status,user_id);
ALTER TABLE yas.exam_attempts ADD CONSTRAINT attempt_identity UNIQUE(id,user_id,exam_id);
ALTER TABLE yas.exam_results ADD CONSTRAINT result_owner_matches_attempt
 FOREIGN KEY(attempt_id,user_id,exam_id) REFERENCES yas.exam_attempts(id,user_id,exam_id);
ALTER TABLE yas.exam_attempts ADD CONSTRAINT attempt_submission_state CHECK(
 (status='in-progress' AND submitted_at IS NULL AND submission_reason IS NULL AND time_taken_seconds IS NULL)
 OR (status='submitted' AND submitted_at BETWEEN started_at AND expires_at AND submission_reason IS NOT NULL AND time_taken_seconds>=0));
ALTER TABLE yas.exam_results ADD CONSTRAINT result_counts_valid CHECK(
 maximum_marks>0 AND correct_count>=0 AND incorrect_count>=0 AND unattempted_count>=0);
CREATE FUNCTION yas.validate_response_option() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.selected_option_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM yas.attempt_questions q CROSS JOIN LATERAL jsonb_array_elements(q.snapshot->'options') o
  WHERE q.attempt_id=NEW.attempt_id AND q.id=NEW.question_id AND o->>'id'=NEW.selected_option_id::text
 ) THEN RAISE EXCEPTION 'Option does not belong to the attempt question' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER response_option_valid BEFORE INSERT OR UPDATE ON yas.student_responses
 FOR EACH ROW EXECUTE FUNCTION yas.validate_response_option();
