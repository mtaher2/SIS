from flask import Flask, request, jsonify
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
import mysql.connector
import os
from flask_cors import CORS
import json
import datetime
import re
from dotenv import load_dotenv

# Load environment variables from config.env
load_dotenv('config.env')

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

# Database Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'port': int(os.getenv('DB_PORT', 3306))
}

# Set up your API key for the Groq LLM
os.environ["GROQ_API_KEY"] = os.getenv('GROQ_API_KEY_NEW')

def get_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except mysql.connector.Error as err:
        print(f"Error connecting to database: {err}")
        return None

def get_database_schema():
    """Get the database schema to help the LLM understand the structure"""
    schema = {
        "tables": {
            "users": {
                "columns": ["user_id", "username", "email", "first_name", "last_name", "role_id"],
                "description": "Contains user information for all users (students, instructors, admins)"
            },
            "courses": {
                "columns": ["course_id", "course_code", "title", "description", "credit_hours", "semester_id"],
                "description": "Contains course information"
            },
            "enrollments": {
                "columns": ["enrollment_id", "student_id", "course_id", "enrollment_date", "status", "final_grade"],
                "description": "Tracks student course enrollments and grades"
            },
            "course_instructors": {
                "columns": ["assignment_id", "course_id", "instructor_id"],
                "description": "Maps instructors to courses they teach"
            },
            "instructor_profiles": {
                "columns": ["profile_id", "user_id", "department", "office_location", "office_hours"],
                "description": "Contains instructor-specific information"
            },
            "student_profiles": {
                "columns": ["profile_id", "user_id", "student_id", "date_of_birth", "enrollment_date"],
                "description": "Contains student-specific information"
            },
            "grades": {
                "columns": ["grade_id", "student_id", "course_id", "points_earned", "total_score"],
                "description": "Contains student grades for courses"
            }
        }
    }
    return json.dumps(schema)

def get_role_specific_prompt(role_id, user_id=None):
    """Get role-specific system prompt for the LLM"""
    base_prompt = """You are an expert SQL query generator for an academic database. 
    Your task is to convert natural language questions into valid MySQL queries.
    Always return ONLY the SQL query without any additional text or explanation.
    The query should be optimized and follow MySQL best practices.
    
    Use the following schema to understand the database structure:
    """ + get_database_schema()

    if role_id == 1:  # Admin
        return base_prompt + """
        As an admin, you have full access to all data. You can:
        - Query any student information
        - Access all course data
        - View instructor assignments
        - Generate departmental statistics
        - Access all grades and academic records
        """
    elif role_id == 2:  # Instructor
        return base_prompt + f"""
        As an instructor, you can only access:
        - Students enrolled in your courses (use course_instructors table to filter)
        - Course information for courses you teach
        - Grades and performance data for your courses only
        
        Always include this filter in your queries:
        AND course_id IN (SELECT course_id FROM course_instructors WHERE instructor_id = {user_id})
        """
    elif role_id == 3:  # Student
        return base_prompt + f"""
        As a student, you can only access:
        - Your own information (use student_id from student_profiles)
        - Courses you are enrolled in
        - Your own grades and academic records
        
        Always include this filter in your queries:
        AND student_id = (SELECT student_id FROM student_profiles WHERE user_id = {user_id})
        """
    else:
        return base_prompt

def serialize_date(obj):
    """Convert date objects to string format"""
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def execute_sql_query(query):
    """Execute SQL query and return results"""
    connection = get_db_connection()
    if not connection:
        return {"error": "Database connection failed"}
    
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        
        # Convert results to JSON-serializable format
        serialized_results = []
        for row in results:
            serialized_row = {}
            for key, value in row.items():
                if isinstance(value, (datetime.date, datetime.datetime)):
                    serialized_row[key] = value.isoformat()
                else:
                    serialized_row[key] = value
            serialized_results.append(serialized_row)
            
        return {"results": serialized_results}
    except mysql.connector.Error as err:
        return {"error": f"Database error: {err}"}

