import { render } from '@testing-library/react-native';

import { BrandedSplash } from '../BrandedSplash';

describe('BrandedSplash', () => {
  it('shows the approved static DentHero splash without a loading indicator', async () => {
    const view = await render(<BrandedSplash />);

    expect(view.getByTestId('denthero-branded-splash')).toBeTruthy();
    expect(view.queryByRole('progressbar')).toBeNull();
  });
});
