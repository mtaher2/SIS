const db = require("../db");

async function migrateTables() {
  try {
    console.log(
      "Starting migration to add phone column to instructor_profiles table...",
    );

    // Check if the column already exists
    const [columns] = await db.query(
      "SHOW COLUMNS FROM instructor_profiles LIKE ?",
      ["phone"],
    );

    if (columns.length === 0) {
      console.log("Column does not exist, adding phone column...");

      // Add the phone column
      await db.query(
        "ALTER TABLE instructor_profiles ADD COLUMN phone VARCHAR(20) NULL AFTER office_hours",
      );

      console.log(
        "Migration successful: Added phone column to instructor_profiles table",
      );
    } else {
      console.log("Column already exists, no changes needed");
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

// Run the migration
migrateTables()
  .then(() => {
    console.log("Migration script completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error running migration script:", err);
    process.exit(1);
  });
