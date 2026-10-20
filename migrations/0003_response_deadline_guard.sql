-- Defense in depth: enforce response immutability and wall-clock deadline in
-- the same database write, including time spent waiting for locks or queries.
CREATE FUNCTION yas.guard_response_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt_status text; deadline timestamptz;
BEGIN
 SELECT status,expires_at INTO attempt_status,deadline FROM yas.exam_attempts WHERE id=NEW.attempt_id FOR UPDATE;
 IF attempt_status<>'in-progress' OR clock_timestamp()>=deadline THEN
  RAISE EXCEPTION 'Attempt is read-only or expired' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER response_write_guard BEFORE INSERT OR UPDATE ON yas.student_responses
 FOR EACH ROW EXECUTE FUNCTION yas.guard_response_write();
