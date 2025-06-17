import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app';

dotenv.config();

mongoose.connect(process.env.MONGO_URI!).then(() => {
  console.log('Connected to MongoDB');
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});