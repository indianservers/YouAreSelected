import { z } from "zod";
import type { Database } from "./db";
import type { User } from "@/types/domain";
import { PlatformRepository } from "./platform";
export const reportFilters = z.object({
  exam: z.uuid().or(z.literal("all")).default("all"),
  student: z.uuid().or(z.literal("all")).default("all"),
  publication: z.enum(["all", "published", "withheld"]).default("all"),
  status: z.enum(["all", "submitted", "in-progress"]).default("submitted"),
  from: z.iso.date().or(z.literal("")).default(""),
  to: z.iso.date().or(z.literal("")).default(""),
  format: z.enum(["csv", "xlsx"]).default("csv"),
  kind: z
    .enum([
      "scores",
      "users",
      "approved",
      "assignments",
      "participation",
      "attempts",
      "sections",
      "statistics",
    ])
    .default("scores"),
});
export async function reportRows(
  db: Database,
  actor: User,
  filter: z.infer<typeof reportFilters>,
): Promise<Record<string, unknown>[]> {
  const repo = new PlatformRepository(db);
  await repo.actor(db, actor, true);
  await repo.finalizeExpired(actor);
  const values = [
    filter.exam === "all" ? null : filter.exam,
    filter.student === "all" ? null : filter.student,
    filter.publication,
    filter.status,
    filter.from || null,
    filter.to || null,
  ];
  const where = `($1::uuid IS NULL OR a.exam_id=$1) AND ($2::uuid IS NULL OR a.user_id=$2) AND ($3='all' OR r.publication_status=$3) AND ($4='all' OR a.status=$4) AND ($5::date IS NULL OR COALESCE(a.submitted_at,a.started_at)>=($5::date::timestamp AT TIME ZONE 'UTC')) AND ($6::date IS NULL OR COALESCE(a.submitted_at,a.started_at)<(($6::date+1)::timestamp AT TIME ZONE 'UTC'))`;
  if (filter.kind === "users" || filter.kind === "approved")
    return (
      await db.query(
        `SELECT full_name AS "Name",email AS "Email",phone AS "Phone",approval_status AS "Approval",account_status AS "Account status",created_at AS "Registered at" FROM yas.users u WHERE role='student' AND ($1::boolean=false OR (approval_status='approved' AND account_status='active')) AND ($2::uuid IS NULL OR id=$2) AND ($3::date IS NULL OR created_at>=($3::date::timestamp AT TIME ZONE 'UTC')) AND ($4::date IS NULL OR created_at<(($4::date+1)::timestamp AT TIME ZONE 'UTC')) AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM yas.exam_assignments a WHERE a.exam_id=$5 AND a.user_id=u.id)) ORDER BY created_at,id LIMIT 10000`,
        [filter.kind === "approved",values[1],values[4],values[5],values[0]],
      )
    ).rows;
  if (filter.kind === "assignments")
    return (
      await db.query(
        'SELECT u.full_name AS "Student",u.email AS "Email",e.title AS "Examination",a.assignment_status AS "Assignment status",a.assigned_at AS "Assigned at" FROM yas.exam_assignments a JOIN yas.users u ON u.id=a.user_id JOIN yas.exams e ON e.id=a.exam_id WHERE ($1::uuid IS NULL OR a.exam_id=$1) AND ($2::uuid IS NULL OR a.user_id=$2) ORDER BY a.assigned_at,a.id LIMIT 10000',
        values.slice(0, 2),
      )
    ).rows;
  if (filter.kind === "statistics" || filter.kind === "participation")
    return (
      await db.query(
        `SELECT e.title AS "Examination",count(a.id)::int AS "Started attempts",count(r.id)::int AS "Submitted attempts",round(avg(r.percentage),2) AS "Average percentage",max(r.percentage) AS "Highest percentage",count(*) FILTER(WHERE r.passed)::int AS "Passed" FROM yas.exam_attempts a JOIN yas.exams e ON e.id=a.exam_id LEFT JOIN yas.exam_results r ON r.attempt_id=a.id WHERE ${where} GROUP BY e.id ORDER BY e.title LIMIT 10000`,
        values,
      )
    ).rows;
  if (filter.kind === "sections")
    return (
      await db.query(
        `SELECT u.full_name AS "Student",u.email AS "Email",e.title AS "Examination",a.id AS "Attempt reference",s->>'name' AS "Section",s->>'score' AS "Score",s->>'maximum' AS "Maximum marks",s->>'correct' AS "Correct",s->>'incorrect' AS "Incorrect",s->>'unattempted' AS "Unattempted" FROM yas.exam_attempts a JOIN yas.users u ON u.id=a.user_id JOIN yas.exams e ON e.id=a.exam_id JOIN yas.exam_results r ON r.attempt_id=a.id CROSS JOIN LATERAL jsonb_array_elements(r.section_results) s WHERE ${where} ORDER BY a.created_at,a.id LIMIT 10000`,
        values,
      )
    ).rows;
  return (
    await db.query(
      `SELECT u.full_name AS "Student",u.email AS "Email",e.title AS "Examination",a.id AS "Attempt reference",a.submitted_at AS "Submitted at",r.earned_marks::float8 AS "Score",r.maximum_marks::float8 AS "Maximum marks",r.percentage::float8 AS "Percentage",r.correct_count AS "Correct",r.incorrect_count AS "Incorrect",r.unattempted_count AS "Unattempted",a.time_taken_seconds AS "Time taken (seconds)",CASE WHEN r.passed THEN 'Passed' ELSE 'Not passed' END AS "Result",r.publication_status AS "Publication",a.status AS "Attempt status" FROM yas.exam_attempts a JOIN yas.users u ON u.id=a.user_id JOIN yas.exams e ON e.id=a.exam_id LEFT JOIN yas.exam_results r ON r.attempt_id=a.id WHERE ${where} ${filter.kind === "attempts" ? "" : "AND a.status='submitted'"} ORDER BY a.created_at,a.id LIMIT 10000`,
      values,
    )
  ).rows;
}
