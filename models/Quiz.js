const db = require("../db");
const pool = require("../db/pool");

class Quiz {
  // Find quiz by ID
  static async findById(quizId) {
    try {
      const [rows] = await db.query("SELECT * FROM quizzes WHERE quiz_id = ?", [
        quizId,
      ]);
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding quiz by ID:", error);
      throw error;
    }
  }

  // Get all quizzes for a module
  static async findByModule(moduleId) {
    try {
      const [rows] = await db.query(
        `SELECT q.*, 
                    (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.quiz_id) as question_count,
                    (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.quiz_id) as attempt_count
                FROM quizzes q 
                WHERE module_id = ? 
                ORDER BY created_at DESC`,
        [moduleId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding quizzes by module:", error);
      throw error;
    }
  }

  // Create a new quiz
  static async create(quizData) {
    try {
      const [result] = await db.query(
        `INSERT INTO quizzes 
                (module_id, title, description, time_limit, allowed_attempts, 
                shuffle_questions, shuffle_answers, start_date, end_date, 
                published, created_by, points_possible, passing_score,
                show_question_points, allow_question_feedback, 
                grade_release_option, show_correct_answers) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quizData.module_id,
          quizData.title,
          quizData.description || null,
          quizData.time_limit || null,
          quizData.allowed_attempts || 1,
          quizData.shuffle_questions || false,
          quizData.shuffle_answers || false,
          quizData.start_date || null,
          quizData.end_date || null,
          quizData.published || false,
          quizData.created_by,
          quizData.points_possible || 0,
          quizData.passing_score || null,
          quizData.show_question_points !== undefined
            ? quizData.show_question_points
            : true,
          quizData.allow_question_feedback !== undefined
            ? quizData.allow_question_feedback
            : true,
          quizData.grade_release_option || "immediate",
          quizData.show_correct_answers !== undefined
            ? quizData.show_correct_answers
            : true,
        ],
      );

      return result.insertId;
    } catch (error) {
      console.error("Error creating quiz:", error);
      throw error;
    }
  }

  // Update quiz
  static async update(quizId, quizData) {
    try {
      const [result] = await db.query(
        `UPDATE quizzes SET 
                title = ?,
                description = ?,
                time_limit = ?,
                allowed_attempts = ?,
                shuffle_questions = ?,
                shuffle_answers = ?,
                start_date = ?,
                end_date = ?,
                published = ?,
                points_possible = ?,
                passing_score = ?,
                show_question_points = ?,
                allow_question_feedback = ?,
                grade_release_option = ?,
                show_correct_answers = ?,
                updated_at = NOW()
                WHERE quiz_id = ?`,
        [
          quizData.title,
          quizData.description || null,
          quizData.time_limit || null,
          quizData.allowed_attempts || 1,
          quizData.shuffle_questions || false,
          quizData.shuffle_answers || false,
          quizData.start_date || null,
          quizData.end_date || null,
          quizData.published || false,
          quizData.points_possible || 0,
          quizData.passing_score || null,
          quizData.show_question_points !== undefined
            ? quizData.show_question_points
            : true,
          quizData.allow_question_feedback !== undefined
            ? quizData.allow_question_feedback
            : true,
          quizData.grade_release_option || "immediate",
          quizData.show_correct_answers !== undefined
            ? quizData.show_correct_answers
            : true,
          quizId,
        ],
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating quiz:", error);
      throw error;
    }
  }

  // Delete quiz
  static async delete(quizId) {
    try {
      const [result] = await db.query("DELETE FROM quizzes WHERE quiz_id = ?", [
        quizId,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting quiz:", error);
      throw error;
    }
  }

  // Get quiz with questions and options
  static async getWithQuestions(quizId, includeCorrectAnswers = false) {
    try {
      // Get quiz details
      const [quizRows] = await db.query(
        `SELECT q.*, m.title as module_title, c.course_id, c.title as course_title
                FROM quizzes q
                JOIN modules m ON q.module_id = m.module_id
                JOIN courses c ON m.course_id = c.course_id
                WHERE q.quiz_id = ?`,
        [quizId],
      );

      if (!quizRows.length) {
        return null;
      }

      const quiz = quizRows[0];

      // Get questions
      const [questionRows] = await db.query(
        `SELECT * FROM quiz_questions 
                WHERE quiz_id = ? 
                ORDER BY position, question_id`,
        [quizId],
      );

      // Get options for each question
      const questions = [];
      for (const question of questionRows) {
        const [optionRows] = await db.query(
          `SELECT * FROM question_options 
                    WHERE question_id = ? 
                    ORDER BY position`,
          [question.question_id],
        );

        // Filter out correct answer information if not requested
        const options = optionRows.map((option) => {
          if (!includeCorrectAnswers) {
            const { is_correct, ...rest } = option;
            return rest;
          }
          return option;
        });

        questions.push({
          ...question,
          options,
        });
      }

      return {
        ...quiz,
        questions,
      };
    } catch (error) {
      console.error("Error getting quiz with questions:", error);
      throw error;
    }
  }

  // Add question to quiz
  static async addQuestion(questionData) {
    try {
      console.log(
        "Adding question with data:",
        JSON.stringify(questionData, null, 2),
      );

      // Validate question data
      if (!questionData.quiz_id) {
        throw new Error("Missing quiz_id in question data");
      }

      if (!questionData.type) {
        throw new Error("Missing question type");
      }

      if (!questionData.question_text) {
        throw new Error("Missing question text");
      }

      // Get the highest position value for this quiz
      const [positionResult] = await db.query(
        "SELECT MAX(position) as max_pos FROM quiz_questions WHERE quiz_id = ?",
        [questionData.quiz_id],
      );

      const position =
        positionResult[0].max_pos !== null ? positionResult[0].max_pos + 1 : 1;

      console.log(`Adding question at position ${position}`);

      // Insert the question
      const [questionResult] = await db.query(
        "INSERT INTO quiz_questions (quiz_id, type, question_text, points, position) VALUES (?, ?, ?, ?, ?)",
        [
          questionData.quiz_id,
          questionData.type,
          questionData.question_text,
          questionData.points || 1,
          position,
        ],
      );

      const questionId = questionResult.insertId;
      console.log(`Question inserted with ID ${questionId}`);

      // Add options if they exist
      if (questionData.options && questionData.options.length > 0) {
        console.log(`Adding ${questionData.options.length} options`);

        // For matching questions, ensure matching_id and side are set
        if (questionData.type === "matching") {
          // Check that options have the required matching properties
          for (const option of questionData.options) {
            if (option.matching_id === undefined || !option.side) {
              console.error("Invalid matching option:", option);
              throw new Error(
                "Matching options must have matching_id and side properties",
              );
            }

            // Ensure matching_id is a number
            if (typeof option.matching_id !== "number") {
              option.matching_id = parseInt(option.matching_id, 10);
              if (isNaN(option.matching_id)) {
                console.error("Invalid matching_id:", option.matching_id);
                throw new Error("matching_id must be a valid number");
              }
            }

            // Ensure side is either 'left' or 'right'
            if (option.side !== "left" && option.side !== "right") {
              console.error("Invalid side value:", option.side);
              throw new Error("side must be either 'left' or 'right'");
            }
          }

          // Create matching option query with parameters for matching questions
          for (const option of questionData.options) {
            await db.query(
              "INSERT INTO question_options (question_id, option_text, is_correct, matching_id, side) VALUES (?, ?, ?, ?, ?)",
              [
                questionId,
                option.option_text,
                option.is_correct ? 1 : 0,
                option.matching_id,
                option.side,
              ],
            );
          }
        } else {
          // For other question types, use the standard option query
          for (const option of questionData.options) {
            await db.query(
              "INSERT INTO question_options (question_id, option_text, is_correct) VALUES (?, ?, ?)",
              [questionId, option.option_text, option.is_correct ? 1 : 0],
            );
          }
        }

        console.log("Options added successfully");
      }

      return questionId;
    } catch (error) {
      console.error("Error in Quiz.addQuestion:", error);
      throw error;
    }
  }

  // Add options to a question
  static async addQuestionOptions(questionId, options) {
    try {
      // Start a transaction
      await db.query("START TRANSACTION");
      console.log("Started transaction for adding options");

      if (!Array.isArray(options)) {
        console.error("Options is not an array:", options);
        throw new Error("Options must be an array");
      }

      console.log(
        `Adding ${options.length} options for question ${questionId}`,
      );

      // Get the question type to handle type-specific logic
      const [questionRows] = await db.query(
        "SELECT type FROM quiz_questions WHERE question_id = ?",
        [questionId],
      );

      if (questionRows.length === 0) {
        throw new Error(`Question with ID ${questionId} not found`);
      }

      const questionType = questionRows[0].type;
      console.log(`Question type for ID ${questionId}: ${questionType}`);

      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        console.log(
          `Adding option ${i + 1}/${options.length}:`,
          JSON.stringify(option),
        );

        if (!option.option_text) {
          console.error("Missing option_text in option:", option);
          throw new Error(`Option at index ${i} is missing option_text`);
        }

        // Set default values for different question types
        let isCorrect = option.is_correct || false;
        let matchingId = null;
        let side = null;

        // Handle type-specific settings
        if (questionType === "short_answer") {
          // All short answer options are considered correct
          isCorrect = true;
        } else if (questionType === "true_false") {
          // True/False has predefined structure
          isCorrect =
            option.option_text.toLowerCase() === "true"
              ? option.is_correct
              : !option.is_correct;
        } else if (questionType === "matching") {
          // Extract matching properties
          matchingId =
            option.matching_id !== undefined ? option.matching_id : null;
          side = option.side || null;
          isCorrect = true; // Matching pairs are all correct
        }

        console.log(
          `Option values: isCorrect=${isCorrect}, matchingId=${matchingId}, side=${side}`,
        );

        // Insert the option
        await db.query(
          `INSERT INTO question_options 
                    (question_id, option_text, is_correct, position, matching_id, side) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
          [questionId, option.option_text, isCorrect, i, matchingId, side],
        );
      }

      // Commit transaction
      await db.query("COMMIT");
      console.log("Transaction committed successfully");

      return true;
    } catch (error) {
      // Rollback on error
      await db.query("ROLLBACK");
      console.error("Error adding question options - ROLLED BACK:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw error;
    }
  }

  // Update question
  static async updateQuestion(questionId, questionData) {
    try {
      // Start a transaction
      await db.query("START TRANSACTION");

      // Update question
      await db.query(
        `UPDATE quiz_questions SET
                type = ?,
                question_text = ?,
                points = ?
                WHERE question_id = ?`,
        [
          questionData.type,
          questionData.question_text,
          questionData.points || 1,
          questionId,
        ],
      );

      // If options are provided, delete existing options and add new ones
      if (questionData.options) {
        // Delete existing options
        await db.query("DELETE FROM question_options WHERE question_id = ?", [
          questionId,
        ]);

        // Add options based on question type
        if (questionData.type === "matching") {
          // For matching questions, handle the matching_id and side
          for (const option of questionData.options) {
            await db.query(
              "INSERT INTO question_options (question_id, option_text, is_correct, matching_id, side) VALUES (?, ?, ?, ?, ?)",
              [
                questionId,
                option.option_text,
                option.is_correct ? 1 : 0,
                option.matching_id,
                option.side,
              ],
            );
          }
        } else {
          // For other question types
          for (const option of questionData.options) {
            await db.query(
              "INSERT INTO question_options (question_id, option_text, is_correct) VALUES (?, ?, ?)",
              [questionId, option.option_text, option.is_correct ? 1 : 0],
            );
          }
        }
      }

      // Commit transaction
      await db.query("COMMIT");

      return true;
    } catch (error) {
      // Rollback on error
      await db.query("ROLLBACK");
      console.error("Error updating question:", error);
      throw error;
    }
  }

  // Delete question
  static async deleteQuestion(questionId) {
    try {
      const [result] = await db.query(
        "DELETE FROM quiz_questions WHERE question_id = ?",
        [questionId],
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting question:", error);
      throw error;
    }
  }

  // Start a quiz attempt
  static async startAttempt(quizId, studentId) {
    try {
      // Check if there are any existing attempts
      const [attemptsCount] = await db.query(
        "SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
        [quizId, studentId],
      );

      // Check if the student has reached the maximum number of attempts
      const [quizInfo] = await db.query(
        "SELECT allowed_attempts FROM quizzes WHERE quiz_id = ?",
        [quizId],
      );

      if (attemptsCount[0].count >= quizInfo[0].allowed_attempts) {
        throw new Error("Maximum number of attempts reached");
      }

      // Create a new attempt
      const [result] = await db.query(
        `INSERT INTO quiz_attempts 
                (quiz_id, student_id, start_time) 
                VALUES (?, ?, NOW())`,
        [quizId, studentId],
      );

      return result.insertId;
    } catch (error) {
      console.error("Error starting quiz attempt:", error);
      throw error;
    }
  }

  // Submit quiz attempt
  static async submitAttempt(quizId, studentId, answers) {
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Create quiz attempt
        const [attemptResult] = await connection.query(
          "INSERT INTO quiz_attempts (quiz_id, student_id, start_time, end_time) VALUES (?, ?, NOW(), NOW())",
          [quizId, studentId],
        );
        const attemptId = attemptResult.insertId;

        // Get quiz questions and correct answers
        const [questions] = await connection.query(
          `SELECT q.*, qo.option_id, qo.option_text, qo.is_correct, qo.side, qo.correct_match_id
                     FROM quiz_questions q
                     LEFT JOIN question_options qo ON q.question_id = qo.question_id
                     WHERE q.quiz_id = ?`,
          [quizId],
        );

        // Process each answer
        for (const [questionId, answer] of Object.entries(answers)) {
          const question = questions.find(
            (q) => q.question_id === parseInt(questionId),
          );
          if (!question) continue;

          let isCorrect = false;
          let selectedOptions = null;

          switch (question.question_type) {
            case "multiple_choice":
            case "true_false":
              selectedOptions = answer;
              const correctOption = questions.find(
                (q) =>
                  q.question_id === parseInt(questionId) && q.is_correct === 1,
              );
              isCorrect =
                correctOption && selectedOptions === correctOption.option_id;
              break;

            case "matching":
              selectedOptions = JSON.stringify(answer);
              const matchingItems = questions.filter(
                (q) =>
                  q.question_id === parseInt(questionId) && q.side === "left",
              );
              const matchingAnswers = questions.filter(
                (q) =>
                  q.question_id === parseInt(questionId) && q.side === "right",
              );

              isCorrect = matchingAnswers.every((match, idx) => {
                const userMatch = answer[idx];
                return userMatch === match.correct_match_id;
              });
              break;

            case "short_answer":
              selectedOptions = answer;
              isCorrect =
                answer.toLowerCase().trim() ===
                question.correct_answer.toLowerCase().trim();
              break;

            case "essay":
              selectedOptions = answer;
              // Essay questions are not auto-graded
              isCorrect = null;
              break;
          }

          // Save the answer
          await connection.query(
            `INSERT INTO quiz_answers 
                         (attempt_id, question_id, selected_options, is_correct) 
                         VALUES (?, ?, ?, ?)`,
            [attemptId, questionId, selectedOptions, isCorrect],
          );
        }

        // Calculate total score
        const [answers] = await connection.query(
          "SELECT is_correct FROM quiz_answers WHERE attempt_id = ?",
          [attemptId],
        );

        const totalQuestions = questions.filter(
          (q) => q.question_type !== "essay",
        ).length;
        const correctAnswers = answers.filter((a) => a.is_correct === 1).length;
        const score =
          totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

        // Update attempt with score
        await connection.query(
          "UPDATE quiz_attempts SET score = ? WHERE attempt_id = ?",
          [score, attemptId],
        );

        await connection.commit();
        return { attemptId, score };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error submitting quiz attempt:", error);
      throw error;
    }
  }

  // Get student attempts for a quiz
  static async getStudentAttempts(quizId, studentId) {
    try {
      const [attempts] = await db.query(
        `SELECT qa.*, 
                    (SELECT COUNT(*) FROM quiz_answers WHERE attempt_id = qa.attempt_id) as questions_answered
                FROM quiz_attempts qa
                WHERE qa.quiz_id = ? AND qa.student_id = ?
                ORDER BY qa.created_at DESC`,
        [quizId, studentId],
      );

      return attempts;
    } catch (error) {
      console.error("Error getting student quiz attempts:", error);
      throw error;
    }
  }

  // Get all quizzes for a course (across all modules)
  static async findByCourse(courseId) {
    try {
      const [rows] = await db.query(
        `SELECT q.*, m.title as module_title
                FROM quizzes q
                JOIN modules m ON q.module_id = m.module_id
                WHERE m.course_id = ?
                ORDER BY m.position, q.created_at`,
        [courseId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding quizzes by course:", error);
      throw error;
    }
  }

  // Get quiz statistics
  static async getStatistics(quizId) {
    try {
      const [stats] = await db.query(
        `SELECT 
                    COUNT(DISTINCT qa.attempt_id) as total_attempts,
                    COUNT(DISTINCT qa.student_id) as unique_students,
                    AVG(qa.score) as average_score,
                    MIN(qa.score) as lowest_score,
                    MAX(qa.score) as highest_score,
                    COUNT(CASE WHEN qa.score >= q.passing_score THEN 1 END) as passing_students
                FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.quiz_id
                WHERE q.quiz_id = ? AND qa.status = 'graded'`,
        [quizId],
      );

      return stats[0];
    } catch (error) {
      console.error("Error getting quiz statistics:", error);
      throw error;
    }
  }
}

module.exports = Quiz;
