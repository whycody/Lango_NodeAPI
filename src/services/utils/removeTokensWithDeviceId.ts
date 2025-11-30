import User from "../../models/core/User";

export const removeTokensWithDeviceId = async (deviceId: string) => {
  if (deviceId) {
    try {
      const user = await User.findOne({ 'notifications.deviceTokens.deviceId': deviceId });
      if (user) user.revokeTokensRelatedWithDeviceId(deviceId);
    } catch (err) {
      console.error('Failed to remove invalid push token:', err);
    }
  }
}