import { afterEach, describe, expect, it } from "vitest";

import {
  downloadFile,
  MoodleError,
  normalizeSiteUrl,
  redact,
  requestToken,
  siteInfo,
  useNetworkFetch,
  userCourses,
  type NetworkFetch,
} from "../../apps/desktop/src/main/moodle/client";

const SITE = "https://moodle.example.edu";
const session = { siteUrl: SITE, token: "secret-token" };

interface Call {
  url: string;
  init: RequestInit | undefined;
}

const calls: Call[] = [];

/** Answers every request with the same body, and records what was asked. */
function serve(
  body: unknown,
  options: { status?: number; contentType?: string } = {},
): void {
  const fake: NetworkFetch = (url, init) => {
    calls.push({ url, init });
    const payload =
      body instanceof Uint8Array || typeof body === "string"
        ? body
        : JSON.stringify(body ?? null);
    return Promise.resolve(
      new Response(payload as BodyInit, {
        status: options.status ?? 200,
        headers: {
          "content-type": options.contentType ?? "application/json",
        },
      }),
    );
  };
  useNetworkFetch(fake);
}

afterEach(() => {
  calls.length = 0;
  useNetworkFetch(fetch);
});

describe("site addresses", () => {
  it("accepts what a student is likely to type", () => {
    expect(normalizeSiteUrl("moodle.example.edu")).toBe(SITE);
    expect(normalizeSiteUrl(" https://moodle.example.edu/ ")).toBe(SITE);
    expect(normalizeSiteUrl("https://moodle.example.edu/my/")).toBe(SITE);
    expect(normalizeSiteUrl("https://example.edu/moodle")).toBe(
      "https://example.edu/moodle",
    );
  });

  it("refuses plain http and nonsense", () => {
    expect(() => normalizeSiteUrl("http://moodle.example.edu")).toThrow(
      MoodleError,
    );
    expect(() => normalizeSiteUrl("   ")).toThrow(MoodleError);
  });
});

describe("tokens", () => {
  it("asks for the mobile service and returns the token", async () => {
    serve({ token: "abc123" });
    const token = await requestToken({
      siteUrl: SITE,
      username: "student",
      password: "hunter2",
    });
    expect(token).toBe("abc123");
    expect(calls[0]?.url).toBe(`${SITE}/login/token.php`);
    expect(String(calls[0]?.init?.body)).toContain("service=moodle_mobile_app");
  });

  it("explains a rejected sign-in", async () => {
    serve({
      error: "Invalid login, please try again",
      errorcode: "invalidlogin",
    });
    await expect(
      requestToken({ siteUrl: SITE, username: "s", password: "wrong" }),
    ).rejects.toThrow("That username or password was not accepted.");
  });

  it("says so when the site has no mobile service", async () => {
    serve({ hello: "world" });
    await expect(
      requestToken({ siteUrl: SITE, username: "s", password: "p" }),
    ).rejects.toThrow(/did not return a token/);
  });
});

describe("web-service calls", () => {
  it("sends the token, function, and JSON format", async () => {
    serve([{ id: 7, shortname: "MAT1", fullname: "Análise Matemática I" }]);
    const courses = await userCourses(session, 42);
    expect(courses).toEqual([
      { id: 7, shortname: "MAT1", fullname: "Análise Matemática I" },
    ]);
    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe("/webservice/rest/server.php");
    expect(url.searchParams.get("wstoken")).toBe("secret-token");
    expect(url.searchParams.get("wsfunction")).toBe(
      "core_enrol_get_users_courses",
    );
    expect(url.searchParams.get("moodlewsrestformat")).toBe("json");
    expect(url.searchParams.get("userid")).toBe("42");
  });

  it("asks the student to connect again when the token expired", async () => {
    serve({
      exception: "moodle_exception",
      errorcode: "invalidtoken",
      message: "Invalid token",
    });
    await expect(siteInfo(session)).rejects.toThrow(
      /Connect again in settings/,
    );
  });

  it("refuses a site that does not expose the functions resit uses", async () => {
    serve({
      sitename: "Example",
      username: "student",
      fullname: "A Student",
      userid: 42,
      functions: [{ name: "core_webservice_get_site_info" }],
    });
    await expect(siteInfo(session)).rejects.toThrow(
      /does not let this account read course contents/,
    );
  });

  it("reports an HTML answer as a bad address", async () => {
    serve("<html>Not found</html>", { contentType: "text/html" });
    await expect(siteInfo(session)).rejects.toThrow(
      /did not answer with web-service data/,
    );
  });

  it("keeps tokens out of messages", () => {
    expect(redact("GET /server.php?wstoken=abc123&x=1")).toBe(
      "GET /server.php?wstoken=***&x=1",
    );
    expect(redact("pluginfile.php/1/a.pdf?token=abc123")).toBe(
      "pluginfile.php/1/a.pdf?token=***",
    );
  });
});

describe("downloads", () => {
  it("adds the token and returns the bytes", async () => {
    serve(new Uint8Array([1, 2, 3]), { contentType: "application/pdf" });
    const bytes = await downloadFile(
      session,
      `${SITE}/webservice/pluginfile.php/9/mod_resource/content/0/a.pdf?forcedownload=1`,
      1000,
    );
    expect([...bytes]).toEqual([1, 2, 3]);
    const url = new URL(calls[0]?.url ?? "");
    expect(url.searchParams.get("token")).toBe("secret-token");
    expect(url.searchParams.get("forcedownload")).toBe("1");
  });

  it("will not fetch a file hosted somewhere else", async () => {
    serve(new Uint8Array([1]));
    await expect(
      downloadFile(session, "https://elsewhere.example/steal.pdf", 1000),
    ).rejects.toThrow(/stored outside moodle.example.edu/);
    expect(calls).toHaveLength(0);
  });

  it("stops a file bigger than the limit", async () => {
    serve(new Uint8Array(50), { contentType: "application/pdf" });
    await expect(
      downloadFile(session, `${SITE}/webservice/pluginfile.php/a.pdf`, 10),
    ).rejects.toThrow(/larger than resit downloads/);
  });

  it("does not save a JSON error as a file", async () => {
    serve({ errorcode: "invalidtoken", message: "Invalid token" });
    await expect(
      downloadFile(session, `${SITE}/webservice/pluginfile.php/a.pdf`, 1000),
    ).rejects.toThrow(/Connect again in settings/);
  });
});
