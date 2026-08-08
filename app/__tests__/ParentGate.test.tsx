import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import ParentGateScreen from '../parent-gate';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() },
}));
jest.mock('@/features/parent-gate/challenge', () => ({
  createParentChallenge: () => ({ left: 2, right: 3, answer: 5 }),
}));

describe('parent gate', () => {
  it('keeps a wrong answer in the gate and accepts the correct answer', async () => {
    const view = await render(<ParentGateScreen />);
    const input = view.getByLabelText('Toplama sorusunun cevabı');
    await fireEvent.changeText(input, '4');
    await fireEvent.press(view.getByRole('button', { name: 'Kontrol et' }));
    expect(view.getByText('Bir kez daha sakince deneyebiliriz.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '5');
    await fireEvent.press(view.getByRole('button', { name: 'Kontrol et' }));
    expect(router.replace).toHaveBeenCalledWith('/(parent)');
  });

  it('provides an accessible back control on the detail screen', async () => {
    const view = await render(<ParentGateScreen />);
    await fireEvent.press(view.getByRole('button', { name: 'Geri' }));
    expect(router.back).toHaveBeenCalled();
  });
});
