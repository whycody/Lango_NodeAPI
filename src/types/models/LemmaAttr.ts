import { Types } from 'mongoose';

import { LanguageCodeValue } from '../../constants/languageCodes';
import { LemmaTypeValue } from '../../constants/lemmasTypes';

export type LemmaAttr = {
    lemma: string;
    type: LemmaTypeValue;
    lang: LanguageCodeValue;
    prefix: string;
    freq: number;
    freq_z: number;
};

export type LemmaAttrWithId = LemmaAttr & { _id: Types.ObjectId | string };
