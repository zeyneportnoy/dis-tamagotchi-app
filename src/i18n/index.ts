import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { tr } from './resources/tr';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'tr',
  lng: 'tr',
  resources: { tr },
  interpolation: { escapeValue: false },
});

export default i18n;
