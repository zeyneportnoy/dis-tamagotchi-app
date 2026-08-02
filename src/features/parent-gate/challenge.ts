export type ParentChallenge = Readonly<{ left: number; right: number; answer: number }>;

export function createParentChallenge(random: () => number = Math.random): ParentChallenge {
  const left = 4 + Math.floor(random() * 8);
  const right = 3 + Math.floor(random() * 7);
  return { left, right, answer: left + right };
}
