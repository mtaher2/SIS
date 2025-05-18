document.addEventListener("DOMContentLoaded", function () {
  const submissionForm = document.getElementById("submissionForm");
  const fileInput = document.getElementById("submissionFile");
  const submitButton = document.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById("error-message");
  const successDiv = document.getElementById("success-message");

  if (submissionForm) {
    submissionForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Reset messages
      errorDiv.textContent = "";
      successDiv.textContent = "";

      // Disable submit button
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';

      try {
        const formData = new FormData(submissionForm);

        const response = await fetch(submissionForm.action, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit assignment");
        }

        // Show success message
        successDiv.textContent =
          data.message || "Assignment submitted successfully!";

        // Update the UI to show submission details instead of reloading
        const submissionSection = document.querySelector(".card-body");
        if (submissionSection && data.submission) {
          // Create submission details HTML
          const submissionHTML = createSubmissionDetailsHTML(data.submission);
          submissionSection.innerHTML = submissionHTML;
        } else {
          // If we can't update the UI directly, reload the page
          window.location.reload();
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        submitButton.disabled = false;
        submitButton.textContent = "Submit Assignment";
      }
    });
  }

  // Helper function to create submission details HTML
  function createSubmissionDetailsHTML(submission) {
    const submittedDate = new Date(submission.submitted_at).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    let fileHTML = "";
    if (submission.file_url) {
      let iconClass = "fas fa-file";
      if (submission.file_type === "pdf")
        iconClass = "fas fa-file-pdf text-danger";
      else if (["doc", "docx"].includes(submission.file_type))
        iconClass = "fas fa-file-word text-primary";
      else if (["ppt", "pptx"].includes(submission.file_type))
        iconClass = "fas fa-file-powerpoint text-warning";

      fileHTML = `
                <div class="submission-details">
                    <div class="alert alert-success mb-4">
                        <i class="fas fa-check-circle me-2"></i>
                        You have submitted this assignment on ${submittedDate}
                    </div>
                    <div class="mb-4">
                        <h6 class="fw-bold mb-2">Your Submission</h6>
                        <div class="p-3 bg-light rounded">
                            <a href="${submission.file_url}" class="d-flex align-items-center text-decoration-none" target="_blank">
                                <i class="${iconClass} fa-2x me-3"></i>
                                <div>
                                    <div class="fw-bold">${submission.file_name}</div>
                                    <small class="text-muted">Click to view your submission</small>
                                </div>
                            </a>
                        </div>
                        <div class="submission-meta">
                            <div class="d-flex flex-wrap gap-3 text-muted small">
                                <div>
                                    <i class="fas fa-clock me-1"></i>
                                    Submitted: ${submittedDate}
                                </div>
                                <div>
                                    <i class="fas fa-file-alt me-1"></i>
                                    File type: ${submission.file_type.toUpperCase()}
                                </div>
                                <div>
                                    <i class="fas fa-download me-1"></i>
                                    <a href="${submission.file_url}" class="text-decoration-none" download>Download</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
    }

    return fileHTML;
  }

  // File input validation
  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          errorDiv.textContent = "File size exceeds 10MB limit";
          fileInput.value = "";
          return;
        }

        // Clear any previous error messages
        errorDiv.textContent = "";
      }
    });
  }
});
