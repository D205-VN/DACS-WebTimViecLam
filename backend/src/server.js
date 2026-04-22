const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const socketManager = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
    origin: frontendUrl, // Render sẽ lấy link Vercel bạn đã nhập ở Env Vars
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

// Routes
const jobRoutes = require('./routes/jobRoutes');
const authRoutes = require('./routes/authRoutes');
const cvRoutes = require('./routes/cvRoutes');
const adminRoutes = require('./routes/adminRoutes');
const employerRoutes = require('./routes/employerRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/notifications', notificationRoutes);

// Initialize Socket.io
socketManager.init(server, frontendUrl);

app.get('/api', (req, res) => {
    res.json({ message: 'Chào mừng đến với WebTimViec API' });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
