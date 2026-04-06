import { Languages } from '../types/shared/Language';
import { BaseWord } from './baseWords';

export const languages: Languages = {
    en: {
        definedArticles: ['the'],
        exampleTranslations: {
            [BaseWord.Beautiful]: 'beautiful',
            [BaseWord.Dog]: 'dog',
            [BaseWord.King]: 'king',
            [BaseWord.Rich]: 'rich',
            [BaseWord.ToRun]: 'to run',
            [BaseWord.ToSing]: 'to sing',
        },
        languageCode: 'en',
        languageName: 'English',
    },
    es: {
        definedArticles: ['el', 'la', 'las', 'los'],
        exampleTranslations: {
            [BaseWord.Beautiful]: 'hermoso',
            [BaseWord.Dog]: 'el perro',
            [BaseWord.King]: 'el rey',
            [BaseWord.Rich]: 'rico',
            [BaseWord.ToRun]: 'correr',
            [BaseWord.ToSing]: 'cantar',
        },
        languageCode: 'es',
        languageName: 'Spanish',
    },
    it: {
        definedArticles: ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'],
        exampleTranslations: {
            [BaseWord.Beautiful]: 'bello',
            [BaseWord.Dog]: 'il cane',
            [BaseWord.King]: 'il re',
            [BaseWord.Rich]: 'ricco',
            [BaseWord.ToRun]: 'correre',
            [BaseWord.ToSing]: 'cantare',
        },
        languageCode: 'it',
        languageName: 'Italian',
    },
    pl: {
        definedArticles: null,
        exampleTranslations: {
            [BaseWord.Beautiful]: 'ładny',
            [BaseWord.Dog]: 'pies',
            [BaseWord.King]: 'król',
            [BaseWord.Rich]: 'bogaty',
            [BaseWord.ToRun]: 'biegać',
            [BaseWord.ToSing]: 'śpiewać',
        },
        languageCode: 'pl',
        languageName: 'Polish',
    },
};
