const mockSetAudioModeAsync = jest.fn(() => Promise.resolve());

describe('ensureVoicePreviewAudioMode', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSetAudioModeAsync.mockClear();
    jest.doMock('expo-audio', () => ({
      setAudioModeAsync: mockSetAudioModeAsync,
    }));
  });

  it('sets ONLY playsInSilentMode, leaving interruption/recording mode untouched', async () => {
    const { ensureVoicePreviewAudioMode } = await import('../voicePreview');
    await ensureVoicePreviewAudioMode();
    expect(mockSetAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true });
  });

  it('calls the native API exactly once per app session, no matter how many preview taps follow', async () => {
    const { ensureVoicePreviewAudioMode } = await import('../voicePreview');
    // Two "different" callers racing (e.g. onboarding + Settings screens
    // both mounted at once is not realistic, but two rapid taps on the same
    // screen is) must never re-issue the native call.
    await Promise.all([
      ensureVoicePreviewAudioMode(),
      ensureVoicePreviewAudioMode(),
      ensureVoicePreviewAudioMode(),
    ]);
    await ensureVoicePreviewAudioMode();
    expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('never rejects even if the native call fails, so a preview tap can still attempt to play', async () => {
    mockSetAudioModeAsync.mockRejectedValueOnce(new Error('native failure'));
    const { ensureVoicePreviewAudioMode } = await import('../voicePreview');
    await expect(ensureVoicePreviewAudioMode()).resolves.toBeUndefined();
  });
});
