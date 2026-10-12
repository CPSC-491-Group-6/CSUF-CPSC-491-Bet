
import { useState } from "react";
import { Link } from "react-router-dom";
import "./CreateBet.css";

function CreateBet() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
  });

  const [errors, setErrors] = useState({});

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
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Bet title is required.";
    } else if (formData.title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters.";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required.";
    }

    if (!formData.deadline) {
      newErrors.deadline = "Deadline is required.";
    } else if (new Date(formData.deadline).getTime() <= Date.now()) {
      newErrors.deadline = "Deadline must be in the future.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Backend API integration will be added next.
    // Do not treat validation as successful bet creation.
    console.log("Form validated. API integration pending.");
  };

  return (
    <div className="create-bet-page">
      <div className="create-bet-header">
        <h1>Create a New Bet</h1>
        <p>Set up a friendly challenge with other users.</p>
      </div>

      <form className="create-bet-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="title">Bet Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter a title for your bet"
            maxLength={100}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title && (
            <p id="title-error" className="form-error">
              {errors.title}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe the challenge and conditions"
            rows={5}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "description-error" : undefined
            }
          />
          {errors.description && (
            <p id="description-error" className="form-error">
              {errors.description}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="deadline">Bet Deadline</label>
          <input
            type="datetime-local"
            id="deadline"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            aria-invalid={Boolean(errors.deadline)}
            aria-describedby={errors.deadline ? "deadline-error" : undefined}
          />
          {errors.deadline && (
            <p id="deadline-error" className="form-error">
              {errors.deadline}
            </p>
          )}
        </div>

        <div className="form-actions">
          <Link to="/" className="cancel-button">
            Cancel
          </Link>

          <button type="submit" className="submit-bet-button">
            Validate Bet
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateBet;
