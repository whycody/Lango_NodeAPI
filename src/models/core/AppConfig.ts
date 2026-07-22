import { Document, model, Schema } from 'mongoose';

interface AppConfig extends Document {
    requiredMinimalAppVersion: string;
    recommendedMinimalAppVersion: string;
}

const appConfigSchema = new Schema<AppConfig>({
    recommendedMinimalAppVersion: { required: true, type: String },
    requiredMinimalAppVersion: { required: true, type: String },
});

export default model<AppConfig>('AppConfig', appConfigSchema, 'app_config');
