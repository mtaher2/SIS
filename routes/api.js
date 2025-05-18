const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload } = require('../utils/upload');
const { isAuthenticated, isInstructor } = require('../utils/auth');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// Apply authentication to all API routes
router.use(isAuthenticated);

// File upload API for Quill editor
router.post('/upload', isInstructor, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Ensure the file is an image or allowed type
        const allowedFileTypes = [
            // Images
            '.jpg', '.jpeg', '.png', '.gif', '.webp', 
            // Documents
            '.pdf', '.doc', '.docx', 
            // Presentations
            '.ppt', '.pptx', 
            // Spreadsheets
            '.xls', '.xlsx',
            // Other formats
            '.txt', '.csv', '.zip'
        ];
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (!allowedFileTypes.includes(ext)) {
            // Delete the file if it's not allowed
            if (req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(400).json({
                success: false,
                message: 'File type not allowed'
            });
        }

        // Get the relative URL path for the file
        let location = req.file.path.replace(/^.*[\\\/]public/, '');
        
        // Convert backslashes to forward slashes for URLs
        location = location.replace(/\\/g, '/');
        
        // Determine if this is a file that should be embedded or linked
        const isEmbeddableImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        
        // Return the file location and additional metadata
        return res.status(200).json({
            success: true,
            location: location,
            fileName: req.file.originalname,
            fileType: ext.substring(1), // Remove the dot
            isEmbeddableImage: isEmbeddableImage
        });
    } catch (error) {
        console.error('Error in file upload:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Direct base64 image upload API for Quill editor
router.post('/upload-base64', isInstructor, (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'No image data provided'
            });
        }

        // Extract the base64 data and file type
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(400).json({
                success: false,
                message: 'Invalid base64 format'
            });
        }

        // Check if it's an allowed file type
        const mimeType = matches[1];
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedMimeTypes.includes(mimeType)) {
            return res.status(400).json({
                success: false,
                message: 'File type not allowed'
            });
        }

        // Generate a unique filename
        const ext = mimeType.split('/')[1];
        const filename = `upload_${Date.now()}.${ext}`;
        
        // Create directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Save the file
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        
        // Return the URL path
        return res.status(200).json({
            success: true,
            location: `/uploads/${filename}`
        });
    } catch (error) {
        console.error('Error in base64 image upload:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get unread announcements count
router.get('/unread-announcements', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Get the last time the user checked announcements
        const lastViewedTime = req.query.lastViewedTime || 0;
        const userId = req.session.user.user_id;
        const userRole = req.session.user.role;
        
        // Find announcements visible to this user and created after the last viewed time
        const filters = {
            created_after: new Date(parseInt(lastViewedTime)),
            is_active: true
        };
        
        let announcements;
        if (userRole === 'admin') {
            // Admin sees all announcements
            announcements = await Announcement.findAll(filters);
        } else if (userRole === 'instructor') {
            // Instructor sees general and instructor-targeted announcements
            announcements = await Announcement.getVisibleAnnouncements(userId, 'instructor', filters);
        } else if (userRole === 'student') {
            // Student sees general and student-targeted announcements
            announcements = await Announcement.getVisibleAnnouncements(userId, 'student', filters);
        } else {
            announcements = [];
        }
        
        return res.json({ count: announcements.length, success: true });
    } catch (error) {
        console.error('Error getting unread announcements:', error);
        return res.status(500).json({ error: 'Internal server error', success: false });
    }
});

module.exports = router; 