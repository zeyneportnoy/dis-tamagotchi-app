import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { getSupabaseClient } from '@/data/auth';

import type { BrushingVoiceProfile } from './voiceGuidance';

export const personalizedVoiceModelVersion = 'gokce-v1';
export const personalizedVoiceCueIndexes = [0, 2] as const;

export type PersonalizedVoiceCueIndex = (typeof personalizedVoiceCueIndexes)[number];

export type PersonalizedVoiceIdentity = Readonly<{
  childProfileId: string;
  normalizedNickname: string;
  profile: BrushingVoiceProfile;
  cueIndex: PersonalizedVoiceCueIndex;
  modelVersion: string;
}>;

type PersonalizedVoiceProxyResponse = Readonly<{ audioUrl?: unknown }>;

const metadataPrefix = 'brushing.personalized-voice-cache.';

export function normalizeVoiceNickname(nickname: string): string {
  return nickname.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export function createPersonalizedVoiceIdentity(input: {
  childProfileId: string;
  nickname: string;
  profile: BrushingVoiceProfile;
  cueIndex: PersonalizedVoiceCueIndex;
}): PersonalizedVoiceIdentity {
  return {
    childProfileId: input.childProfileId,
    normalizedNickname: normalizeVoiceNickname(input.nickname),
    profile: input.profile,
    cueIndex: input.cueIndex,
    modelVersion: personalizedVoiceModelVersion,
  };
}

async function cacheId(identity: PersonalizedVoiceIdentity): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(identity));
}

async function cachedUri(identity: PersonalizedVoiceIdentity): Promise<string | null> {
  const id = await cacheId(identity);
  const stored = await AsyncStorage.getItem(`${metadataPrefix}${id}`);
  if (!stored) return null;
  const info = await FileSystem.getInfoAsync(stored);
  return info.exists ? stored : null;
}

function proxyUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_PERSONALIZED_VOICE_PROXY_URL?.trim();
  return value ? value : null;
}

async function requestSignedAudioUrl(
  endpoint: string,
  identity: PersonalizedVoiceIdentity,
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const accessToken = (await client.auth.getSession()).data.session?.access_token;
  if (!accessToken) return null;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as PersonalizedVoiceProxyResponse;
  return typeof payload.audioUrl === 'string' && payload.audioUrl.length > 0
    ? payload.audioUrl
    : null;
}

export async function getCachedPersonalizedVoiceCue(input: {
  childProfileId: string;
  nickname: string;
  profile: BrushingVoiceProfile;
  cueIndex: PersonalizedVoiceCueIndex;
}): Promise<string | null> {
  if (input.profile !== 'gokce' || normalizeVoiceNickname(input.nickname).length === 0) return null;
  return cachedUri(createPersonalizedVoiceIdentity(input));
}

/**
 * Warms a personalized cue without ever blocking brushing. The trusted proxy owns the
 * ElevenLabs secret and returns a short-lived signed audio URL; the app only stores audio locally.
 */
export async function warmPersonalizedVoiceCue(input: {
  childProfileId: string;
  nickname: string;
  profile: BrushingVoiceProfile;
  cueIndex: PersonalizedVoiceCueIndex;
}): Promise<string | null> {
  const identity = createPersonalizedVoiceIdentity(input);
  if (identity.profile !== 'gokce' || identity.normalizedNickname.length === 0) return null;
  const existing = await cachedUri(identity);
  if (existing) return existing;
  const endpoint = proxyUrl();
  if (!endpoint) return null;
  const audioUrl = await requestSignedAudioUrl(endpoint, identity);
  if (!audioUrl || !FileSystem.cacheDirectory) return null;
  const id = await cacheId(identity);
  const directory = `${FileSystem.cacheDirectory}personalized-brushing-voice/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${id}.mp3`;
  const downloaded = await FileSystem.downloadAsync(audioUrl, destination);
  await AsyncStorage.setItem(`${metadataPrefix}${id}`, downloaded.uri);
  return downloaded.uri;
}
