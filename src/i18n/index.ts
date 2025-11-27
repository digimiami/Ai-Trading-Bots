import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import messages from './local/index';

// Get saved language from localStorage or use browser default
const savedLanguage = localStorage.getItem('i18nextLng') || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: savedLanguage,
    fallbackLng: 'en',
    debug: false,
    resources: messages,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Listen for language changes and save to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
});

export default i18n;