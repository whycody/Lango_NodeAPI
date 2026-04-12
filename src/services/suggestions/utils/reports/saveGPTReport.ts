import GPTReport from '../../../../models/reports/GPTReport';
import { GPTReportAttr } from '../../../../types/models/GPTReportAttr';

export async function saveGPTReport(data: GPTReportAttr) {
    try {
        return await GPTReport.create(data);
    } catch (error) {
        console.error('Error logging prompt report:', error);
        throw error;
    }
}
