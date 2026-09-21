import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  learnerContext,
  learnerProfile,
  proposeTopic,
  readLearner,
  resolveTopicProposal,
  saveTopic,
  setPersonalization,
  topicEvidence,
  updatePreferences,
} from "../../apps/desktop/src/main/learner/store";
import {
  createCards,
  rateCard,
  saveQuiz,
  startAttempt,
  submitAttempt,
} from "../../apps/desktop/src/main/practice/store";
import {
  createSubject,
  createWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;
let mathematicsId: string;
let physicsId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-learner-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
  mathematicsId = snapshot(workspace).subjects[0]!.id;
  physicsId = (
    await createSubject(workspace, { name: "Physics", color: "orange" })
  ).id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("learner profile", () => {
  it("keeps the assistant's suggestion out of the profile until it is accepted, at the level the student picks", async () => {
    const proposal = await proposeTopic(workspace, {
      name: "Limits",
      subjectId: mathematicsId,
      level: "gap",
      reason: "Forgot 6 of 9 cards on it this week",
    });
    let file = await readLearner(workspace);
    expect(file.topics).toEqual([]);

    await resolveTopicProposal(workspace, {
      id: proposal.id,
      accept: true,
      level: "developing",
    });
    file = await readLearner(workspace);
    expect(file.topics).toEqual([
      expect.objectContaining({
        name: "Limits",
        level: "developing",
        source: "assistant",
      }),
    ]);
    expect(file.proposals[0]?.status).toBe("accepted");
  });

  it("does not make a rejected claim again, or one the profile already says", async () => {
    const first = await proposeTopic(workspace, {
      name: "Derivatives",
      subjectId: mathematicsId,
      level: "gap",
      reason: "Two wrong answers",
    });
    await resolveTopicProposal(workspace, { id: first.id, accept: false });
    await expect(
      proposeTopic(workspace, {
        name: "derivatives",
        subjectId: mathematicsId,
        level: "gap",
        reason: "Again",
      }),
    ).rejects.toThrow(/already rejected/);

    await saveTopic(workspace, {
      name: "Integrals",
      subjectId: mathematicsId,
      level: "secure",
    });
    await expect(
      proposeTopic(workspace, {
        name: "Integrals",
        subjectId: mathematicsId,
        level: "secure",
        reason: "All right",
      }),
    ).rejects.toThrow(/already has/);
  });

  it("refuses suggestions and tells the assistant nothing when personalization is off", async () => {
    await updatePreferences(workspace, {
      detail: "thorough",
      hintsFirst: true,
      about: "First year of Electrical Engineering, resitting Calculus I.",
    });
    await saveTopic(workspace, {
      name: "Limits",
      subjectId: mathematicsId,
      level: "gap",
    });
    await saveTopic(workspace, {
      name: "Kinematics",
      subjectId: physicsId,
      level: "developing",
    });
    const scope = { subjectIds: [mathematicsId], resourceIds: [] };
    const block = await learnerContext(workspace, scope);
    expect(block).toContain("thorough explanations");
    expect(block).toContain("Hints first");
    expect(block).toContain("resitting Calculus I");
    expect(block).toContain("- Limits (Mathematics): gap");
    // Topics of subjects outside the conversation stay out of it.
    expect(block).not.toContain("Kinematics");

    await setPersonalization(workspace, false);
    expect(await learnerContext(workspace, scope)).toBeNull();
    await expect(
      proposeTopic(workspace, {
        name: "Limits",
        subjectId: mathematicsId,
        level: "developing",
        reason: "Better lately",
      }),
    ).rejects.toThrow(/personalization off/);
  });

  it("says nothing when the profile holds nothing", async () => {
    expect(
      await learnerContext(workspace, {
        subjectIds: [mathematicsId],
        resourceIds: [],
      }),
    ).toBeNull();
  });

  it("counts practice by topic without judging it", async () => {
    const cards = await createCards(workspace, mathematicsId, [
      { kind: "basic", front: "a", back: "b", topic: "Limits" },
      { kind: "basic", front: "c", back: "d", topic: "Limits" },
    ]);
    await rateCard(workspace, {
      subjectId: mathematicsId,
      cardId: cards[0]!.id,
      rating: "again",
    });
    await rateCard(workspace, {
      subjectId: mathematicsId,
      cardId: cards[1]!.id,
      rating: "good",
    });
    const quiz = await saveQuiz(workspace, mathematicsId, {
      title: "Limits",
      topic: "limits",
      questions: [
        { kind: "short", prompt: "1 + 1?", answer: "2" },
        { kind: "short", prompt: "2 + 2?", answer: "4" },
      ],
    });
    const attempt = await startAttempt(workspace, mathematicsId, quiz.id);
    await submitAttempt(workspace, mathematicsId, quiz.id, attempt.id, {
      [attempt.questions[0]!.id]: { answer: "2" },
      [attempt.questions[1]!.id]: { answer: "5" },
    });

    const [limits] = await topicEvidence(workspace);
    // "Limits" and "limits" are one topic.
    expect(limits).toMatchObject({
      subjectId: mathematicsId,
      topic: "Limits",
      cards: 2,
      reviews: 2,
      forgotten: 1,
      answered: 2,
      right: 1,
    });
    expect((await learnerProfile(workspace)).evidence).toHaveLength(1);
  });
});

describe("accepting a suggestion", () => {
  it("updates a topic the student added while it waited, rather than adding it twice", async () => {
    const proposal = await proposeTopic(workspace, {
      name: "Limits",
      subjectId: mathematicsId,
      level: "gap",
      reason: "Forgot most cards on it",
    });
    await saveTopic(workspace, {
      name: "limits",
      subjectId: mathematicsId,
      level: "developing",
    });
    await resolveTopicProposal(workspace, { id: proposal.id, accept: true });
    const { topics } = await readLearner(workspace);
    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({ name: "limits", level: "gap" });
  });
});
