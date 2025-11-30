import Session from '../../models/core/Session';
import { SuggestedTime } from "../../models/core/User";

interface BestTimes {
  neutralTime: SuggestedTime;
  endOfDayTime: SuggestedTime;
}

export const calculateBestTimes = async (userId: string): Promise<BestTimes | null> => {
  try {
    const sessions = await Session.find({ userId })
      .sort({ date: -1 })
      .limit(100);

    if (sessions.length === 0) return null;

    const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

    const neutralMinutes = sessions
      .map(s => toMinutes(new Date(s.date)))
      .sort((a, b) => a - b);

    const midNeutral = Math.floor(neutralMinutes.length / 2);
    const medianNeutral = neutralMinutes.length % 2 === 0
      ? Math.floor((neutralMinutes[midNeutral - 1] + neutralMinutes[midNeutral]) / 2)
      : neutralMinutes[midNeutral];

    const neutralTime: SuggestedTime = {
      hour: Math.floor(medianNeutral / 60),
      minute: medianNeutral % 60,
    };

    const endRangeMinutes = sessions
      .map(s => new Date(s.date))
      .filter(d => d.getHours() >= 20 && d.getHours() <= 23)
      .map(toMinutes)
      .sort((a, b) => a - b);

    let endOfDayTime: SuggestedTime;

    if (endRangeMinutes.length === 0) {
      endOfDayTime = { hour: 22, minute: 0 };
    } else {
      const midEnd = Math.floor(endRangeMinutes.length / 2);
      const medianEnd = endRangeMinutes.length % 2 === 0
        ? Math.floor((endRangeMinutes[midEnd - 1] + endRangeMinutes[midEnd]) / 2)
        : endRangeMinutes[midEnd];

      endOfDayTime = {
        hour: Math.floor(medianEnd / 60),
        minute: medianEnd % 60,
      };
    }

    const neutralTotal = neutralTime.hour * 60 + neutralTime.minute;
    let endTotal = endOfDayTime.hour * 60 + endOfDayTime.minute;

    const minAllowed = neutralTotal + 120;
    if (endTotal < minAllowed) {
      endTotal = minAllowed;
    }

    const ABS_MIN = 21 * 60;
    if (endTotal < ABS_MIN) {
      endTotal = ABS_MIN;
    }

    const ABS_MAX = 23 * 60 + 30;
    if (endTotal > ABS_MAX) {
      endTotal = ABS_MAX;
    }

    endOfDayTime = {
      hour: Math.floor(endTotal / 60),
      minute: endTotal % 60,
    };

    return { neutralTime, endOfDayTime };

  } catch (error) {
    console.error("Failed to calculate best times:", error);
    return null;
  }
};
