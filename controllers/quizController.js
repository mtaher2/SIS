// Submit quiz attempt
exports.submitQuizAttempt = async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        const studentId = req.session.user.user_id;

        // Get quiz attempt details
        const [attempt] = await db.query(
            `SELECT qa.*, q.quiz_id, q.module_id, m.course_id
             FROM quiz_attempts qa
             JOIN quizzes q ON qa.quiz_id = q.quiz_id
             JOIN modules m ON q.module_id = m.module_id
             WHERE qa.attempt_id = ? AND qa.student_id = ?`,
            [attemptId, studentId]
        );

        if (!attempt || attempt.length === 0) {
            req.flash('error_msg', 'Quiz attempt not found');
            return res.redirect('/student/quizzes');
        }

        // Call stored procedure to grade the quiz
        await db.query('CALL grade_quiz_attempt(?, ?)', [attemptId, null]);

        // Automatically calculate and update student grades
        await Instructor.calculateStudentGrades(studentId, attempt[0].course_id);

        req.flash('success_msg', 'Quiz submitted successfully');
        res.redirect('/student/quizzes');
    } catch (error) {
        console.error('Error submitting quiz:', error);
        req.flash('error_msg', 'An error occurred while submitting the quiz');
        res.redirect('/student/quizzes');
    }
}; 