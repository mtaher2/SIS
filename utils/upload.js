const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Set up multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Determine appropriate directory based on the file type or route
        let uploadDir;
        
        if (file.fieldname === 'profile_image') {
            uploadDir = path.join(__dirname, '../public/storage/profile_images');
        } else {
            uploadDir = path.join(__dirname, '../public/storage');
        }
        
        createUploadDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with original extension
        const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueFilename);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    // Define allowed file types
    const allowedFileTypes = [
        // Documents
        '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt',
        // Images
        '.jpg', '.jpeg', '.png', '.gif',
        // Videos
        '.mp4', '.webm', '.avi',
        // Archives
        '.zip', '.rar'
    ];
    
    // Check if the file extension is allowed
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedFileTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Delete a file
const deleteFile = (filePath) => {
    const fullPath = path.join(__dirname, '../public', filePath);
    
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
    }
    return false;
};

module.exports = {
    upload,
    deleteFile
}; 