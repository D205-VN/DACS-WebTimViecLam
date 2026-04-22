const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const socketManager = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
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
const matchRoutes = require('./routes/matchRoutes');
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/match', matchRoutes);

// Initialize Socket.io
socketManager.init(server, allowedOrigins);

app.get('/api', (req, res) => {
    res.json({ message: 'Chào mừng đến với WebTimViec API' });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
