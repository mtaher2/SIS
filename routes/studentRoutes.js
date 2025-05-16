const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { isAuthenticated } = require("../middleware/auth");
const { upload } = require("../utils/upload");

// Quiz routes
router.get(
  "/quiz/:quizId/start",
  isAuthenticated,
  studentController.startQuizAttempt,
);
router.post(
  "/quiz/attempt/:attemptId/question/:questionId/answer",
  isAuthenticated,
  studentController.saveAnswer,
);
router.post(
  "/quiz/attempt/:attemptId/submit",
  isAuthenticated,
  studentController.submitQuizAttempt,
);
router.get(
  "/quiz/:quizId/attempt/:attemptId/results",
  isAuthenticated,
  studentController.showQuizResults,
);

// Update the assignment submission route to handle file uploads
router.post(
  "/assignments/:assignmentId/submit",
  isAuthenticated,
  upload.single("submissionFile"),
  studentController.submitAssignment,
);

module.exports = router;
