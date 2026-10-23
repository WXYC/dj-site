import type { SpecialtyShow, SpecialtyShowSlot } from "@wxyc/shared";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Sunday at noon", "Friday at 9:00 PM": the slot in station (Eastern) time. */
export function describeSlot({ day, start_time }: SpecialtyShowSlot): string {
  const [hour, minute] = start_time.split(":").map(Number);
  if (hour === 12 && minute === 0) {
    return `${DAYS[day]} at noon`;
  }
  if (hour === 0 && minute === 0) {
    return `${DAYS[day]} at midnight`;
  }
  const clock = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  return `${DAYS[day]} at ${clock}`;
}

const LONG_NAME_LENGTH = 24;

/** A program's name on a button: the display name, or `short_name` once the display name is long. */
export function oneTapName({ name, short_name }: Pick<SpecialtyShow, "name" | "short_name">): string {
  return name.length > LONG_NAME_LENGTH ? short_name : name;
}

/** "...start your own." becomes "...start your own as <program>." after a one-tap press. */
export function withStartAs(sentence: string, program?: string): string {
  return program ? sentence.replace(/\.$/, ` as ${program}.`) : sentence;
}

export const REJECTED_PROGRAM_SENTENCE =
  "The DJ site couldn't tag this show with that program. It may have been retired. Try again, or carry on without a tag.";

export const SHOW_DETAILS_REFUSED_SENTENCE =
  "The DJ site couldn't save this show's details. Try again.";

/** A one-tap press whose program the server would not tag: nothing opened, so say what still works. */
export const ONE_TAP_TAG_REFUSED_SENTENCE =
  "The DJ site couldn't open the show as that program. It may have been retired. Going live the usual way still works.";

/** Every string the set-tagging question shows; refusals have their own sentences above. */
export const specialtyCopy = {
  goLiveAs: (program: Pick<SpecialtyShow, "name" | "short_name">) =>
    `Go live as ${oneTapName(program)}`,
  signOnAs: (program: Pick<SpecialtyShow, "name" | "short_name">) =>
    `Sign on and Start ${oneTapName(program)}!`,
  goLiveAsWhy: "Going live as the show is what puts it on listeners' screens.",
  askOne: (slot: string, name: string) => `${slot} is usually ${name}. Is this set ${name}?`,
  askShared: (slot: string, names: string[]) =>
    `${slot} is usually ${names.join(" or ")}. Is this set one of them?`,
  yes: (name: string) => `Yes, it's ${name}`,
  notThisTime: "Not this time",
  tagged: (name: string) => `The DJ site will show this set as ${name}.`,
  titleLabel: "Title for this week",
  editDetailsTitle: "Edit show details",
  editDetails: "Edit show details",
  programLabel: "Program",
  noneFreeform: "None (freeform)",
  save: "Save",
  cancel: "Cancel",
  done: "Done",
  freeform: "Freeform",
};
