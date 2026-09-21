import {
  localInstant,
  SESSION_KIND_LABELS,
  type PlanFile,
} from "../../shared/planning";

/** `20261005T170000Z`: the instant in UTC, as iCalendar writes it. */
function utcStamp(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Commas, semicolons, backslashes, and line breaks are escaped in text. */
function text(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 bytes continue on the next line after a space. */
function fold(line: string): string[] {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  for (const character of line) {
    const limit = lines.length === 0 ? 75 : 74;
    if (encoder.encode(current + character).length > limit) {
      lines.push(current);
      current = character;
    } else current += character;
  }
  lines.push(current);
  return lines.map((part, index) => (index === 0 ? part : ` ${part}`));
}

function nextDay(date: string): string {
  const day = localInstant(date, "12:00");
  day.setDate(day.getDate() + 1);
  return `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`;
}

/**
 * The plan as an iCalendar file: accepted sessions that were not skipped,
 * and assessments. Each session's wall-clock time is converted to the
 * instant it means on this computer, so summer time is already applied.
 */
export function calendarFile(
  plan: PlanFile,
  subjectNames: ReadonlyMap<string, string>,
  at = new Date(),
): string {
  const stamp = utcStamp(at);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//resit//Study plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:resit study plan",
  ];
  for (const session of plan.sessions) {
    if (session.proposal || session.status === "skipped") continue;
    const subject = session.subjectId
      ? subjectNames.get(session.subjectId)
      : undefined;
    const description = [
      [subject, SESSION_KIND_LABELS[session.kind]].filter(Boolean).join(" · "),
      session.notes,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${session.id}@resit.study`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(localInstant(session.date, session.start))}`,
      `DTEND:${utcStamp(localInstant(session.date, session.end))}`,
      `SUMMARY:${text(session.title)}`,
      ...(description ? [`DESCRIPTION:${text(description)}`] : []),
      "END:VEVENT",
    );
  }
  for (const assessment of plan.assessments) {
    const subject = assessment.subjectId
      ? subjectNames.get(assessment.subjectId)
      : undefined;
    const description = [subject, assessment.notes].filter(Boolean).join("\n");
    // A timed assessment has no end: resit does not know how long it runs.
    const when = assessment.time
      ? [`DTSTART:${utcStamp(localInstant(assessment.date, assessment.time))}`]
      : [
          `DTSTART;VALUE=DATE:${assessment.date.replace(/-/g, "")}`,
          `DTEND;VALUE=DATE:${nextDay(assessment.date)}`,
        ];
    lines.push(
      "BEGIN:VEVENT",
      `UID:assessment-${assessment.id}@resit.study`,
      `DTSTAMP:${stamp}`,
      ...when,
      `SUMMARY:${text(assessment.title)}`,
      ...(description ? [`DESCRIPTION:${text(description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}
