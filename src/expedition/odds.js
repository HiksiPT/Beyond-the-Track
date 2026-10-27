// Outcome probability from a base and [condition, delta, explanation] factors; the explanations are shown
// to the player so every outcome can be understood.
export function odds(base, factors) {
  let p = base;
  const why = [];
  for (const [cond, delta, text] of factors) if (cond) { p += delta; why.push((delta < 0 ? '− ' : '+ ') + text); }
  return { p: Math.max(0.03, Math.min(0.97, p)), why };
}
