import AsyncStorage from '@react-native-async-storage/async-storage';

const voiceGuidanceKey = 'preferences.brushing.voice-guidance-enabled';

export async function isBrushingVoiceGuidanceEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(voiceGuidanceKey);
  return stored !== 'false';
}

export async function setBrushingVoiceGuidanceEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(voiceGuidanceKey, String(enabled));
}

export const brushingVoicePromptKeysFourSix = [
  'brushing.voiceGuidance.fourSix.rightUpper',
  'brushing.voiceGuidance.fourSix.leftUpper',
  'brushing.voiceGuidance.fourSix.rightLower',
  'brushing.voiceGuidance.fourSix.leftLower',
] as const;

export const brushingVoicePromptKeysSevenEleven = [
  'brushing.voiceGuidance.sevenEleven.rightUpper',
  'brushing.voiceGuidance.sevenEleven.leftUpper',
  'brushing.voiceGuidance.sevenEleven.rightLower',
  'brushing.voiceGuidance.sevenEleven.leftLower',
] as const;
