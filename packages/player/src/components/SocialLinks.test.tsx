import { openUrl } from '@tauri-apps/plugin-opener';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SocialLinks } from './SocialLinks';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

describe('SocialLinks', () => {
  beforeEach(() => {
    vi.mocked(openUrl).mockClear();
  });

  it('opens GitHub URL when GitHub button is clicked', async () => {
    render(<SocialLinks />);

    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);

    expect(openUrl).toHaveBeenCalledWith(
      'https://github.com/danidetenerife/nucelar',
    );
  });
});
