import express, { Request, Response } from 'express';

import authRoutes from './routes/auth';
import evaluationsRoutes from './routes/evaluations';
import notificationsRoutes from './routes/notifications';
import sessionsRoutes from './routes/sessions';
import suggestionsRoutes from './routes/suggestions';
import translationsRoutes from './routes/translations';
import usersRoutes from './routes/users';
import wordRoutes from './routes/words';

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/evaluations', evaluationsRoutes);
app.use('/suggestions', suggestionsRoutes);
app.use('/translations', translationsRoutes);
app.use('/api', wordRoutes);
app.use('/notifications', notificationsRoutes);

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: 'API is working', status: 'OK' });
});

export default app;
