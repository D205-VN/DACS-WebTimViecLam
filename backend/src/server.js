const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Routes
const jobRoutes = require('./routes/jobRoutes');
const authRoutes = require('./routes/authRoutes');
const cvRoutes = require('./routes/cvRoutes');
const employerRoutes = require('./routes/employerRoutes');
app.use('/api/jobs', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/employer', employerRoutes);

app.get('/api', (req, res) => {
    res.json({ message: 'Chào mừng đến với WebTimViec API' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
