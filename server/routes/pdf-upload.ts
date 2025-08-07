import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// Use a simple auth check for now
const simpleAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  // Simple token validation - in production use proper JWT validation
  req.user = { user_id: 'user123' };
  next();
};
import { createReadStream, promises as fsPromises } from 'fs';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads/templates');
      
      // Create upload directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const userId = (req as any).user?.user_id || 'anonymous';
      const filename = `template_${userId}_${timestamp}.pdf`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload PDF template
router.post('/upload', simpleAuth, upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file uploaded'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      userId: (req as any).user?.user_id
    };

    console.log('📄 [PDF UPLOAD] File uploaded:', fileInfo);

    // Return file info and access URL
    res.json({
      success: true,
      file: fileInfo,
      accessUrl: `/api/pdf-upload/serve/${req.file.filename}`
    });

  } catch (error) {
    console.error('❌ [PDF UPLOAD] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload PDF'
    });
  }
});

// Serve uploaded PDFs
router.get('/serve/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads/templates', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'PDF file not found'
      });
    }

    // Get file stats
    const stats = await fsPromises.stat(filePath);
    
    console.log('📄 [PDF SERVE] Serving uploaded PDF:', filename);

    // Set appropriate headers for PDF viewing
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': stats.size.toString(),
      'Content-Disposition': 'inline; filename="' + filename + '"',
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the file
    const stream = createReadStream(filePath);
    stream.pipe(res);

  } catch (error) {
    console.error('❌ [PDF SERVE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve PDF'
    });
  }
});

// List uploaded templates for user
router.get('/list', simpleAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.user_id;
    const uploadsDir = path.join(__dirname, '../uploads/templates');

    if (!fs.existsSync(uploadsDir)) {
      return res.json({
        success: true,
        files: []
      });
    }

    const files = await fsPromises.readdir(uploadsDir);
    const userFiles = files
      .filter(file => file.includes(`template_${userId}_`) && file.endsWith('.pdf'))
      .map(async (filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = await fsPromises.stat(filePath);
        
        return {
          filename,
          size: stats.size,
          uploadedAt: stats.birthtime,
          accessUrl: `/api/pdf-upload/serve/${filename}`
        };
      });

    const fileList = await Promise.all(userFiles);

    res.json({
      success: true,
      files: fileList.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    });

  } catch (error) {
    console.error('❌ [PDF LIST] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list uploaded PDFs'
    });
  }
});

// Delete uploaded PDF
router.delete('/delete/:filename', simpleAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = (req as any).user?.user_id;
    
    // Security check: only allow users to delete their own files
    if (!filename.includes(`template_${userId}_`)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this file'
      });
    }

    const filePath = path.join(__dirname, '../uploads/templates', filename);

    if (fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
      console.log('🗑️ [PDF DELETE] File deleted:', filename);
      
      res.json({
        success: true,
        message: 'PDF deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'PDF file not found'
      });
    }

  } catch (error) {
    console.error('❌ [PDF DELETE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete PDF'
    });
  }
});

export default router;