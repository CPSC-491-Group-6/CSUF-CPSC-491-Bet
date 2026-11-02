import { useState } from "react";
import "./InviteCode.css";

export default function InviteCode({ inviteCode }) {
  const [copied, setCopied] = useState(false);

  const code =
    typeof inviteCode === "string" ? inviteCode.trim() : "";

  async function handleCopy() {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="invite-code-section">
      <h3>Invite Friends</h3>

      <p>
        Share this invite code with someone to let them
        join your bet.
      </p>

      {code ? (
        <div className="invite-code-container">
          <span className="invite-code-value">
            {code}
          </span>

          <button
            type="button"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy Code"}
          </button>
        </div>
      ) : (
        <p className="invite-code-unavailable">
          Invite code not available yet.
        </p>
      )}
    </section>
  );
}