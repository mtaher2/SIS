document.addEventListener('DOMContentLoaded', function() {
    // Add course button functionality
    const addCourseBtn = document.getElementById('addCourse');
    const courseInputs = document.getElementById('courseInputs');
    const resetFormBtn = document.getElementById('resetForm');
    const calculateGPABtn = document.getElementById('calculateGPA');
    const calculateGoalGPABtn = document.getElementById('calculateGoalGPA');
    
    // Add course event
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', function() {
            const courseCount = document.querySelectorAll('.course-input').length;
            const newRow = document.createElement('div');
            newRow.className = 'row mb-3 course-input';
            newRow.innerHTML = `
                <div class="col-md-5">
                    <div class="form-group">
                        <label>Course Name</label>
                        <input type="text" class="form-control course-name" placeholder="Course Name">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="form-group">
                        <label>Credits</label>
                        <input type="number" class="form-control credit-hours" min="1" max="5" value="3">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="form-group">
                        <label>Expected Grade</label>
                        <select class="form-control expected-grade">
                            <option value="4.0">A / A+</option>
                            <option value="3.7">A-</option>
                            <option value="3.3">B+</option>
                            <option value="3.0">B</option>
                            <option value="2.7">B-</option>
                            <option value="2.3">C+</option>
                            <option value="2.0">C</option>
                            <option value="1.7">C-</option>
                            <option value="1.3">D+</option>
                            <option value="1.0">D</option>
                            <option value="0.0">F</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-1">
                    <div class="form-group">
                        <label>&nbsp;</label>
                        <button type="button" class="btn btn-danger form-control remove-course">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            courseInputs.appendChild(newRow);
            
            // Add remove event listener to the new row
            newRow.querySelector('.remove-course').addEventListener('click', function() {
                newRow.remove();
            });
        });
    }
    
    // Reset form
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', function() {
            document.getElementById('currentGPA').value = '0';
            document.getElementById('totalCreditHours').value = '0';
            
            // Remove all added courses (keep only the original ones that are readonly)
            const courseInputs = document.querySelectorAll('.course-input');
            courseInputs.forEach(input => {
                if (!input.querySelector('input[readonly]')) {
                    input.remove();
                } else {
                    // Reset selects for readonly courses
                    const gradeSelect = input.querySelector('.expected-grade');
                    if (gradeSelect) gradeSelect.value = '4.0';
                }
            });
            
            // Hide results
            document.getElementById('gpaResults').style.display = 'none';
            document.getElementById('gpaError').style.display = 'none';
        });
    }
    
    // Calculate GPA
    if (calculateGPABtn) {
        calculateGPABtn.addEventListener('click', function() {
            const currentGPA = parseFloat(document.getElementById('currentGPA').value);
            const totalCreditHours = parseFloat(document.getElementById('totalCreditHours').value);
            const errorElement = document.getElementById('gpaError');
            const resultsElement = document.getElementById('gpaResults');
            const resultsBody = document.getElementById('gpaResultsBody');
            
            // Validate inputs
            if (isNaN(currentGPA) || currentGPA < 0 || currentGPA > 4) {
                errorElement.textContent = 'Current GPA must be between 0 and 4.';
                errorElement.style.display = 'block';
                resultsElement.style.display = 'none';
                return;
            }
            
            if (isNaN(totalCreditHours) || totalCreditHours < 0 || totalCreditHours > 999) {
                errorElement.textContent = 'Total credit hours must be between 0 and 999.';
                errorElement.style.display = 'block';
                resultsElement.style.display = 'none';
                return;
            }
            
            // Get all course inputs
            const courseInputs = document.querySelectorAll('.course-input');
            let totalSemesterPoints = 0;
            let totalSemesterHours = 0;
            
            for (const course of courseInputs) {
                const creditHours = parseFloat(course.querySelector('.credit-hours').value);
                const gradeValue = parseFloat(course.querySelector('.expected-grade').value);
                
                if (isNaN(creditHours) || creditHours <= 0 || creditHours > 5) {
                    errorElement.textContent = 'Credit hours must be between 1 and 5 for each course.';
                    errorElement.style.display = 'block';
                    resultsElement.style.display = 'none';
                    return;
                }
                
                totalSemesterPoints += gradeValue * creditHours;
                totalSemesterHours += creditHours;
            }
            
            // Calculate GPAs
            const semesterGPA = totalSemesterHours > 0 ? totalSemesterPoints / totalSemesterHours : 0;
            const totalPoints = (currentGPA * totalCreditHours) + totalSemesterPoints;
            const totalHours = totalCreditHours + totalSemesterHours;
            const cumulativeGPA = totalHours > 0 ? totalPoints / totalHours : 0;
            
            // Display results
            errorElement.style.display = 'none';
            resultsElement.style.display = 'block';
            resultsBody.innerHTML = `
                <tr>
                    <td>${semesterGPA.toFixed(3)}</td>
                    <td>${totalSemesterHours}</td>
                    <td>${cumulativeGPA.toFixed(3)}</td>
                    <td>${totalHours}</td>
                </tr>
            `;
        });
    }
    
    // Calculate Goal GPA
    if (calculateGoalGPABtn) {
        calculateGoalGPABtn.addEventListener('click', function() {
            const currentGPA = parseFloat(document.getElementById('goalCurrentGPA').value);
            const totalCreditHours = parseFloat(document.getElementById('goalTotalHours').value);
            const targetGPA = parseFloat(document.getElementById('targetGPA').value);
            const plannedCreditHours = parseFloat(document.getElementById('plannedCreditHours').value);
            
            const errorElement = document.getElementById('goalGpaError');
            const resultElement = document.getElementById('goalGpaResult');
            
            // Validate inputs
            if (isNaN(currentGPA) || currentGPA < 0 || currentGPA > 4) {
                errorElement.textContent = 'Current GPA must be between 0 and 4.';
                errorElement.style.display = 'block';
                resultElement.style.display = 'none';
                return;
            }
            
            if (isNaN(totalCreditHours) || totalCreditHours < 0 || totalCreditHours > 999) {
                errorElement.textContent = 'Total credit hours must be between 0 and 999.';
                errorElement.style.display = 'block';
                resultElement.style.display = 'none';
                return;
            }
            
            if (isNaN(targetGPA) || targetGPA < 0 || targetGPA > 4) {
                errorElement.textContent = 'Target GPA must be between 0 and 4.';
                errorElement.style.display = 'block';
                resultElement.style.display = 'none';
                return;
            }
            
            if (isNaN(plannedCreditHours) || plannedCreditHours <= 0 || plannedCreditHours > 999) {
                errorElement.textContent = 'Planned credit hours must be between 1 and 999.';
                errorElement.style.display = 'block';
                resultElement.style.display = 'none';
                return;
            }
            
            // Calculate required GPA for this semester
            const currentPoints = currentGPA * totalCreditHours;
            const targetPoints = targetGPA * (totalCreditHours + plannedCreditHours);
            const requiredPoints = targetPoints - currentPoints;
            const requiredGPA = requiredPoints / plannedCreditHours;
            
            errorElement.style.display = 'none';
            resultElement.style.display = 'block';
            
            if (requiredGPA <= 4.0 && requiredGPA >= 0) {
                resultElement.textContent = `You need a GPA of ${requiredGPA.toFixed(3)} this semester to achieve your target GPA of ${targetGPA.toFixed(3)}.`;
                resultElement.className = 'alert alert-success mt-3';
            } else {
                resultElement.textContent = `Unfortunately, you would need a GPA of ${requiredGPA.toFixed(3)} to meet your goal of ${targetGPA.toFixed(3)}, which is not possible while taking ${plannedCreditHours} credits this semester.`;
                resultElement.className = 'alert alert-warning mt-3';
            }
        });
    }
});