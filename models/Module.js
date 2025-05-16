const db = require("../db");

class Module {
  // Find module by ID
  static async findById(moduleId) {
    try {
      // Get a fresh connection if needed
      const connection = await db.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM modules WHERE module_id = ?",
        [moduleId],
      );
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error("Error finding module by ID:", error);

      // If connection error, try once more after a short delay
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry findById...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          const connection = await db.getConnection();
          const [rows] = await connection.query(
            "SELECT * FROM modules WHERE module_id = ?",
            [moduleId],
          );
          return rows.length ? rows[0] : null;
        } catch (retryError) {
          console.error("Error on retry finding module by ID:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Get all modules for a course
  static async findByCourse(courseId) {
    try {
      const connection = await db.getConnection();
      const [rows] = await connection.query(
        "SELECT * FROM modules WHERE course_id = ? ORDER BY position",
        [courseId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding modules by course:", error);

      // If connection error, try once more after a short delay
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry findByCourse...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          const connection = await db.getConnection();
          const [rows] = await connection.query(
            "SELECT * FROM modules WHERE course_id = ? ORDER BY position",
            [courseId],
          );
          return rows;
        } catch (retryError) {
          console.error(
            "Error on retry finding modules by course:",
            retryError,
          );
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Create a new module
  static async create(moduleData) {
    try {
      const connection = await db.getConnection();

      // Get the highest position value for this course
      const [positionResult] = await connection.query(
        "SELECT MAX(position) as maxPosition FROM modules WHERE course_id = ?",
        [moduleData.course_id],
      );

      const position =
        positionResult[0].maxPosition !== null
          ? positionResult[0].maxPosition + 1
          : 0;

      const [result] = await connection.query(
        `INSERT INTO modules 
                (course_id, title, description, position, published) 
                VALUES (?, ?, ?, ?, ?)`,
        [
          moduleData.course_id,
          moduleData.title,
          moduleData.description || null,
          position,
          moduleData.published || false,
        ],
      );

      return result.insertId;
    } catch (error) {
      console.error("Error creating module:", error);

      // Handle connection errors with retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry create...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the whole operation
          return await Module.create(moduleData);
        } catch (retryError) {
          console.error("Error on retry creating module:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Update module
  static async update(moduleId, moduleData) {
    try {
      const connection = await db.getConnection();
      const [result] = await connection.query(
        `UPDATE modules SET
                title = ?,
                description = ?,
                published = ?
                WHERE module_id = ?`,
        [
          moduleData.title,
          moduleData.description || null,
          moduleData.published !== undefined ? moduleData.published : false,
          moduleId,
        ],
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating module:", error);

      // Handle connection errors with retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry update...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the whole operation
          return await Module.update(moduleId, moduleData);
        } catch (retryError) {
          console.error("Error on retry updating module:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Delete module
  static async delete(moduleId) {
    try {
      const connection = await db.getConnection();
      const [result] = await connection.query(
        "DELETE FROM modules WHERE module_id = ?",
        [moduleId],
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting module:", error);

      // Handle connection errors with retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry delete...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the whole operation
          return await Module.delete(moduleId);
        } catch (retryError) {
          console.error("Error on retry deleting module:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Update module positions
  static async updatePositions(positionUpdates) {
    try {
      const connection = await db.getConnection();

      // Start a transaction
      await connection.query("START TRANSACTION");

      // Update each module's position
      for (const update of positionUpdates) {
        await connection.query(
          "UPDATE modules SET position = ? WHERE module_id = ?",
          [update.position, update.module_id],
        );
      }

      // Commit transaction
      await connection.query("COMMIT");

      return true;
    } catch (error) {
      // Rollback on error
      try {
        const connection = await db.getConnection();
        await connection.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }

      console.error("Error updating module positions:", error);

      // Handle connection errors with retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry updatePositions...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the whole operation
          return await Module.updatePositions(positionUpdates);
        } catch (retryError) {
          console.error(
            "Error on retry updating module positions:",
            retryError,
          );
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Get module contents (pages, quizzes, assignments)
  static async getContents(moduleId) {
    try {
      const connection = await db.getConnection();

      // Get pages
      const [pages] = await connection.query(
        `SELECT page_id, title, created_at, updated_at, published
                FROM pages WHERE module_id = ? ORDER BY created_at`,
        [moduleId],
      );

      // Get quizzes
      const [quizzes] = await connection.query(
        `SELECT quiz_id, title, points_possible, start_date, end_date, published
                FROM quizzes WHERE module_id = ? ORDER BY created_at`,
        [moduleId],
      );

      // Get assignments
      const [assignments] = await connection.query(
        `SELECT assignment_id, title, points_possible, due_date, published
                FROM enhanced_assignments WHERE module_id = ? ORDER BY created_at`,
        [moduleId],
      );

      return {
        pages,
        quizzes,
        assignments,
      };
    } catch (error) {
      console.error("Error getting module contents:", error);

      // Handle connection errors with retry
      if (
        error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        try {
          console.log("Attempting to reconnect and retry getContents...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

          // Retry the whole operation
          return await Module.getContents(moduleId);
        } catch (retryError) {
          console.error("Error on retry getting module contents:", retryError);
          throw retryError;
        }
      }

      throw error;
    }
  }
}

module.exports = Module;
