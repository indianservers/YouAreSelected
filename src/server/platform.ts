import { createHash, randomUUID } from "node:crypto";
import type { Database, Queryable } from "./db";
import type {
  WorkspaceData,
  Exam,
  Question,
  User,
  UserStatus,
  ExamAttempt,
  StudentResponse,
} from "@/types/domain";
import { examSchema, profileSchema } from "./validation";
import { assert, ServiceError } from "./errors";
import { grade } from "@/lib/grading";
import { examDto, attemptDto, userDto, safeQuestion, safeAttempt } from "./dto";
export function stableId(namespace: string, value: string) {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  const hex = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const shuffle = <T>(array: T[]) => {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
export class PlatformRepository {
  constructor(public db: Database) {}
  async audit(
    tx: Queryable,
    actor: User,
    action: string,
    entityType: string,
    entityId: string,
    summary: Record<string, unknown> = {},
  ) {
    await tx.query(
      "INSERT INTO yas.audit_logs(actor_user_id,action,entity_type,entity_id,changes_summary) VALUES($1,$2,$3,$4,$5)",
      [actor.id, action, entityType, entityId, JSON.stringify(summary)],
    );
  }
  async actor(tx: Queryable, actor: User, admin = false) {
    const { rows } = await tx.query(
      "SELECT * FROM yas.users WHERE id=$1 FOR SHARE",
      [actor.id],
    );
    assert(
      rows[0] &&
        rows[0].account_status === "active" &&
        rows[0].approval_status !== "rejected",
      "Account is not active.",
      403,
    );
    if (admin)
      assert(rows[0].role === "admin", "Administrator access required.", 403);
    return rows[0];
  }
  async admin<T>(actor: User, fn: (tx: Queryable) => Promise<T>) {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, actor, true);
      return fn(tx);
    });
  }
  async exam(tx: Queryable, id: string): Promise<Exam> {
    const exams = await this.exams(tx, [id]);
    assert(exams[0], "Examination not found.", 404);
    return exams[0];
  }
  async exams(tx: Queryable, ids: string[]): Promise<Exam[]> {
    if (!ids.length) return [];
    const { rows } = await tx.query(
      "SELECT e.*,s.starts_at,s.ends_at,s.timezone FROM yas.exams e JOIN yas.exam_schedules s ON s.exam_id=e.id WHERE e.id=ANY($1::uuid[])",
      [ids],
    );
    const sectionRows = (
      await tx.query(
        "SELECT id,exam_id,section_name FROM yas.exam_sections WHERE exam_id=ANY($1::uuid[]) ORDER BY display_order",
        [ids],
      )
    ).rows;
    const qrows = (
      await tx.query(
        "SELECT q.*, COALESCE(json_agg(json_build_object('id',o.id,'text',o.option_text,'correct',o.is_correct) ORDER BY o.display_order) FILTER(WHERE o.id IS NOT NULL),'[]') AS options FROM yas.questions q LEFT JOIN yas.question_options o ON o.question_id=q.id WHERE q.exam_id=ANY($1::uuid[]) GROUP BY q.id ORDER BY q.display_order",
        [ids],
      )
    ).rows;
    return ids.flatMap((id) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return [];
      const sections = sectionRows
        .filter((s) => s.exam_id === id)
        .map((s) => ({ id: String(s.id), name: String(s.section_name) }));
      const questions = qrows
        .filter((q) => q.exam_id === id)
        .map((q): Question => ({
          id: String(q.id),
          sectionId: String(q.section_id),
          text: String(q.question_text),
          options: (
            q.options as { id: string; text: string; correct: boolean }[]
          ).map((o) => ({ id: o.id, text: o.text })),
          correctOptionId: (
            q.options as { id: string; correct: boolean }[]
          ).find((o) => o.correct)?.id,
          marks: Number(q.marks),
          negative: Number(q.negative_marks),
          explanation: String(q.explanation),
          difficulty: q.difficulty as Question["difficulty"],
          topic: String(q.topic),
          tags: q.tags as string[],
          image: q.image_url ? String(q.image_url) : undefined,
        }));
      return [examDto(row, sections, questions)];
    });
  }
  async saveExam(actor: User, input: unknown): Promise<Exam> {
    const parsed = examSchema.safeParse(input);
    assert(
      parsed.success,
      parsed.error?.issues.map((i) => i.message).join(" ") ??
        "Invalid examination.",
    );
    const exam = parsed.data;
    const expectedVersion = (input as Exam).version;
    return this.admin(actor, async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `exam:${exam.id}`,
      ]);
      const old = (
        await tx.query("SELECT version FROM yas.exams WHERE id=$1 FOR UPDATE", [
          exam.id,
        ])
      ).rows[0];
      if (old)
        assert(
          Number(old.version) === expectedVersion,
          "This examination changed elsewhere. Refresh before saving.",
          409,
        );
      const values = [
        exam.id,
        exam.code,
        exam.title,
        exam.description,
        exam.category,
        exam.subject,
        exam.instructions,
        exam.duration,
        exam.questions.reduce((sum, q) => sum + q.marks, 0),
        exam.passingPercentage,
        exam.maxAttempts,
        exam.defaultMarks,
        exam.defaultNegative,
        exam.randomQuestions,
        exam.randomOptions,
        exam.allowRevisit,
        exam.allowSections,
        exam.showReview ? "review" : "score",
        exam.status,
        actor.id,
      ];
      await tx.query(
        `INSERT INTO yas.exams(id,exam_code,title,description,category,subject,instructions,duration_minutes,total_marks,passing_percentage,max_attempts,default_marks,default_negative_marks,randomize_questions,randomize_options,allow_question_navigation,allow_section_navigation,result_visibility_mode,publication_status,created_by) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT(id) DO UPDATE SET exam_code=EXCLUDED.exam_code,title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,subject=EXCLUDED.subject,instructions=EXCLUDED.instructions,duration_minutes=EXCLUDED.duration_minutes,total_marks=EXCLUDED.total_marks,passing_percentage=EXCLUDED.passing_percentage,max_attempts=EXCLUDED.max_attempts,default_marks=EXCLUDED.default_marks,default_negative_marks=EXCLUDED.default_negative_marks,randomize_questions=EXCLUDED.randomize_questions,randomize_options=EXCLUDED.randomize_options,allow_question_navigation=EXCLUDED.allow_question_navigation,allow_section_navigation=EXCLUDED.allow_section_navigation,result_visibility_mode=EXCLUDED.result_visibility_mode,publication_status=EXCLUDED.publication_status,version=yas.exams.version+1,updated_at=now()`,
        values,
      );
      await tx.query("DELETE FROM yas.exam_sections WHERE exam_id=$1", [
        exam.id,
      ]);
      for (const [i, s] of exam.sections.entries())
        await tx.query(
          "INSERT INTO yas.exam_sections(id,exam_id,section_name,display_order,default_marks,default_negative_marks) VALUES($1,$2,$3,$4,$5,$6)",
          [
            stableId(exam.id, s.id),
            exam.id,
            s.name,
            i,
            exam.defaultMarks,
            exam.defaultNegative,
          ],
        );
      for (const [i, q] of exam.questions.entries()) {
        const qid = stableId(exam.id, q.id);
        await tx.query(
          "INSERT INTO yas.questions(id,exam_id,section_id,question_text,difficulty,topic,tags,marks,negative_marks,explanation,image_url,display_order,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [
            qid,
            exam.id,
            stableId(exam.id, q.sectionId),
            q.text,
            q.difficulty,
            q.topic,
            q.tags,
            q.marks,
            q.negative,
            q.explanation,
            q.image || null,
            i,
            actor.id,
          ],
        );
        for (const [j, o] of q.options.entries())
          await tx.query(
            "INSERT INTO yas.question_options(id,question_id,option_text,is_correct,display_order) VALUES($1,$2,$3,$4,$5)",
            [stableId(qid, o.id), qid, o.text, o.id === q.correctOptionId, j],
          );
      }
      await tx.query(
        "INSERT INTO yas.exam_schedules(exam_id,starts_at,ends_at,timezone,duration_minutes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(exam_id) DO UPDATE SET starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,timezone=EXCLUDED.timezone,duration_minutes=EXCLUDED.duration_minutes,updated_at=now()",
        [
          exam.id,
          exam.schedule.start,
          exam.schedule.end,
          exam.schedule.timeZone,
          exam.duration,
        ],
      );
      await this.audit(
        tx,
        actor,
        old ? "exam.updated" : "exam.created",
        "exam",
        exam.id,
        { status: exam.status, questions: exam.questions.length },
      );
      return this.exam(tx, exam.id);
    });
  }
  async duplicateExam(actor: User, id: string) {
    await this.actor(this.db, actor, true);
    const source = await this.exam(this.db, id);
    const copyId = randomUUID();
    return this.saveExam(actor, {
      ...source,
      id: copyId,
      version: undefined,
      title: `${source.title} (copy)`,
      code: `${source.code.slice(0, 60)}-${copyId.slice(0, 8)}`,
      status: "draft",
      sections: source.sections.map((s) => ({
        ...s,
        id: stableId(copyId, `section:${s.id}`),
      })),
      questions: source.questions.map((q) => ({
        ...q,
        id: randomUUID(),
        sectionId: stableId(copyId, `section:${q.sectionId}`),
        options: q.options.map((o) => ({ ...o, id: `copy:${o.id}` })),
        correctOptionId: `copy:${q.correctOptionId}`,
      })),
    });
  }
  async profile(actor: User, input: unknown, targetId = actor.id) {
    const value = profileSchema.parse(input);
    await this.db.transaction(async (tx) => {
      await this.actor(tx, actor, targetId !== actor.id);
      const updated = await tx.query(
        "UPDATE yas.users SET full_name=$2,phone=$3,updated_at=now() WHERE id=$1 AND (id=$4 OR role='student') RETURNING id",
        [targetId, value.name, value.mobile, actor.id],
      );
      assert(updated.rows.length, "Profile not found.", 404);
      await tx.query(
        "INSERT INTO yas.user_profiles(user_id,institution) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET institution=EXCLUDED.institution,updated_at=now()",
        [targetId, value.institution],
      );
      await this.audit(tx, actor, "profile.updated", "user", targetId);
    });
  }
  async status(actor: User, ids: string[], status: UserStatus) {
    await this.admin(actor, async (tx) => {
      for (const id of [...new Set(ids)].sort()) {
        const updated = await tx.query(
          "UPDATE yas.users SET approval_status=CASE WHEN $2='suspended' THEN approval_status ELSE $2 END,account_status=CASE WHEN $2='suspended' THEN 'suspended' ELSE 'active' END,updated_at=now() WHERE id=$1 AND role='student' RETURNING id",
          [id, status],
        );
        assert(updated.rows.length, "Student not found.", 404);
        if (status === "suspended" || status === "rejected")
          await tx.query("DELETE FROM yas.auth_sessions WHERE user_id=$1", [
            id,
          ]);
        await this.audit(tx, actor, "user.status", "user", id, { status });
      }
    });
  }
  async assign(actor: User, examId: string, ids: string[], remove = false) {
    await this.admin(actor, async (tx) => {
      assert(
        (await tx.query("SELECT id FROM yas.exams WHERE id=$1", [examId]))
          .rows[0],
        "Exam not found.",
        404,
      );
      for (const id of [...new Set(ids)].sort()) {
        const user = (
          await tx.query("SELECT * FROM yas.users WHERE id=$1 FOR SHARE", [id])
        ).rows[0];
        assert(user && user.role === "student", "Learner not found.", 404);
        if (!remove)
          assert(
            user.approval_status === "approved" &&
              user.account_status === "active",
            "Only approved, active students can be assigned.",
          );
        await tx.query(
          "INSERT INTO yas.exam_assignments(exam_id,user_id,assigned_by,assignment_status) VALUES($1,$2,$3,$4) ON CONFLICT(exam_id,user_id) DO UPDATE SET assignment_status=EXCLUDED.assignment_status,assigned_by=EXCLUDED.assigned_by,assigned_at=now()",
          [examId, id, actor.id, remove ? "revoked" : "active"],
        );
        await this.audit(
          tx,
          actor,
          remove ? "assignment.revoked" : "assignment.created",
          "exam",
          examId,
          { userId: id },
        );
      }
    });
  }
  async attempt(tx: Queryable, id: string): Promise<ExamAttempt> {
    const attempts = await this.attempts(tx, [id]);
    assert(attempts[0], "Attempt not found.", 404);
    return attempts[0];
  }
  async attempts(tx: Queryable, ids: string[]): Promise<ExamAttempt[]> {
    if (!ids.length) return [];
    const { rows } = await tx.query(
      "SELECT a.*,r.earned_marks,r.maximum_marks,r.percentage,r.correct_count,r.incorrect_count,r.unattempted_count,r.passed,r.section_results,r.publication_status AS result_publication,r.published_at FROM yas.exam_attempts a LEFT JOIN yas.exam_results r ON r.attempt_id=a.id WHERE a.id=ANY($1::uuid[])",
      [ids],
    );
    const questionRows = (
      await tx.query(
        "SELECT attempt_id,snapshot FROM yas.attempt_questions WHERE attempt_id=ANY($1::uuid[]) ORDER BY display_order",
        [ids],
      )
    ).rows;
    const responseRows = (
      await tx.query(
        "SELECT * FROM yas.student_responses WHERE attempt_id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    return ids.flatMap((id) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return [];
      const questions = questionRows
        .filter((r) => r.attempt_id === id)
        .map((r) => r.snapshot as Question);
      const responses = responseRows
        .filter((r) => r.attempt_id === id)
        .map((r): StudentResponse => ({
          questionId: String(r.question_id),
          optionId: r.selected_option_id
            ? String(r.selected_option_id)
            : undefined,
          review: !!r.marked_for_review,
          visited: !!r.visited,
        }));
      return [attemptDto(row, questions, responses)];
    });
  }
  async finalize(tx: Queryable, id: string, reason: "manual" | "expired") {
    const row = (
      await tx.query("SELECT * FROM yas.exam_attempts WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    assert(row, "Attempt not found.", 404);
    if (row.status === "submitted") return this.attempt(tx, id);
    const current = await this.attempt(tx, id);
    const result = grade(
      current.questions,
      current.responses,
      current.sections,
      current.passingPercentage,
    );
    const dbNow = (await tx.query("SELECT clock_timestamp() AS now")).rows[0]
      .now;
    const expired = Date.parse(dbNow) >= Date.parse(row.expires_at);
    assert(reason === "manual" || expired, "Attempt has not expired.");
    await tx.query(
      "UPDATE yas.exam_attempts SET status='submitted',submitted_at=LEAST(clock_timestamp(),expires_at),submission_reason=$2,time_taken_seconds=GREATEST(0,FLOOR(EXTRACT(EPOCH FROM LEAST(clock_timestamp(),expires_at)-started_at))),revision=revision+1,updated_at=now() WHERE id=$1",
      [id, expired ? "expired" : "manual"],
    );
    await tx.query(
      "INSERT INTO yas.exam_results(attempt_id,user_id,exam_id,earned_marks,maximum_marks,percentage,correct_count,incorrect_count,unattempted_count,passed,section_results) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(attempt_id) DO NOTHING",
      [
        id,
        current.userId,
        current.examId,
        result.score,
        result.maximum,
        result.percentage,
        result.correct,
        result.incorrect,
        result.unattempted,
        result.passed,
        JSON.stringify(result.sections),
      ],
    );
    return this.attempt(tx, id);
  }
  async start(actor: User, examId: string): Promise<ExamAttempt> {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${actor.id}:${examId}`,
      ]);
      const user = await this.actor(tx, actor);
      assert(
        user.role === "student" && user.approval_status === "approved",
        "An approved student account is required.",
        403,
      );
      const existing = (
        await tx.query(
          "SELECT id,expires_at,clock_timestamp() AS db_now FROM yas.exam_attempts WHERE user_id=$1 AND exam_id=$2 AND status='in-progress'",
          [actor.id, examId],
        )
      ).rows[0];
      if (existing) {
        if (Date.parse(existing.expires_at) > Date.parse(existing.db_now))
          return safeAttempt(await this.attempt(tx, existing.id), false);
        await this.finalize(tx, existing.id, "expired");
      }
      await tx.query("SELECT id FROM yas.exams WHERE id=$1 FOR SHARE", [
        examId,
      ]);
      const exam = await this.exam(tx, examId);
      const time = (await tx.query("SELECT clock_timestamp() AS now")).rows[0]
        .now as Date;
      assert(exam.status === "published", "This exam is not published.", 403);
      assert(
        (
          await tx.query(
            "SELECT id FROM yas.exam_assignments WHERE exam_id=$1 AND user_id=$2 AND assignment_status='active'",
            [examId, actor.id],
          )
        ).rows[0],
        "You are not assigned to this exam.",
        403,
      );
      assert(
        Date.parse(exam.schedule.start) <= +time &&
          +time < Date.parse(exam.schedule.end),
        "This exam is outside its availability window.",
        403,
      );
      const count = Number(
        (
          await tx.query(
            "SELECT count(*) AS n FROM yas.exam_attempts WHERE user_id=$1 AND exam_id=$2",
            [actor.id, examId],
          )
        ).rows[0].n,
      );
      assert(count < exam.maxAttempts, "Attempt limit reached.", 403);
      assert(exam.questions.length, "This exam has no valid questions.");
      const id = randomUUID();
      const deadline = new Date(
        Math.min(+time + exam.duration * 60000, Date.parse(exam.schedule.end)),
      );
      await tx.query(
        "INSERT INTO yas.exam_attempts(id,exam_id,user_id,attempt_number,started_at,expires_at,exam_version,passing_percentage,sections_snapshot,allow_revisit,allow_sections,show_review) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          examId,
          actor.id,
          count + 1,
          time,
          deadline,
          exam.version,
          exam.passingPercentage,
          JSON.stringify(exam.sections),
          exam.allowRevisit,
          exam.allowSections,
          exam.showReview,
        ],
      );
      let questions = exam.allowSections
        ? exam.randomQuestions
          ? shuffle(exam.questions)
          : exam.questions
        : exam.sections.flatMap((s) => {
            const group = exam.questions.filter((q) => q.sectionId === s.id);
            return exam.randomQuestions ? shuffle(group) : group;
          });
      questions = questions.map((q) => ({
        ...q,
        options: exam.randomOptions ? shuffle(q.options) : q.options,
      }));
      const snapshots = questions.map((q, i) => ({
        id: randomUUID(),
        source_question_id: q.id,
        snapshot: q,
        display_order: i,
      }));
      for (const s of snapshots) s.snapshot = { ...s.snapshot, id: s.id };
      await tx.query(
        "INSERT INTO yas.attempt_questions(id,attempt_id,source_question_id,snapshot,display_order) SELECT x.id,$1,x.source_question_id,x.snapshot,x.display_order FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,source_question_id uuid,snapshot jsonb,display_order integer)",
        [id, JSON.stringify(snapshots)],
      );
      await this.audit(tx, actor, "attempt.started", "attempt", id);
      return safeAttempt(await this.attempt(tx, id), false);
    });
  }
  async saveResponse(
    actor: User,
    id: string,
    questionId: string,
    patch: { optionId?: string | null; review?: boolean; visited?: boolean },
    revision: number,
  ) {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, actor);
      const row = (
        await tx.query(
          "SELECT * FROM yas.exam_attempts WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      assert(row && row.user_id === actor.id, "Attempt not found.", 404);
      if (row.status === "submitted")
        throw new ServiceError(409, "This attempt is read-only.");
      // Read wall time after obtaining the row lock: a save may have waited
      // across the deadline while another request held that lock.
      const dbNow = (await tx.query("SELECT clock_timestamp() AS now")).rows[0]
        .now;
      if (Date.parse(dbNow) >= Date.parse(row.expires_at))
        return {
          attempt: safeAttempt(await this.finalize(tx, id, "expired"), false),
          expired: true,
        };
      assert(
        row.revision === revision,
        "This attempt changed in another tab. Reload and try again.",
        409,
      );
      const attempt = await this.attempt(tx, id);
      const index = attempt.questions.findIndex((q) => q.id === questionId);
      assert(index >= 0, "Question does not belong to this attempt.");
      const q = attempt.questions[index];
      if (patch.optionId)
        assert(
          q.options.some((o) => o.id === patch.optionId),
          "Invalid option.",
        );
      assert(
        attempt.allowRevisit || index >= attempt.currentIndex,
        "Revisiting earlier questions is disabled.",
      );
      if (!attempt.allowSections && index !== attempt.currentIndex + 1)
        assert(
          q.sectionId === attempt.questions[attempt.currentIndex].sectionId,
          "Complete sections in order.",
        );
      const prior = attempt.responses.find((r) => r.questionId === questionId);
      await tx.query(
        "INSERT INTO yas.student_responses(attempt_id,question_id,selected_option_id,marked_for_review,visited,answered_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id,marked_for_review=EXCLUDED.marked_for_review,visited=EXCLUDED.visited,answered_at=clock_timestamp(),updated_at=now()",
        [
          id,
          questionId,
          "optionId" in patch
            ? (patch.optionId ?? null)
            : (prior?.optionId ?? null),
          patch.review ?? prior?.review ?? false,
          patch.visited ?? prior?.visited ?? true,
        ],
      );
      await tx.query(
        "UPDATE yas.exam_attempts SET current_index=$2,revision=revision+1,updated_at=now() WHERE id=$1",
        [id, patch.visited ? index : attempt.currentIndex],
      );
      return {
        attempt: safeAttempt(await this.attempt(tx, id), false),
        expired: false,
      };
    });
  }
  async submit(actor: User, id: string) {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, actor);
      const row = (
        await tx.query(
          "SELECT user_id FROM yas.exam_attempts WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      assert(row && row.user_id === actor.id, "Attempt not found.", 404);
      const attempt = await this.finalize(tx, id, "manual");
      await this.audit(tx, actor, "attempt.submitted", "attempt", id);
      return safeAttempt(attempt, false);
    });
  }
  async finalizeExpired(actor: User) {
    const rows = (
      await this.db.query(
        "SELECT id FROM yas.exam_attempts WHERE status='in-progress' AND expires_at<=clock_timestamp() AND ($1::boolean OR user_id=$2) ORDER BY expires_at LIMIT 100",
        [actor.role === "admin", actor.id],
      )
    ).rows;
    for (const row of rows)
      await this.db.transaction((tx) => this.finalize(tx, row.id, "expired"));
  }
  async release(
    actor: User,
    examId: string,
    released: boolean,
    attemptId?: string,
  ) {
    await this.finalizeExpired(actor);
    await this.admin(actor, async (tx) => {
      const updated = await tx.query(
        "UPDATE yas.exam_results SET publication_status=$2,published_at=CASE WHEN $2='published' THEN now() ELSE NULL END,published_by=$3 WHERE exam_id=$1 AND ($4::uuid IS NULL OR attempt_id=$4)",
        [
          examId,
          released ? "published" : "withheld",
          actor.id,
          attemptId ?? null,
        ],
      );
      assert(
        updated.rowCount,
        "No submitted results match this selection.",
        404,
      );
      await this.audit(
        tx,
        actor,
        released ? "results.published" : "results.withheld",
        "exam",
        examId,
        { attemptId: attemptId ?? null },
      );
    });
  }
  async workspace(actor: User): Promise<WorkspaceData> {
    await this.actor(this.db, actor);
    await this.finalizeExpired(actor);
    const admin = actor.role === "admin";
    const userRows = (
      await this.db.query(
        "SELECT u.id,u.full_name,u.email,u.phone,u.role,u.approval_status,u.account_status,u.created_at,p.institution FROM yas.users u LEFT JOIN yas.user_profiles p ON p.user_id=u.id WHERE ($1::boolean OR u.id=$2) ORDER BY (u.id=$2) DESC,u.created_at DESC LIMIT 1000",
        [admin, actor.id],
      )
    ).rows;
    const ids = (
      await this.db.query(
        "SELECT e.id FROM yas.exams e WHERE $1::boolean OR (e.publication_status='published' AND EXISTS(SELECT 1 FROM yas.exam_assignments a WHERE a.exam_id=e.id AND a.user_id=$2 AND a.assignment_status='active')) OR EXISTS(SELECT 1 FROM yas.exam_attempts a WHERE a.exam_id=e.id AND a.user_id=$2) ORDER BY e.created_at DESC LIMIT 500",
        [admin, actor.id],
      )
    ).rows;
    const exams = (
      await this.exams(
        this.db,
        ids.map((r) => String(r.id)),
      )
    ).map((e) =>
      admin
        ? e
        : { ...e, questions: e.questions.map((q) => safeQuestion(q, true)) },
    );
    const assignments = (
      await this.db.query(
        'SELECT id,exam_id AS "examId",user_id AS "userId" FROM yas.exam_assignments WHERE assignment_status=\'active\' AND ($1::boolean OR user_id=$2) LIMIT 10000',
        [admin, actor.id],
      )
    ).rows as WorkspaceData["assignments"];
    const aids = (
      await this.db.query(
        "SELECT id FROM (SELECT id,created_at FROM yas.exam_attempts WHERE $1::boolean OR user_id=$2 ORDER BY (status='in-progress') DESC,created_at DESC LIMIT 2000) recent ORDER BY created_at",
        [admin, actor.id],
      )
    ).rows;
    const attempts = (
      await this.attempts(
        this.db,
        aids.map((r) => String(r.id)),
      )
    ).map((a) => safeAttempt(a, admin));
    const settings = (
      await this.db.query(
        "SELECT value FROM yas.settings WHERE key='workspace'",
      )
    ).rows[0]?.value ?? { organization: "YouAreSelected", supportEmail: "" };
    const m = (
      await this.db.query(
        `SELECT (SELECT count(*) FROM yas.users WHERE role='student') AS total_users,(SELECT count(*) FROM yas.users WHERE approval_status='pending' AND account_status='active' AND role='student') AS pending_users,(SELECT count(*) FROM yas.users WHERE approval_status='approved' AND account_status='active' AND role='student') AS approved_users,(SELECT count(*) FROM yas.exams) AS total_exams,(SELECT count(*) FROM yas.exams e JOIN yas.exam_schedules s ON s.exam_id=e.id WHERE e.publication_status='published' AND s.starts_at<=clock_timestamp() AND s.ends_at>clock_timestamp()) AS active_exams,(SELECT count(*) FROM yas.exam_attempts WHERE status='submitted' AND ($1::boolean OR user_id=$2)) AS submitted_attempts,(SELECT count(*) FROM yas.exam_assignments a JOIN yas.exams e ON e.id=a.exam_id WHERE a.user_id=$2 AND a.assignment_status='active' AND e.publication_status='published') AS assigned_exams,(SELECT count(*) FROM yas.exam_assignments a JOIN yas.exams e ON e.id=a.exam_id JOIN yas.exam_schedules s ON s.exam_id=e.id WHERE a.user_id=$2 AND a.assignment_status='active' AND e.publication_status='published' AND s.starts_at>clock_timestamp()) AS upcoming_exams,(SELECT count(*) FROM yas.exam_results WHERE publication_status='published' AND ($1::boolean OR user_id=$2)) AS published_results,(SELECT COALESCE(avg(percentage),0) FROM yas.exam_results WHERE ($1::boolean OR (user_id=$2 AND publication_status='published'))) AS average_score`,
        [admin, actor.id],
      )
    ).rows[0];
    const participation = admin
      ? (
          await this.db.query(
            "SELECT e.exam_code AS name,count(a.id)::int AS value FROM yas.exams e LEFT JOIN yas.exam_attempts a ON a.exam_id=e.id GROUP BY e.id ORDER BY e.created_at DESC LIMIT 50",
          )
        ).rows.map((r) => ({ name: String(r.name), value: Number(r.value) }))
      : [];
    return {
      version: 1,
      users: userRows.map(userDto),
      exams,
      assignments,
      attempts,
      settings,
      metrics: {
        totalUsers: admin ? Number(m.total_users) : 0,
        pendingUsers: admin ? Number(m.pending_users) : 0,
        approvedUsers: admin ? Number(m.approved_users) : 0,
        totalExams: admin ? Number(m.total_exams) : 0,
        activeExams: admin ? Number(m.active_exams) : 0,
        submittedAttempts: Number(m.submitted_attempts),
        assignedExams: Number(m.assigned_exams),
        upcomingExams: Number(m.upcoming_exams),
        publishedResults: Number(m.published_results),
        averageScore: Math.round(Number(m.average_score)),
        participation,
      },
    };
  }
  async users(
    actor: User,
    params: {
      page: number;
      pageSize: number;
      search: string;
      status: string;
      sort: string;
      desc: boolean;
      examId?: string;
    },
  ) {
    await this.actor(this.db, actor, true);
    const { page, pageSize, search, status } = params;
    const order =
      {
        name: "full_name",
        email: "email",
        registeredAt: "created_at",
        status: "approval_status",
      }[params.sort] ?? "created_at";
    const where =
      "role='student' AND (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1) AND ($2='all' OR CASE WHEN account_status='suspended' THEN 'suspended' ELSE approval_status END=$2) AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM yas.exam_assignments a WHERE a.user_id=u.id AND a.exam_id=$3 AND a.assignment_status='active'))";
    const { rows } = await this.db.query(
      `SELECT u.*,p.institution FROM yas.users u LEFT JOIN yas.user_profiles p ON p.user_id=u.id WHERE ${where} ORDER BY u.${order} ${params.desc ? "DESC" : "ASC"},u.id LIMIT $4 OFFSET $5`,
      [
        `%${search}%`,
        status,
        params.examId ?? null,
        pageSize,
        (page - 1) * pageSize,
      ],
    );
    const total = Number(
      (
        await this.db.query(
          `SELECT count(*) AS n FROM yas.users u WHERE ${where}`,
          [`%${search}%`, status, params.examId ?? null],
        )
      ).rows[0].n,
    );
    return { users: rows.map(userDto), total };
  }
  async settings(
    actor: User,
    input: { organization: string; supportEmail: string },
  ) {
    await this.admin(actor, async (tx) => {
      await tx.query(
        "UPDATE yas.settings SET value=$1,updated_at=now() WHERE key='workspace'",
        [JSON.stringify(input)],
      );
      await this.audit(tx, actor, "settings.updated", "settings", "workspace");
    });
  }
}