def get_current_courses(user_id):
    """Get current courses for a student"""
    try:
        connection = get_db_connection()
        if not connection:
            return {"error": "Database connection failed"}
        
        cursor = connection.cursor(dictionary=True)
        
        # Get current semester
        cursor.execute("""
            SELECT semester_id 
            FROM semesters 
            WHERE start_date <= CURDATE() 
            AND end_date >= CURDATE() 
            LIMIT 1
        """)
        current_semester = cursor.fetchone()
        
        if not current_semester:
            return {"error": "No active semester found"}
        
        # Get current courses
        query = """
            SELECT 
                c.course_id,
                c.course_code,
                c.title,
                c.description,
                c.credit_hours,
                CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
                ip.office_location,
                ip.office_hours
            FROM enrollments e
            JOIN courses c ON e.course_id = c.course_id
            LEFT JOIN course_instructors ci ON c.course_id = ci.course_id
            LEFT JOIN users u ON ci.instructor_id = u.user_id
            LEFT JOIN instructor_profiles ip ON u.user_id = ip.user_id
            WHERE e.student_id = %s
            AND c.semester_id = %s
            AND e.status = 'active'
            ORDER BY c.course_code
        """
        
        cursor.execute(query, (user_id, current_semester['semester_id']))
        courses = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return {"results": courses}
    except mysql.connector.Error as err:
        return {"error": f"Database error: {err}"}

def format_course_response(courses):
    """Format course information into a readable response"""
    if not courses:
        return "You are not currently enrolled in any courses for this semester."
    
    response = f"You are currently enrolled in {len(courses)} courses:\n\n"
    
    for course in courses:
        response += f"📚 {course['course_code']} - {course['title']}\n"
        response += f"   Credit Hours: {course['credit_hours']}\n"
        if course['instructor_name']:
            response += f"   Instructor: {course['instructor_name']}\n"
            if course['office_location']:
                response += f"   Office: {course['office_location']}\n"
            if course['office_hours']:
                response += f"   Office Hours: {course['office_hours']}\n"
        if course['description']:
            response += f"   Description: {course['description']}\n"
        response += "\n"
    
    return response

def get_student_courses_by_identifier(identifier):
    """Get all courses for a student by email, username, student ID, or name"""
    try:
        connection = get_db_connection()
        if not connection:
            return {"error": "Database connection failed"}
        cursor = connection.cursor(dictionary=True)
        # Try to find the user by email, username, student_id, or name
        user = None
        # Email
        if re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', identifier):
            cursor.execute("SELECT user_id, first_name, last_name FROM users WHERE email = %s", (identifier,))
            user = cursor.fetchone()
        # Student ID
        elif re.match(r'^STU[0-9]+$', identifier, re.IGNORECASE):
            cursor.execute("SELECT u.user_id, u.first_name, u.last_name FROM users u JOIN student_profiles sp ON u.user_id = sp.user_id WHERE sp.student_id = %s", (identifier,))
            user = cursor.fetchone()
        # Username
        elif re.match(r'^[a-zA-Z0-9._-]+$', identifier):
            cursor.execute("SELECT user_id, first_name, last_name FROM users WHERE username = %s", (identifier,))
            user = cursor.fetchone()
        # Name (first last or last first, partial match)
        else:
            name_parts = identifier.strip().split()
            if len(name_parts) >= 2:
                first, last = name_parts[0], name_parts[1]
                cursor.execute("SELECT user_id, first_name, last_name FROM users WHERE (first_name LIKE %s AND last_name LIKE %s) OR (first_name LIKE %s AND last_name LIKE %s)", (f'%{first}%', f'%{last}%', f'%{last}%', f'%{first}%'))
                user = cursor.fetchone()
        if not user:
            cursor.close()
            connection.close()
            return {"error": f"No user found with identifier '{identifier}'"}
        user_id = user['user_id']
        # Get all courses (any semester, any status)
        query = """
            SELECT 
                c.course_id,
                c.course_code,
                c.title,
                c.description,
                c.credit_hours,
                CONCAT(u2.first_name, ' ', u2.last_name) as instructor_name,
                ip.office_location,
                ip.office_hours,
                e.status as enrollment_status,
                e.enrollment_date,
                s.semester_name
            FROM enrollments e
            JOIN courses c ON e.course_id = c.course_id
            LEFT JOIN course_instructors ci ON c.course_id = ci.course_id
            LEFT JOIN users u2 ON ci.instructor_id = u2.user_id
            LEFT JOIN instructor_profiles ip ON u2.user_id = ip.user_id
            LEFT JOIN semesters s ON c.semester_id = s.semester_id
            WHERE e.student_id = %s
            ORDER BY c.semester_id DESC, c.course_code
        """
        cursor.execute(query, (user_id,))
        courses = cursor.fetchall()
        cursor.close()
        connection.close()
        return {"results": courses, "student_name": f"{user['first_name']} {user['last_name']}"}
    except mysql.connector.Error as err:
        return {"error": f"Database error: {err}"}

