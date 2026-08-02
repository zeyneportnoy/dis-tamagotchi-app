import { render } from '@testing-library/react-native';

import WelcomeScreen from '../index';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

describe('Welcome route', () => {
  it('renders Turkish content from i18n', async () => {
    const view = await render(<WelcomeScreen />);
    expect(view.getByTestId('welcome-screen')).toBeTruthy();
    expect(view.getByText('Diş arkadaşınla tanış!')).toBeTruthy();
  });
});
