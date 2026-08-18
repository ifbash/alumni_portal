import { matchClaim, type DegreeRecord, type Claim } from '../src/lib/verification/matcher';

const REG: DegreeRecord[] = [
  { id: 'r1', rollNumber: '18B81A0501', name: 'Singanapalli Chinmayi', departmentCode: 'CSE', yearOfPassing: 2022, admissionYear: 2018 },
  { id: 'r2', rollNumber: '18B81A0502', name: 'Kambam Tejaswini Reddy', departmentCode: 'CSE', yearOfPassing: 2022, admissionYear: 2018 },
  { id: 'r3', rollNumber: '16B81A0455', name: 'Mohammed Basheer Ahmed', departmentCode: 'ECE', yearOfPassing: 2020, admissionYear: 2016 },
  { id: 'r4', rollNumber: '18B81A0503', name: 'K Tejaswini Reddy',      departmentCode: 'CSE', yearOfPassing: 2022, admissionYear: 2018 },
];

const cases: Array<[string, Claim, DegreeRecord[]]> = [
  ['exact match',
    { rollNumber: '18B81A0501', name: 'Singanapalli Chinmayi', departmentCode: 'CSE', batchYear: 2022 }, [REG[0]]],

  ['married surname change',
    { rollNumber: '18B81A0501', name: 'Chinmayi Rao', departmentCode: 'CSE', batchYear: 2022 }, [REG[0]]],

  ['initials instead of full name',
    { rollNumber: '18B81A0502', name: 'K Tejaswini Reddy', departmentCode: 'CSE', batchYear: 2022 }, [REG[1]]],

  ['transliteration variant',
    { rollNumber: '16B81A0455', name: 'Mohammad Bashir Ahmad', departmentCode: 'ECE', batchYear: 2020 }, [REG[2]]],

  ['junk roll "01" (seen in competitor queue)',
    { rollNumber: '01', name: 'Mohammed Basheer Ahmed', departmentCode: 'CSE', batchYear: 2020 }, REG],

  ['batch before admission year',
    { rollNumber: '22B81A0501', name: 'Singanapalli Chinmayi', departmentCode: 'CSE', batchYear: 2022 }, [REG[0]]],

  ['ambiguous — two similar names',
    { rollNumber: '18B81A0502', name: 'Tejaswini Reddy', departmentCode: 'CSE', batchYear: 2022 }, [REG[1], REG[3]]],

  ['impostor — right roll, wrong person',
    { rollNumber: '18B81A0501', name: 'Rakesh Kumar Verma', departmentCode: 'MECH', batchYear: 2019 }, [REG[0]]],

  ['not in register at all',
    { rollNumber: '99B81A9999', name: 'Nobody Here', departmentCode: 'CSE', batchYear: 2021 }, []],
];

let auto = 0, review = 0, reject = 0;
for (const [label, claim, cands] of cases) {
  const r = matchClaim(claim, cands);
  const conf = r.decision === 'auto_approve' ? r.confidence
    : r.decision === 'review' ? r.candidates[0]?.confidence ?? 0 : 0;
  if (r.decision === 'auto_approve') auto++;
  else if (r.decision === 'review') review++;
  else reject++;
  console.log(
    `${r.decision.toUpperCase().padEnd(13)} ${conf.toFixed(2)}  ${label}`,
  );
  console.log(`              reasons: ${r.reasons.join(', ') || '—'}`);
}
console.log(`\nauto ${auto} | review ${review} | reject ${reject}`);
