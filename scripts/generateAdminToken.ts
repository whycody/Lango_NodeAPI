import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const userId = process.argv[2];

if (!userId) {
    console.error('Usage: npx ts-node scripts/generateAdminToken.ts <adminUserId>');
    process.exit(1);
}

if (!process.env.ACCESS_TOKEN_SECRET) {
    console.error('ACCESS_TOKEN_SECRET is not set in the environment');
    process.exit(1);
}

const token = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10y' });

console.log(token);
