module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "init",
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "chore",
        "build",
        "ci",
        "revert",
      ],
    ],
    "subject-case": [2, "always", ["sentence-case", "lower-case"]],
    "subject-empty": [2, "never"],
    "type-empty": [2, "never"],
  },
};
