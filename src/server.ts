import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const connectWithRetry = async (delay = 5000) => {
  while (true) {
    try {
      await mongoose.connect(process.env.MONGO_URI!);
      console.log('Connected to MongoDB');
      break;
    } catch (err) {
      console.error('MongoDB connection failed, retrying in 5s...');
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

const startServer = async () => {
  await connectWithRetry();
  app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
  });
};

startServer();