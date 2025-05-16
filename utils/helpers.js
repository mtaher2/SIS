/**
 * Helper utility functions for the application
 */

// Format date to user-friendly string
const formatDate = (date) => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return new Date(date).toLocaleDateString("en-US", options);
};

// Format date to short format (MM/DD/YYYY)
const formatShortDate = (date) => {
  return new Date(date).toLocaleDateString("en-US");
};

// Calculate GPA from an array of grades
const calculateGPA = (grades) => {
  if (!grades || grades.length === 0) {
    return 0.0;
  }

  const gradePoints = {
    "A+": 4.0,
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D-": 0.7,
    F: 0.0,
  };

  let totalPoints = 0;
  let totalCredits = 0;

  grades.forEach((grade) => {
    const points = gradePoints[grade.letter_grade] || 0;
    const credits = grade.credit_hours || 0;

    totalPoints += points * credits;
    totalCredits += credits;
  });

  return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0.0;
};

// Convert numerical grade to letter grade
const getLetterGrade = (score) => {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
};

// Paginate results
const paginate = (items, page = 1, perPage = 10) => {
  const offset = (page - 1) * perPage;
  const totalPages = Math.ceil(items.length / perPage);
  const paginatedItems = items.slice(offset, offset + perPage);

  return {
    page,
    perPage,
    prePage: page - 1 ? page - 1 : null,
    nextPage: totalPages > page ? page + 1 : null,
    total: items.length,
    totalPages,
    data: paginatedItems,
  };
};

// Truncate text with ellipsis
const truncateText = (text, length = 100) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

module.exports = {
  formatDate,
  formatShortDate,
  calculateGPA,
  getLetterGrade,
  paginate,
  truncateText,
};
