export const mockBets = [
  {
    id: 1,
    title: "Lakers vs Warriors",
    description: "Who will win the next basketball game?",
    deadline: "2026-11-15T19:00:00",
    status: "active",
  },
  {
    id: 2,
    title: "Finish the Semester Project",
    description: "Complete the project before the final deadline.",
    deadline: "2026-12-01T23:59:00",
    status: "active",
  },
  {
    id: 3,
    title: "Weekend Fitness Challenge",
    description: "Complete three workouts over the weekend.",
    deadline: "2026-10-04T18:00:00",
    status: "completed",
  },
];

export async function getMockBets(mode = "success") {
  if (mode === "error") {
    throw new Error("Unable to load bets. Please try again.");
  }

  if (mode === "empty") {
    return [];
  }

  return mockBets;
}
