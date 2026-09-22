import { z } from "zod";

import type { MoodleCourse } from "../../shared/moodle";
import { t } from "../i18n";

/** The external service the Moodle mobile app uses. */
const SERVICE = "moodle_mobile_app";
const CALL_TIMEOUT = 20_000;
const DOWNLOAD_TIMEOUT = 5 * 60_000;

export interface MoodleSession {
  siteUrl: string;
  token: string;
  /** The account the token belongs to, for requests about the student. */
  userId?: number;
}

export class MoodleError extends Error {}

export type NetworkFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Electron's `net.fetch` follows the system proxy and certificate store, which
 * a university network usually needs. Tests replace it.
 */
let networkFetch: NetworkFetch = fetch;

export function useNetworkFetch(implementation: NetworkFetch): void {
  networkFetch = implementation;
}

/** Hides a token that found its way into a message from the site. */
export function redact(text: string): string {
  return text.replace(/((?:ws)?token)=[^&\s"']+/gi, "$1=***");
}

/**
 * Accepts what a student is likely to type ("moodle.example.edu",
 * "https://moodle.example.edu/my/") and returns the site root.
 */
export function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new MoodleError(t("Enter your Moodle address."));
  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    throw new MoodleError(
      t("{address} is not a valid address.", { address: trimmed }),
    );
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new MoodleError(t("Moodle must be reached over https."));
  const path = url.pathname
    .replace(/\/(login|webservice|my|course)(\/.*)?$/i, "")
    .replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

const errorSchema = z.looseObject({
  exception: z.string().optional(),
  errorcode: z.string().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/** Turns Moodle's error bodies into something a student can act on. */
function assertNotError(body: unknown, siteHost: string): void {
  const parsed = errorSchema.safeParse(body);
  if (!parsed.success) return;
  const { exception, errorcode, error, message } = parsed.data;
  if (!exception && !error && !errorcode) return;
  const detail = redact(
    message ?? error ?? errorcode ?? t("Moodle refused the request."),
  );
  if (errorcode === "invalidtoken" || errorcode === "accessexception")
    throw new MoodleError(
      t(
        "{site} no longer accepts this connection. Connect again in settings.",
        { site: siteHost },
      ),
    );
  if (errorcode === "nopermissions" || errorcode === "requireloginerror")
    throw new MoodleError(
      `${t("Your account cannot see that in Moodle.")} ${detail}`,
    );
  throw new MoodleError(detail);
}

async function readJson(
  response: Response,
  siteHost: string,
): Promise<unknown> {
  const text = await response.text();
  if (!response.ok)
    throw new MoodleError(
      `${t("{site} answered {status}.", { site: siteHost, status: response.status })} ${redact(text.slice(0, 200))}`.trim(),
    );
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MoodleError(
      t(
        "{site} did not answer with web-service data. Check the address, and that web services are enabled.",
        { site: siteHost },
      ),
    );
  }
}

async function call<T>(
  session: MoodleSession,
  wsfunction: string,
  schema: z.ZodType<T>,
  params: Record<string, string | number> = {},
): Promise<T> {
  const siteHost = new URL(session.siteUrl).host;
  const url = new URL(`${session.siteUrl}/webservice/rest/server.php`);
  url.searchParams.set("wstoken", session.token);
  url.searchParams.set("wsfunction", wsfunction);
  url.searchParams.set("moodlewsrestformat", "json");
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));

  let response: Response;
  try {
    response = await networkFetch(url.toString(), {
      signal: AbortSignal.timeout(CALL_TIMEOUT),
    });
  } catch (error) {
    throw new MoodleError(
      `${t("resit could not reach {site}.", { site: siteHost })} ${redact(error instanceof Error ? error.message : String(error))}`,
    );
  }
  const body = await readJson(response, siteHost);
  assertNotError(body, siteHost);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new MoodleError(
      t("{site} answered {function} in a shape resit does not understand.", {
        site: siteHost,
        function: wsfunction,
      }),
    );
  return parsed.data;
}

const tokenSchema = z.looseObject({ token: z.string().min(1) });

/** Exchanges a password for a web-service token. The password is not kept. */
export async function requestToken(input: {
  siteUrl: string;
  username: string;
  password: string;
}): Promise<string> {
  const siteHost = new URL(input.siteUrl).host;
  const body = new URLSearchParams({
    username: input.username,
    password: input.password,
    service: SERVICE,
  });
  let response: Response;
  try {
    response = await networkFetch(`${input.siteUrl}/login/token.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(CALL_TIMEOUT),
    });
  } catch (error) {
    throw new MoodleError(
      `${t("resit could not reach {site}.", { site: siteHost })} ${redact(error instanceof Error ? error.message : String(error))}`,
    );
  }
  const payload = await readJson(response, siteHost);
  const failure = errorSchema.safeParse(payload);
  if (failure.success && (failure.data.error || failure.data.errorcode)) {
    const code = failure.data.errorcode;
    if (code === "invalidlogin")
      throw new MoodleError(t("That username or password was not accepted."));
    if (code === "enablewsdescription")
      throw new MoodleError(
        t("{site} has web services turned off, so resit cannot connect.", {
          site: siteHost,
        }),
      );
    throw new MoodleError(
      redact(failure.data.error ?? code ?? t("Moodle refused the sign-in.")),
    );
  }
  const parsed = tokenSchema.safeParse(payload);
  if (!parsed.success)
    throw new MoodleError(
      t(
        "{site} did not return a token. Its mobile web service may be turned off.",
        { site: siteHost },
      ),
    );
  return parsed.data.token;
}

const siteInfoSchema = z.looseObject({
  sitename: z.string().catch(""),
  username: z.string().catch(""),
  fullname: z.string().catch(""),
  userid: z.number().int(),
  functions: z.array(z.looseObject({ name: z.string() })).catch([]),
});

export interface MoodleSiteInfo {
  siteName: string;
  username: string;
  fullName: string;
  userId: number;
}

const NEEDED = ["core_enrol_get_users_courses", "core_course_get_contents"];

/** Checks the token and that the site exposes the functions resit uses. */
export async function siteInfo(
  session: MoodleSession,
): Promise<MoodleSiteInfo> {
  const info = await call(
    session,
    "core_webservice_get_site_info",
    siteInfoSchema,
  );
  if (info.functions.length > 0) {
    const available = new Set(info.functions.map((entry) => entry.name));
    const missing = NEEDED.filter((name) => !available.has(name));
    if (missing.length > 0)
      throw new MoodleError(
        t(
          "{site} does not let this account read course contents through its web service.",
          { site: new URL(session.siteUrl).host },
        ),
      );
  }
  return {
    siteName: info.sitename,
    username: info.username,
    fullName: info.fullname,
    userId: info.userid,
  };
}

const coursesSchema = z.array(
  z.looseObject({
    id: z.number().int(),
    shortname: z.string().catch(""),
    fullname: z.string().catch(""),
  }),
);

export async function userCourses(
  session: MoodleSession,
  userId: number,
): Promise<MoodleCourse[]> {
  const courses = await call(
    session,
    "core_enrol_get_users_courses",
    coursesSchema,
    { userid: userId },
  );
  return courses.map((course) => ({
    id: course.id,
    shortname: course.shortname,
    fullname:
      course.fullname ||
      course.shortname ||
      t("Course {id}", { id: course.id }),
  }));
}

export const moodleContentSchema = z.looseObject({
  type: z.string().catch("file"),
  filename: z.string().catch(""),
  filepath: z.string().catch("/"),
  filesize: z.number().catch(0),
  fileurl: z.string().optional(),
  timemodified: z.number().catch(0),
  isexternalfile: z.boolean().optional(),
  /** A book chapter's title, beside its `index.html`. */
  content: z.string().optional().catch(undefined),
});

export const moodleModuleSchema = z.looseObject({
  id: z.number().int(),
  name: z.string().catch(""),
  modname: z.string().catch(""),
  /** Labels have no page of their own, so no address. */
  url: z.string().optional(),
  /** HTML, sent only when the course page shows it. */
  description: z.string().optional(),
  uservisible: z.boolean().optional(),
  dates: z
    .array(
      z.looseObject({
        label: z.string().catch(""),
        timestamp: z.number(),
        dataid: z.string().optional(),
      }),
    )
    .optional()
    .catch(undefined),
  contents: z.array(moodleContentSchema).optional(),
});

export const moodleSectionSchema = z.looseObject({
  name: z.string().catch(""),
  section: z.number().catch(0),
  /** HTML shown at the top of the section. */
  summary: z.string().optional().catch(undefined),
  uservisible: z.boolean().optional(),
  modules: z.array(moodleModuleSchema).catch([]),
});

export type MoodleSection = z.infer<typeof moodleSectionSchema>;

export function courseContents(
  session: MoodleSession,
  courseId: number,
): Promise<MoodleSection[]> {
  return call(
    session,
    "core_course_get_contents",
    z.array(moodleSectionSchema),
    { courseid: courseId },
  );
}

const assignmentsSchema = z.looseObject({
  courses: z
    .array(
      z.looseObject({
        assignments: z
          .array(
            z.looseObject({
              /** The assignment itself, as opposed to its course module. */
              id: z.number().int(),
              cmid: z.number().int(),
              /** HTML. Left out until Moodle shows the brief to students. */
              intro: z.string().optional(),
              /** Extra instructions, sent while submissions are open. */
              activity: z.string().optional(),
              introattachments: z.array(moodleContentSchema).catch([]),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});

export type MoodleAssignment = z.infer<
  typeof assignmentsSchema
>["courses"][number]["assignments"][number];

/**
 * Assignment briefs and their attachments. `core_course_get_contents` sends
 * neither: assignments have no files there.
 */
export async function courseAssignments(
  session: MoodleSession,
  courseId: number,
): Promise<MoodleAssignment[]> {
  const result = await call(
    session,
    "mod_assign_get_assignments",
    assignmentsSchema,
    { "courseids[0]": courseId },
  );
  return result.courses.flatMap((course) => course.assignments);
}

const submissionStatusSchema = z.looseObject({
  lastattempt: z
    .looseObject({
      submission: z.looseObject({ status: z.string() }).optional(),
      /** Set instead of `submission` when the class submits in groups. */
      teamsubmission: z.looseObject({ status: z.string() }).optional(),
      submissionsenabled: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Whether the student has handed in an assignment: `new`, `draft`,
 * `submitted`, or `reopened`. Undefined when it takes no submissions.
 */
export async function submissionStatus(
  session: MoodleSession,
  assignmentId: number,
): Promise<string | undefined> {
  const { lastattempt } = await call(
    session,
    "mod_assign_get_submission_status",
    submissionStatusSchema,
    { assignid: assignmentId },
  );
  if (!lastattempt || lastattempt.submissionsenabled === false) return;
  return (lastattempt.submission ?? lastattempt.teamsubmission)?.status;
}

const gradeItemsSchema = z.looseObject({
  usergrades: z
    .array(
      z.looseObject({
        gradeitems: z
          .array(
            z.looseObject({
              /** `mod` for an activity, `course` for the course total. */
              itemtype: z.string().catch(""),
              cmid: z.number().int().optional().catch(undefined),
              graderaw: z.number().nullable().optional().catch(null),
              gradeformatted: z.string().catch(""),
              grademax: z.number().catch(0),
              gradeishidden: z.boolean().optional(),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});

export type MoodleGradeItem = z.infer<
  typeof gradeItemsSchema
>["usergrades"][number]["gradeitems"][number];

/** The student's gradebook for one course. */
export async function gradeItems(
  session: MoodleSession,
  courseId: number,
  userId: number,
): Promise<MoodleGradeItem[]> {
  const result = await call(
    session,
    "gradereport_user_get_grade_items",
    gradeItemsSchema,
    { courseid: courseId, userid: userId },
  );
  return result.usergrades.flatMap((entry) => entry.gradeitems);
}

const forumsSchema = z.array(
  z.looseObject({
    id: z.number().int(),
    /** `news` for the course's announcements forum. */
    type: z.string().catch(""),
  }),
);

/** The course's forums, to find the one teachers post announcements in. */
export function courseForums(
  session: MoodleSession,
  courseId: number,
): Promise<z.infer<typeof forumsSchema>> {
  return call(session, "mod_forum_get_forums_by_courses", forumsSchema, {
    "courseids[0]": courseId,
  });
}

const discussionsSchema = z.looseObject({
  discussions: z
    .array(
      z.looseObject({
        /** The discussion, as opposed to `id`, its first post. */
        discussion: z.number().int(),
        subject: z.string().catch(""),
        /** HTML. */
        message: z.string().catch(""),
        userfullname: z.string().catch(""),
        created: z.number().catch(0),
        pinned: z.boolean().catch(false),
      }),
    )
    .catch([]),
});

export type MoodleDiscussion = z.infer<
  typeof discussionsSchema
>["discussions"][number];

/** The latest discussions in one forum, with each one's first post. */
export async function forumDiscussions(
  session: MoodleSession,
  forumId: number,
  count: number,
): Promise<MoodleDiscussion[]> {
  const result = await call(
    session,
    "mod_forum_get_forum_discussions",
    discussionsSchema,
    { forumid: forumId, page: 0, perpage: count },
  );
  return result.discussions;
}

/**
 * Downloads one course file. Only the configured site is fetched, so a course
 * cannot point resit at another host with the token attached.
 */
export async function downloadFile(
  session: MoodleSession,
  fileUrl: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const site = new URL(session.siteUrl);
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    throw new MoodleError(t("Moodle gave an address resit cannot read."));
  }
  if (url.origin !== site.origin)
    throw new MoodleError(
      t("That file is stored outside {site}.", { site: site.host }),
    );
  url.searchParams.set("token", session.token);

  let response: Response;
  try {
    response = await networkFetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
    });
  } catch (error) {
    throw new MoodleError(
      `${t("The download stopped.")} ${redact(error instanceof Error ? error.message : String(error))}`,
    );
  }
  if (!response.ok)
    throw new MoodleError(
      t("{site} answered {status}.", {
        site: site.host,
        status: response.status,
      }),
    );

  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new MoodleError(t("The file is larger than resit downloads."));

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes)
    throw new MoodleError(t("The file is larger than resit downloads."));

  // An expired token answers the file endpoint with a JSON error, not a file.
  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      assertNotError(
        JSON.parse(Buffer.from(bytes).toString("utf8")),
        site.host,
      );
    } catch (error) {
      if (error instanceof MoodleError) throw error;
    }
  }
  return bytes;
}