def format_student_courses_response(courses, student_name=None):
    """Format student course information into a readable response"""
    if not courses:
        return f"No courses found for this student."
    response = f"Courses for {student_name or 'the student'} (all semesters):\n\n"
    for course in courses:
        response += f"📚 {course['course_code']} - {course['title']} ({course['semester_name']})\n"
        response += f"   Status: {course['enrollment_status'].title()}\n"
        response += f"   Credit Hours: {course['credit_hours']}\n"
        if course['instructor_name']:
            response += f"   Instructor: {course['instructor_name']}\n"
            if course['office_location']:
                response += f"   Office: {course['office_location']}\n"
            if course['office_hours']:
                response += f"   Office Hours: {course['office_hours']}\n"
        if course['description']:
            response += f"   Description: {course['description']}\n"
        # Robust date formatting
        enrollment_date = course.get('enrollment_date')
        if enrollment_date:
            try:
                if isinstance(enrollment_date, (datetime.date, datetime.datetime)):
                    formatted_date = enrollment_date.strftime('%Y-%m-%d')
                else:
                    formatted_date = str(enrollment_date)
                response += f"   Enrollment Date: {formatted_date}\n"
            except Exception as e:
                print(f"Error formatting enrollment_date: {e}")
        response += "\n"
    return response

