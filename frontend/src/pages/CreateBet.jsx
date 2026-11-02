
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { createBet } from "../services/betService";
import "./CreateBet.css";

function CreateBet() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    visibility: "private",
    max_participants: 2,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdBet, setCreatedBet] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        name === "max_participants"
          ? Number(value)
          : value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));

    setSubmitError("");
  };

  const validateForm = () => {
    const newErrors = {};
    const title = formData.title.trim();
    const description = formData.description.trim();

    if (!title) {
      newErrors.title = "Bet title is required.";
    } else if (title.length > 150) {
      newErrors.title =
        "Title cannot exceed 150 characters.";
    }

    if (description.length > 2000) {
      newErrors.description =
        "Description cannot exceed 2000 characters.";
    }

    if (
      !["public", "private"].includes(
        formData.visibility,
      )
    ) {
      newErrors.visibility =
        "Please select a valid visibility option.";
    }

    if (
      !Number.isInteger(formData.max_participants) ||
      formData.max_participants < 2 ||
      formData.max_participants > 100
    ) {
      newErrors.max_participants =
        "Maximum participants must be between 2 and 100.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || !validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const userId = user?.userID ?? user?.id;

      const result = await createBet(userId, formData);

      setCreatedBet(result.bet ?? result);
      setCopyStatus("");
    } catch (error) {
      setSubmitError(
        error.message || "Unable to create bet.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Invite code copied!");
    } catch {
      setCopyStatus(
        "Unable to copy code. Please copy it manually.",
      );
    }
  };

  if (createdBet) {
    const rawCode =
      createdBet.join_code ??
      createdBet.invite_code ??
      createdBet.inviteCode ??
      "";

    const joinCode =
      typeof rawCode === "string"
        ? rawCode.trim()
        : "";

    const visibility = String(
      createdBet.visibility ??
        formData.visibility,
    ).toLowerCase();

    return (
      <div className="create-bet-page">
        <div className="create-bet-form">
          <h1>Bet Created Successfully!</h1>

          <p>
            Your bet "{createdBet.title}" has been
            created.
          </p>

          <h2>Bet Visibility</h2>

          <p>
            <strong>
              {visibility === "public"
                ? "Public Bet"
                : "Private Bet"}
            </strong>
          </p>

          <p className="form-help">
            {visibility === "public"
              ? "Other users can discover and join this bet directly when public joining is supported. You can also share its invite code."
              : "Only users with a valid invite code should be allowed to join this private bet."}
          </p>

          <h2>Invite Code</h2>

          <p>
            Share this code with other users so
            they can join your bet.
          </p>

          {joinCode ? (
            <div className="join-code-display">
              <strong>{joinCode}</strong>

              <button
                type="button"
                onClick={() =>
                  handleCopyCode(joinCode)
                }
              >
                Copy Code
              </button>
            </div>
          ) : (
            <p className="form-help" role="status">
              Invite code not available yet.
            </p>
          )}

          {copyStatus && (
            <p role="status">{copyStatus}</p>
          )}

          {createdBet.id && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/bets/${encodeURIComponent(createdBet.id)}`,
                  { state: { bet: createdBet } },
                )
              }
            >
              View Bet Details
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-bet-page">
      <div className="create-bet-header">
        <h1>Create a New Bet</h1>

        <p>
          Set up a friendly challenge with
          other users.
        </p>

        <p>
          Create a bet using your account.
          Participant limit defaults to two.
        </p>
      </div>

      <form
        className="create-bet-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="form-group">
          <label htmlFor="title">
            Bet Title
          </label>

          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter a title for your bet"
            maxLength={150}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={
              errors.title
                ? "title-error"
                : undefined
            }
          />

          {errors.title && (
            <p
              id="title-error"
              className="form-error"
              role="alert"
            >
              {errors.title}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">
            Description
          </label>

          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe the challenge and conditions"
            rows={5}
            maxLength={2000}
            aria-invalid={Boolean(
              errors.description,
            )}
            aria-describedby={
              errors.description
                ? "description-error"
                : undefined
            }
          />

          {errors.description && (
            <p
              id="description-error"
              className="form-error"
              role="alert"
            >
              {errors.description}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="visibility">
            Bet Visibility
          </label>

          <select
            id="visibility"
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(
              errors.visibility,
            )}
            aria-describedby={
              errors.visibility
                ? "visibility-error"
                : "visibility-help"
            }
          >
            <option value="private">
              Private – Invite Only
            </option>

            <option value="public">
              Public – Anyone Can Join
            </option>
          </select>

          <p
            id="visibility-help"
            className="form-help"
          >
            {formData.visibility === "private"
              ? "Private: Your bet will not appear in public listings. Other users must have a valid invite code to join."
              : "Public: Your bet can appear in public listings. Users can join directly or by entering an invite code."}
          </p>

          {errors.visibility && (
            <p
              id="visibility-error"
              className="form-error"
              role="alert"
            >
              {errors.visibility}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="max_participants">
            Maximum Participants
          </label>

          <input
            type="number"
            id="max_participants"
            name="max_participants"
            min="2"
            max="100"
            step="1"
            value={formData.max_participants}
            onChange={handleChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(
              errors.max_participants,
            )}
            aria-describedby={
              errors.max_participants
                ? "max-participants-error"
                : undefined
            }
          />

          {errors.max_participants && (
            <p
              id="max-participants-error"
              className="form-error"
              role="alert"
            >
              {errors.max_participants}
            </p>
          )}
        </div>

        {submitError && (
          <p
            className="form-error"
            role="alert"
          >
            {submitError}
          </p>
        )}

        <div className="form-actions">
          <Link
            to="/"
            className="cancel-button"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="submit-bet-button"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Creating Bet..."
              : "Create Bet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateBet;
