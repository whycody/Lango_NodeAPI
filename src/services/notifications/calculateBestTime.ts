import Session from '../../models/core/Session';

interface SuggestedTime {
  hour: number;
  minute: number;
}

export const calculateBestTime = async (userId: string): Promise<SuggestedTime | null> => {
  try {
    const sessions = await Session.find({ userId, finished: true }).sort({ date: -1 }).limit(100);

    if (sessions.length === 0) return null;

    const minutesSinceMidnight = sessions.map(s => {
      const d = new Date(s.date);
      return d.getHours() * 60 + d.getMinutes();
    }).sort((a, b) => a - b);

    const mid = Math.floor(minutesSinceMidnight.length / 2);
    const medianMinutes = minutesSinceMidnight.length % 2 === 0
      ? Math.floor((minutesSinceMidnight[mid - 1] + minutesSinceMidnight[mid]) / 2)
      : minutesSinceMidnight[mid];

    const hour = Math.floor(medianMinutes / 60);
    const minute = medianMinutes % 60;

    return { hour, minute };
  } catch (error) {
    console.error("Failed to calculate notification time:", error);
    return null;
  }
};

