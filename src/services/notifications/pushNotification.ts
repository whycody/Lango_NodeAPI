import admin from 'firebase-admin';
import serviceAccountJson from '../../../firebase-key.json';

const serviceAccount = serviceAccountJson as admin.ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string,string>;
}

export const sendPushNotification = async (token: string, payload: PushPayload) => {
  try {
    await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
    });

    console.log(`Push notification sent to token: ${token}`);
  } catch (err) {
    console.error(`Failed to send push to ${token}:`, err);
  }
};
