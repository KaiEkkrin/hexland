export function modFloor(a: number, b: number): number {
  var mod = a % b;
  return mod >= 0 ? mod : mod + b;
}