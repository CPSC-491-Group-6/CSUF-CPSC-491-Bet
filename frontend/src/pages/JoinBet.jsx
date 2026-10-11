import {useState} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/JoinBet.css"

// temp mock bet - will adjust after member C finished their endpoints in backend
const mockBets = [
    {
        id: 1,
        joinCode: "BET123",
        title: "Will the Lakers win tonight?",
        status: "open",
        visibility: "Public",
        participants: 5,
        maxParticipants: 5,
    },
    {
        id: 2,
        joinCode: "BET456",
        title: "Will it rain tomorrow?",
        status: "locked",
        visibility: "Private",
        participants: 4,
        maxParticipants: 4,
    },
];

export default function JoinBet() {
    const [joinCode, setJoinCode] = useState("");
    const [error, setError] = useState("");
    const [selectedBet, setSelectedBet] = useState(null);
    const navigate = useNavigate();

    function handleJoin(event) {
        event.preventDefault();
        setError("");
        setSelectedBet(null);

        const code = joinCode.trim().toUpperCase();

        // empty join code
        if (!code) {
            setError("Please enter a join code!");
            return;
        }

        // find bet with join code
        const bet = mockBets.find(
            (bet) => bet.joinCode === code
        );

        // invalid code
        if (!bet) {
            setError("Invalid join code! Please enter a valid code.");
            return;
        }

        setSelectedBet(bet)
    }

    function getBetDisplayStatus(bet) {
        if (bet.status === "locked") {
            return "Locked";
        }

        if (bet.participants >= bet.maxParticipants) {
            return "Full";
        }

        return "Open";
    }

    function handleViewDetails() {
        if (selectedBet) {
            navigate(`/bets/${selectedBet.id}`);
        }
    }

    return (
        <div className="join-page">
            <div className="join-header">
                <h1>Join a bet</h1>
                <p>
                    Have an invite code? Enter it below to find
                    a bet and review its details.
                </p>
            </div>

            <div className="join-card">
                <form onSubmit={handleJoin}>
                    <div>
                        <label htmlFor="joinCode">Invite Code</label>

                        <input 
                            id="joinCode"
                            type="text"
                            placeholder="Enter invite code (e.g. BET123)"
                            value={joinCode}
                            onChange={(event) => {
                            setJoinCode(event.target.value);
                            setError("");
                            setSelectedBet(null);
                            }}
                        />
                    </div>

                    <button className="join-button" type="submit">
                        Find Bet →
                    </button>
                </form>

                {error && (
                    <p className="join-error">{error}</p>
                )}
            </div>

            {selectedBet && (
                <div className="join-card bet-preview">
                    <div className="bet-preview-header">
                        <h2>Bet Found</h2>
                        <span className="bet-status">
                            {getBetDisplayStatus(selectedBet)}
                        </span>
                    </div>

                    <h3>{selectedBet.title}</h3>

                    <div className="bet-preview-info">
                        <span>
                            Participants: {selectedBet.participants} /{" "}
                            {selectedBet.maxParticipants}
                        </span>
                        <span>{selectedBet.visibility}</span>
                    </div>

                    <button
                        className="join-button"
                        type="button"
                        onClick={handleViewDetails}
                    >
                        View Bet Details →
                    </button>
                </div>
            )}
        </div>
    );
}