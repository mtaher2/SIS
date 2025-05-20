from flask import Flask, request, jsonify
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage
import os
import re
import warnings
import logging
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv('config.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress all deprecation warnings
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', category=UserWarning)

app = Flask(__name__)
CORS(app)

# Set up your API key for the Groq LLM
os.environ["GROQ_API_KEY"] = os.getenv('GROQ_API_KEY_NEW')

def ensure_data_directory():
    """Ensure the data directory exists"""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        logger.info(f"Created data directory at {data_dir}")
    return data_dir

# Load and process documents
def load_documents():
    try:
        data_dir = ensure_data_directory()
        logger.info(f"Loading documents from {data_dir}")
        
        # Load all PDF files from the data directory
        loader = DirectoryLoader(data_dir, glob="**/*.pdf", loader_cls=PyPDFLoader)
        documents = loader.load()
        
        if not documents:
            logger.warning("No documents found in the specified directory")
            return []
            
        logger.info(f"Successfully loaded {len(documents)} documents")
        return documents
    except Exception as e:
        logger.error(f"Error loading documents: {str(e)}")
        return []

# Create the vector store
def create_vector_store(_documents):
    try:
        if not _documents:
            logger.error("No documents provided to create vector store")
            return None
            
        logger.info("Creating vector store...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
        texts = text_splitter.split_documents(_documents)
        
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vector_store = Chroma.from_documents(texts, embeddings, persist_directory="./chroma_db")
        vector_store.persist()
        logger.info("Vector store created and persisted successfully")
        return vector_store
    except Exception as e:
        logger.error(f"Error creating vector store: {str(e)}")
        return None

# Load the vector store from disk
def load_vector_store():
    try:
        logger.info("Loading vector store from disk...")
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vector_store = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)
        logger.info("Vector store loaded successfully")
        return vector_store
    except Exception as e:
        logger.error(f"Error loading vector store: {str(e)}")
        return None

def get_chatbot_response(question, retriever, llm):
    try:
        logger.info(f"Processing question: {question}")
        
        # Retrieve documents
        docs = retriever.get_relevant_documents(question)
        logger.info(f"Retrieved {len(docs)} relevant documents")

        # Construct context
        context = ""
        for doc in docs:
            context += f"{doc.page_content}\n\n"

        # Create the system prompt
        system_prompt = """You are an expert academic assistant specializing in computer science, mathematics, and programming. 
        You have access to the following textbooks:
        - Database Systems Fundamentals (7th Edition)
        - Computer Organization and Architecture (10th Edition) by William Stallings
        - Essential Calculus: Early Transcendentals
        - Data Structures & Algorithms in Dart
        - Dart Apprentice: Beyond the Basics
        - Dart Apprentice: Fundamentals

        Your responses should be:
        1. Clear and concise
        2. Based on the provided context
        3. Include specific references in APA format
        4. Highlight key technical terms
        5. Include code examples when relevant
        6. Explain complex concepts in simple terms"""

        # Create the user prompt
        user_prompt = f"""
Use the following context to answer the question below. Provide a comprehensive and accurate answer. 
Include specific references in APA format at the end of your response, including the book/source name, chapter number, and page number.

Question: {question}

Context:
{context}

Answer:
"""

        # Create the list of messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        # Call the LLM
        logger.info("Generating response from LLM...")
        response = llm.predict_messages(messages)
        answer = response.content

        # Highlight key terms in the answer
        key_terms = [
            # Programming terms
            'algorithm', 'function', 'variable', 'loop', 'array', 'matrix', 'class', 'object',
            'method', 'interface', 'inheritance', 'polymorphism', 'encapsulation',
            # Database terms
            'database', 'query', 'table', 'index', 'transaction', 'ACID', 'normalization',
            # Computer Architecture terms
            'CPU', 'memory', 'cache', 'bus', 'register', 'instruction', 'pipeline',
            # Mathematics terms
            'derivative', 'integral', 'theorem', 'proof', 'equation', 'function',
            # Dart-specific terms
            'dart', 'flutter', 'widget', 'async', 'await', 'stream', 'future'
        ]
        
        for term in key_terms:
            pattern = re.compile(fr'\b({term})\b', re.IGNORECASE)
            replacement = r'<mark>\1</mark>'
            answer = pattern.sub(replacement, answer)

        logger.info("Response generated successfully")
        return answer
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return "I apologize, but I encountered an error while processing your question. Please try again."

# Initialize the chatbot components
try:
    logger.info("Initializing chatbot components...")
    
    if os.path.exists("./chroma_db"):
        logger.info("Found existing vector store, loading...")
        vector_store = load_vector_store()
    else:
        logger.info("No existing vector store found, creating new one...")
        documents = load_documents()
        vector_store = create_vector_store(documents)

    if vector_store is None:
        raise ValueError("Failed to initialize vector store")

    retriever = vector_store.as_retriever(search_kwargs={"k": 3})
    llm = ChatGroq(
        groq_api_key=os.environ["GROQ_API_KEY"],
        temperature=0.0,
        model="llama3-70b-8192",
    )
    logger.info("Chatbot components initialized successfully")
except Exception as e:
    logger.error(f"Error initializing chatbot components: {str(e)}")
    raise

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        question = data.get('question')
        if not question:
            logger.warning("No question provided in request")
            return jsonify({"error": "No question provided"}), 400

        logger.info(f"Received question: {question}")
        answer = get_chatbot_response(question, retriever, llm)
        return jsonify({"answer": answer})
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({"error": "An error occurred while processing your request"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    logger.info("Starting chatbot server...")
    app.run(host='0.0.0.0', port=5005)