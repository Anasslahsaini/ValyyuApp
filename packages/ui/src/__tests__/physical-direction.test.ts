import { findPhysicalDirection } from '../test-utils/physical-direction';

describe('findPhysicalDirection', () => {
  it.each([
    ['marginLeft: 4', 'marginLeft'],
    ["'paddingRight': 4", 'paddingRight'],
    ['left: 0', 'left'],
    ['borderTopLeftRadius: 8', 'borderTopLeftRadius'],
    ["textAlign: 'right'", "textAlign: 'right'"],
    ['alignSelf: "left"', 'alignSelf: "left"'],
    ["flexDirection: 'row-reverse'", "flexDirection: 'row-reverse'"],
  ])('flags %s', (source, expected) => {
    expect(findPhysicalDirection(source)).toContain(expected);
  });

  it.each([
    'marginStart: 4',
    'borderEndWidth: 2',
    "textAlign: 'center'",
    'borderTopStartRadius: 8',
    "flexDirection: 'row'",
  ])('accepts %s', (source) => {
    expect(findPhysicalDirection(source)).toEqual([]);
  });
});
