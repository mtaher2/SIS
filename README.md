# Student Information System

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)

A comprehensive Student Information System built with Node.js, Python, and MySQL, designed to streamline student operations and improve university management.

## Prerequisites

Before you begin, ensure you have the following installed:

### Core Requirements
- [Git](https://git-scm.com/) (Latest version)
- [Node.js](https://nodejs.org/) (LTS version)
- [MySQL](https://www.mysql.com/) (Latest version)
- [Python](https://www.python.org/) (Latest version)

### Python Dependencies
```bash
pip install numpy pandas scikit-learn flask flask-cors gunicorn joblib python-dotenv mysql-connector-python langchain langchain-community langchain-core langchain-openai langchain-groq
```

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/mtaher2/SIS.git
cd SIS
```

### 2. Install Node.js Dependencies
```bash
npm install
```

## Configuration

### Database Setup
1. Create a `config.env` file in the project root:
```bash
touch config.env
```

2. Add your configuration details:
```env
# Server Configuration
PORT=your_port
NODE_ENV=development

# Database Configuration
DB_HOST=your_mysql_host
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name

# API Keys
GROQ_API_KEY_NEW=your_api_key

# File Upload Configuration
UPLOAD_PATH=public/storage

# Email Configuration
EMAIL_HOST=your_email
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_google_passKey
EMAIL_FROM=your_email
```

## Running the Application

The application consists of multiple services that need to be running simultaneously. Open four separate terminal windows:

### Terminal 1 - Main Chatbot Server
```bash
python chatbot/chatbot.py
```
Available at: http://localhost:5002

### Terminal 2 - Student Chatbot Server
```bash
python chatbot/chatbotStudent.py
```
Available at: http://localhost:5005

### Terminal 3 - Spam Detection Service
```bash
cd SpamDetection
python run.py
```
Available at: http://localhost:5000

### Terminal 4 - Main Application Server
```bash
npm start
```
Available at: http://localhost:3000

### Expected Output
When all services are running successfully, you should see:
```bash
Server running on port 3000
http://localhost:3000
Initializing spam detection service...
Spam detector service initialized
Spam detection service initialized successfully
Spam detection service ready: true
✅ Main chatbot service is running
✅ Student chatbot service is running
```

## Contributors

- Mohamed Medhat
- Aly Mohamed
- Tony Nazieh

---

<div align="center">
  <sub>Built with ❤️ by the SIS Team</sub>
</div>


