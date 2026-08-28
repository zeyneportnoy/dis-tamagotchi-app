import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import NicknameScreen from '../nickname';

const mockSetNickname = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/application/family', () => ({ getFamilyUseCases: jest.fn() }));
jest.mock('@/features/onboarding/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    ageBand: null,
    avatarId: null,
    nickname: '',
    profileId: null,
    setNickname: mockSetNickname,
  }),
}));

describe('nickname onboarding input', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the standard keyboard and preserves Turkish characters', async () => {
    const view = await render(<NicknameScreen />);
    const input = view.getByLabelText('Çocuk takma adı');

    expect(input.props.keyboardType).toBe('default');
    await fireEvent.changeText(input, 'Işıl Şen');
    await fireEvent.press(view.getByRole('button', { name: 'Devam et' }));

    expect(mockSetNickname).toHaveBeenCalledWith('Işıl Şen');
    expect(router.push).toHaveBeenCalledWith('/onboarding/age-band');
  });
});
