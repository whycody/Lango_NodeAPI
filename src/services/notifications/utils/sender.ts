import { sendPushNotification } from "../pushNotification";

export const sendNotificationToDevice = async (
  device: any,
  content: { title: string; body: string },
  type: "neutral" | "end",
  nowUTC: Date
) => {
  await sendPushNotification(device.token, content);

  if (type === "neutral") device.neutralTimeLastNotifiedAt = nowUTC;
  if (type === "end") device.endOfDayTimeLastNotifiedAt = nowUTC;
};
