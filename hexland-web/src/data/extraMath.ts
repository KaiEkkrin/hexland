export function modFloor(a: number, b: number): number {
  let mod = a % b;
  return mod >= 0 ? mod : mod + b;
}