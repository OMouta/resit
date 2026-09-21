import { msg } from "@resit/ui/lib/i18n";

export const SUBJECT_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

/** Each colour's name in English. Show it through `t`. */
export const subjectColorLabels: Record<SubjectColor, string> = {
  gray: msg("Grey"),
  brown: msg("Brown"),
  orange: msg("Orange"),
  yellow: msg("Yellow"),
  green: msg("Green"),
  blue: msg("Blue"),
  purple: msg("Purple"),
  pink: msg("Pink"),
  red: msg("Red"),
};

/** Tailwind classes for the strong and soft variants of a subject colour. */
export const subjectColorClasses: Record<
  SubjectColor,
  { text: string; bg: string; softBg: string; border: string; dot: string }
> = {
  gray: {
    text: "text-subject-gray",
    bg: "bg-subject-gray",
    softBg: "bg-subject-gray-soft",
    border: "border-subject-gray",
    dot: "bg-subject-gray",
  },
  brown: {
    text: "text-subject-brown",
    bg: "bg-subject-brown",
    softBg: "bg-subject-brown-soft",
    border: "border-subject-brown",
    dot: "bg-subject-brown",
  },
  orange: {
    text: "text-subject-orange",
    bg: "bg-subject-orange",
    softBg: "bg-subject-orange-soft",
    border: "border-subject-orange",
    dot: "bg-subject-orange",
  },
  yellow: {
    text: "text-subject-yellow",
    bg: "bg-subject-yellow",
    softBg: "bg-subject-yellow-soft",
    border: "border-subject-yellow",
    dot: "bg-subject-yellow",
  },
  green: {
    text: "text-subject-green",
    bg: "bg-subject-green",
    softBg: "bg-subject-green-soft",
    border: "border-subject-green",
    dot: "bg-subject-green",
  },
  blue: {
    text: "text-subject-blue",
    bg: "bg-subject-blue",
    softBg: "bg-subject-blue-soft",
    border: "border-subject-blue",
    dot: "bg-subject-blue",
  },
  purple: {
    text: "text-subject-purple",
    bg: "bg-subject-purple",
    softBg: "bg-subject-purple-soft",
    border: "border-subject-purple",
    dot: "bg-subject-purple",
  },
  pink: {
    text: "text-subject-pink",
    bg: "bg-subject-pink",
    softBg: "bg-subject-pink-soft",
    border: "border-subject-pink",
    dot: "bg-subject-pink",
  },
  red: {
    text: "text-subject-red",
    bg: "bg-subject-red",
    softBg: "bg-subject-red-soft",
    border: "border-subject-red",
    dot: "bg-subject-red",
  },
};
