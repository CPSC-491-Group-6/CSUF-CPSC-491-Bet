
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  createBet,
  isDemoMode,
} from "../services/betService";
import "./CreateBet.css";

function CreateBet() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
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
      newErrors.title = "Title cannot exceed 150 characters.";
    } else if (isDemoMode && title.length < 3) {
      newErrors.title = "Title must be at least 3 characters.";
    }

    if (isDemoMode && !description) {
      newErrors.description = "Description is required.";
    } else if (description.length > 2000) {
      newErrors.description =
        "Description cannot exceed 2000 characters.";
    }

    if (isDemoMode) {
      if (!formData.deadline) {
        newErrors.deadline = "Deadline is required.";
      } else {
        const deadlineTime = new Date(
          formData.deadline
        ).getTime();

        if (
          !Number.isFinite(deadlineTime) ||
          deadlineTime <= Date.now()
        ) {
          newErrors.deadline =
            "Deadline must be a valid future date.";
        }
      }
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

      await createBet(userId, formData);

      navigate("/");
    } catch (error) {
      setSubmitError(
        error.message || "Unable to create bet."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-bet-page">
      <div className="create-bet-header">
        <h1>Create a New Bet</h1>

        <p>Set up a friendly challenge with other users.</p>

        {isDemoMode ? (
          <p>
            Demo Mode: Bets are saved in this browser.
            They are not saved to the backend database.
          </p>
        ) : (
          <p>
            Create a bet using your account.
            Participant limit defaults to two.
          </p>
        )}
      </div>

      <form
        className="create-bet-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="form-group">
          <label htmlFor="title">Bet Title</label>

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
              errors.title ? "title-error" : undefined
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
            aria-invalid={Boolean(errors.description)}
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

        {isDemoMode && (
          <div className="form-group">
            <label htmlFor="deadline">
              Bet Deadline
            </label>

            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              aria-invalid={Boolean(errors.deadline)}
              aria-describedby={
                errors.deadline
                  ? "deadline-error"
                  : undefined
              }
            />

            {errors.deadline && (
              <p
                id="deadline-error"
                className="form-error"
                role="alert"
              >
                {errors.deadline}
              </p>
            )}
          </div>
        )}

        {submitError && (
          <p className="form-error" role="alert">
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
