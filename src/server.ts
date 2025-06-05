import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import wordRoutes from './routes/words';
import sessionsRoutes from './routes/sessions';
import evaluationsRoutes from './routes/evaluations';
import suggestionsRoutes from "./routes/suggestions";

dotenv.config();

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/evaluations', evaluationsRoutes);
app.use('/suggestions', suggestionsRoutes);
app.use('/api', wordRoutes);

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'API is working', status: 'OK' });
});

mongoose.connect(process.env.MONGO_URI!).then(() => {
  console.log('Connected to MongoDB');
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});
