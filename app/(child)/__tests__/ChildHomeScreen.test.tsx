import { render } from '@testing-library/react-native';

import ChildHomeScreen from '../index';

describe('Child Home route', () => {
  it('renders the Turkish placeholder', async () => {
    const view = await render(<ChildHomeScreen />);
    expect(view.getByTestId('child-home-screen')).toBeTruthy();
    expect(view.getByText('Çocuk ana ekranı bir sonraki adımlarda gelişecek.')).toBeTruthy();
  });
});
