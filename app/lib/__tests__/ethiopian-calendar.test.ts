import {
  toEthiopian,
  formatEthiopianDeadline,
  gregToJDN,
  jdnToEth,
} from '../ethiopian-calendar';

describe('Ethiopian Calendar Conversion', () => {
  it('converts Gregorian date to accurate Ethiopian date (Tikimt 30, 2019)', () => {
    const gregDate = new Date('2026-11-09T16:00:00+03:00');
    const eth = toEthiopian(gregDate);

    expect(eth.year).toBe(2019);
    expect(eth.month).toBe(2);
    expect(eth.day).toBe(30);
    expect(eth.monthNameAm).toBe('ጥቅምት');
    expect(eth.monthNameEn).toBe('Tikimt');
  });

  it('correctly calculates Ethiopian hour with 6-hour shift (4:00 PM -> 10:00 ከሰዓት)', () => {
    const gregDate = new Date('2026-11-09T16:00:00');
    const eth = toEthiopian(gregDate);

    expect(eth.hour).toBe(10);
    expect(eth.periodAm).toBe('ከሰዓት');
    expect(eth.periodEn).toBe('Afternoon');
  });

  it('converts Ethiopian New Year (Meskerem 1, 2019)', () => {
    const gregDate = new Date('2026-09-11T12:00:00');
    const eth = toEthiopian(gregDate);

    expect(eth.year).toBe(2019);
    expect(eth.month).toBe(1);
    expect(eth.day).toBe(1);
    expect(eth.monthNameAm).toBe('መስከረም');
  });

  it('converts Pagume (13th month)', () => {
    const gregDate = new Date('2026-09-06T12:00:00');
    const eth = toEthiopian(gregDate);

    expect(eth.year).toBe(2018);
    expect(eth.month).toBe(13);
    expect(eth.day).toBe(1);
    expect(eth.monthNameAm).toBe('ጳጉሜ');
  });

  it('formats Ethiopian deadline into a readable Amharic string', () => {
    const gregDate = new Date('2026-11-09T16:00:00');
    const formatted = formatEthiopianDeadline(gregDate);

    expect(formatted).toBe('ጥቅምት 30, 2019 ዓ.ም (10:00 ከሰዓት)');
  });
});

