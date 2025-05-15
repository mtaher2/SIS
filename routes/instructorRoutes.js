// Grade Management Routes
router.get('/courses/:courseId/grades', instructorController.getCourseGrades);
router.post('/courses/:courseId/weights', instructorController.updateGradeWeights);
router.post('/courses/:courseId/grades/:studentId', instructorController.updateStudentGrades); 