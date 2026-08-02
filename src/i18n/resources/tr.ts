export const tr = {
  translation: {
    common: {
      loading: 'Hazırlanıyor…',
      continue: 'Devam et',
      saving: 'Kaydediliyor…',
      errorTitle: 'Bir şeyler ters gitti',
      errorBody: 'Birlikte yeniden deneyebiliriz.',
    },
    welcome: {
      title: 'Diş arkadaşınla tanış!',
      body: 'Önce sana nasıl sesleneceğimizi seçelim.',
      continue: 'Devam et',
    },
    onboarding: {
      accountless: {
        title: 'Hesap gerekmiyor',
        body: 'Bilgiler bu cihazda kalır. E-posta veya tam ad istemeyiz.',
        continue: 'Hesap açmadan devam et',
      },
      nickname: {
        title: 'Sana nasıl seslenelim?',
        body: 'Tam adın yerine kısa bir takma ad seçebilirsin.',
        label: 'Çocuk takma adı',
        placeholder: 'Takma ad',
        error: '1–20 karakter arasında bir takma ad deneyelim.',
      },
      ageBand: {
        title: 'Yaş grubunu seç',
        sixEight: '6–8 yaş',
        nineTen: '9–10 yaş',
      },
      character: {
        title: 'Başlangıç arkadaşını seç',
        options: {
          'cheerful-incisor': 'Neşeli Kesici',
          'sleepy-molar': 'Uykucu Azı',
          'brave-canine': 'Cesur Köpek Dişi',
        },
      },
      summary: {
        title: 'Hazır mıyız?',
        nickname: 'Takma ad: {{nickname}}',
        create: 'Profili oluştur',
        error: 'Kaydederken küçük bir sorun oldu. Yeniden deneyebiliriz.',
      },
    },
    childHome: {
      title: 'Merhaba, {{nickname}}!',
      placeholder: 'Çocuk ana ekranı bir sonraki adımlarda gelişecek.',
      parentArea: 'Veli alanı',
      switchProfile: 'Profil seç',
    },
    parent: {
      title: 'Veli alanı',
      placeholder: 'Güvenli veli araçları sonraki adımlarda eklenecek.',
      addProfile: 'Çocuk profili ekle',
    },
    parentGate: {
      title: 'Veli kontrolü',
      question: '{{left}} + {{right}} kaç eder?',
      answerLabel: 'Toplama sorusunun cevabı',
      incorrect: 'Bir kez daha sakince deneyebiliriz.',
      submit: 'Kontrol et',
    },
  },
} as const;