def get_chatbot_response(question, llm, role_id, user_id=None):
    # Check if this is a student courses query by identifier (email, username, student id, or name)
    identifier = None
    # Try to extract email
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    email_match = re.search(email_pattern, question)
    if email_match:
        identifier = email_match.group()
    else:
        # Try to extract student id (e.g., STU12345)
        student_id_match = re.search(r'STU[0-9]+', question, re.IGNORECASE)
        if student_id_match:
            identifier = student_id_match.group()
        else:
            # Try to extract username (single word after 'for' or 'of' or 'user')
            username_match = re.search(r'(?:for|of|user)\s+([a-zA-Z0-9._-]+)', question)
            if username_match:
                identifier = username_match.group(1)
            else:
                # Try to extract name (words after 'for' or 'of')
                name_match = re.search(r'(?:for|of)\s+([a-zA-Z]+\s+[a-zA-Z]+)', question)
                if name_match:
                    identifier = name_match.group(1)
    if identifier and any(phrase in question.lower() for phrase in ['courses', 'enrolled', 'taking', 'registered']):
        if role_id != 1:  # Not an admin
            return {"error": "Only administrators can view other students' courses"}
        courses_result = get_student_courses_by_identifier(identifier)
        if "error" in courses_result:
            return {"error": courses_result["error"]}
        formatted_response = format_student_courses_response(courses_result["results"], courses_result.get("student_name"))
        return {
            "answer": formatted_response,
            "raw_results": courses_result["results"]
        }
    
    # Check if this is a current courses query
    if any(phrase in question.lower() for phrase in ['current courses', 'courses i take', 'my courses', 'enrolled courses']):
        if role_id != 3:  # Not a student
            return {"error": "Only students can view their current courses"}
        
        courses_result = get_current_courses(user_id)
        if "error" in courses_result:
            return {"error": courses_result["error"]}
        
        formatted_response = format_course_response(courses_result["results"])
        return {
            "answer": formatted_response,
            "raw_results": courses_result["results"]
        }
    
    # Get role-specific system prompt
    system_prompt = get_role_specific_prompt(role_id, user_id)
    
    # Create the user prompt
    user_prompt = f"""
    Convert this question into a MySQL query:
    {question}
    
    Return ONLY the SQL query without any additional text.
    """

    # Create the list of messages
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    # Call the LLM to get the SQL query
    sql_query = llm.predict_messages(messages).content.strip()
    
    # Execute the query
    query_result = execute_sql_query(sql_query)
    
    if "error" in query_result:
        return {"error": query_result["error"]}
    
    # Format the results into a natural language response
    results = query_result["results"]
    
    # Create a response prompt based on role
    response_prompt = f"""
    Convert these database results into a natural language response:
    Question: {question}
    Results: {json.dumps(results)}
    
    Provide a clear, concise answer that directly addresses the question.
    If there are no results, say so politely.
    
    Format the response based on the user's role:
    """
    
    if role_id == 1:  # Admin
        response_prompt += """
        - Include relevant statistics and summaries
        - Highlight any concerning patterns or trends
        - Provide actionable insights when applicable
        """
    elif role_id == 2:  # Instructor
        response_prompt += """
        - Focus on student performance and engagement
        - Include course-specific statistics
        - Highlight areas needing attention
        """
    elif role_id == 3:  # Student
        response_prompt += """
        - Focus on personal academic progress
        - Include relevant deadlines and requirements
        - Provide actionable suggestions for improvement
        """
    
    response_messages = [
        SystemMessage(content="You are a helpful academic database assistant."),
        HumanMessage(content=response_prompt)
    ]
    
    natural_response = llm.predict_messages(response_messages).content
    
    return {
        "answer": natural_response,
        "sql_query": sql_query,
        "raw_results": results
    }

# Initialize the LLM
llm = ChatGroq(
    groq_api_key=os.environ["GROQ_API_KEY"],
    temperature=0.0,
    model="llama3-70b-8192"
)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        question = data.get('question')
        role_id = data.get('role_id')
        user_id = data.get('user_id')
        
        if not question:
            return jsonify({"error": "No question provided"}), 400
        if not role_id:
            return jsonify({"error": "No role ID provided"}), 400
        if role_id in [2, 3] and not user_id:  # Instructor or Student role requires user_id
            return jsonify({"error": "User ID required for this role"}), 400

        response = get_chatbot_response(question, llm, role_id, user_id)
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/student-info', methods=['POST'])
def get_student_info():
    try:
        data = request.json
        student_id = data.get('student_id')
        if not student_id:
            return jsonify({"error": "No student ID provided"}), 400

        # Create SQL query to get student information including enrolled courses
        query = """
        SELECT 
            u.user_id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            sp.student_id,
            sp.date_of_birth,
            sp.address,
            sp.phone,
            sp.enrollment_date,
            sp.current_semester,
            GROUP_CONCAT(
                CONCAT(
                    c.course_code, ' - ',
                    c.title, ' (',
                    CASE e.status
                        WHEN 'active' THEN 'Currently Enrolled'
                        WHEN 'completed' THEN 'Completed'
                        WHEN 'dropped' THEN 'Dropped'
                    END,
                    ')'
                )
            ) as enrolled_courses
        FROM users u
        JOIN student_profiles sp ON u.user_id = sp.user_id
        LEFT JOIN enrollments e ON u.user_id = e.student_id
        LEFT JOIN courses c ON e.course_id = c.course_id
        WHERE sp.student_id = %s
        GROUP BY u.user_id, sp.student_id
        """

        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (student_id,))
        result = cursor.fetchone()
        cursor.close()
        connection.close()

        if not result:
            return jsonify({"error": "Student not found"}), 404

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)