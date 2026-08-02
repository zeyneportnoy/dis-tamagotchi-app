const enabled = (value: string | undefined) => value === 'true';

export const featureFlags = Object.freeze({
  analytics: enabled(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED),
  cloud: enabled(process.env.EXPO_PUBLIC_CLOUD_ENABLED),
  subscriptions: enabled(process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED),
  purchases: enabled(process.env.EXPO_PUBLIC_PURCHASES_ENABLED),
});
