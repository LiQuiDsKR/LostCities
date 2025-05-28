export const extensionRules = {
  useRainbow11: false,
};

export const SPECIAL_CARD = {
  RAINBOW_11: { color: 'rainbow', value: 11 },
};

export function isRainbow11(card) {
  return card.color === 'rainbow' && card.value === 11;
}

export function canPlayCardWithExtensions(stack, card, rules) {
  const last = stack.at(-1);

  if (rules.useRainbow11 && isRainbow11(card)) {
    return last && last.value === 10;
  }

  return true;
}
