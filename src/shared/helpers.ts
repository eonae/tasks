// TODO: move to @libs/common

const enumMembers = (e: any, get: 'keys' | 'values'): (string | number)[] => {
  const numeric = Object
    .values(e)
    .filter(v => typeof v === 'number')
    .map(n => n + '');
  return Object
    .entries(e)
    .filter(([ key ]) => !numeric.includes(key))
    .map(pair => pair[get === 'keys' ? 0 : 1] as string | number);
}

export const enumKeys = (e: any): string[] =>
  enumMembers(e, 'keys') as string[];

export const enumValues = (e: any): (string | number)[] =>
  enumMembers(e, 'values');

// enum Enum0 {
//   one = 0,
//   two = 1,
// }

// enum Enum1 {
//   one = 0,
//   two = 1,
// }

// enum Enum2 {
//   one = 'once',
//   two = 'twice'
// }

// enum Enum3 {
//   one = 0,
//   two = 'twice'
// }

// console.log(enumKeys(Enum0));
// console.log(enumKeys(Enum1));
// console.log(enumKeys(Enum2));
// console.log(enumKeys(Enum3));
// console.log(enumValues(Enum0));
// console.log(enumValues(Enum1));
// console.log(enumValues(Enum2));
// console.log(enumValues(Enum3));