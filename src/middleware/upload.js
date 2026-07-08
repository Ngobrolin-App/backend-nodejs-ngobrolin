const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const prefix = req.user?.userId || 'unknown';
        cb(null, `${prefix}_${Date.now()}${ext}`);
    }
});

// Multer storage for message attachments
const messageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'messages');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const prefix = req.user?.userId || 'unknown';
        cb(null, `${prefix}_${Date.now()}${ext}`);
    }
});

// Multer storage for avatar uploads
const groupImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', 'group-images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const prefix = req.user?.userId || 'unknown';
        cb(null, `${prefix}_${Date.now()}${ext}`);
    }
});

const uploadAvatar = multer({ storage: avatarStorage });
const uploadMessage = multer({ storage: messageStorage });
const uploadGroupImage = multer({ storage: groupImageStorage });

module.exports = {
    uploadAvatar,
    uploadMessage,
    uploadGroupImage
};