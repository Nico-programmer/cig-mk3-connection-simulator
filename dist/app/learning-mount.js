// Mounts the lesson guide (learning.js) and connects it to the bench.
import { mountLearning } from "../learning.js";
import { lessonCheck, prepareLesson } from "./lessons-bridge.js";
import { S } from "./state.js";

export const learning = mountLearning({
  getLanguage: () => S.lang,
  prepare: prepareLesson,
  getState: lessonCheck,
});
