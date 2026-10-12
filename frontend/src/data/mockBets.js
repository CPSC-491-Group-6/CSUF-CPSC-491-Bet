// temp mock bet - will adjust after member C finished their endpoints in backend
export const mockBets = [
    {
        id: "1",
        join_code: "BET123",
        title: "Will it rain tomorrow?",
        description: "Predict whether it will rain tomorrow in Fullerton, CA.",
        status: "open",
        visibility: "public",
        current_participants: 2,
        max_participants: 5,
    },
    {
        id: "2",
        join_code: "BET456",
        title: "Will I finish my assignment before Friday?",
        description: "Predict whether the assignment will be completed and submitted before Friday at 11:59 PM.",
        status: "locked",
        visibility: "private",
        current_participants: 4,
        max_participants: 4,
    },
    {
        id: "3",
        join_code: "BET789",
        title: "Will I wake up before 7 AM tomorrow?",
        description: "Predict whether I will wake up before 7 AM tomorrow.",
        status: "open",
        visibility: "public",
        current_participants: 5,
        max_participants: 5,
    },
    {
        id: "4",
        join_code: "BET999",
        title: "Did I finish my assignment on time?",
        description: "The assignment deadline has passed and the outcome has been determined.",
        status: "resolved",
        visibility: "private",
        current_participants: 3,
        max_participants: 5,
    }
];