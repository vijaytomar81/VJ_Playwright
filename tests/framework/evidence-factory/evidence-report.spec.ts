import fs from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { test, expect } from '@playwright/test';

import {
  evidenceFields,
  type EvidenceData,
} from '../../../configLayer/schema/evidence/evidence-schema';

import {
  EvidenceFactory,
  ReportFormat,
} from '../../../evidenceFactory';

const runId = 'evidence-four-workers';
const resultsDir = './results';

test('Generate one Excel report from four workers', async () => {
  const factory =
    new EvidenceFactory<EvidenceData>({
      fields: evidenceFields,
      resultsDir,
      runId,
    });

  const outputDir = path.join(
    resultsDir,
    runId,
    'report',
  );

  const result = await factory.generateReport({
    format: ReportFormat.EXCEL,
    outputDir,
    fileName: 'execution-report',
    reportTitle: 'Four Worker Evidence Report',
    environment: 'TEST',
  });

  expect(result.evidenceCount).toBe(4);

  const stat = await fs.stat(result.reportPath);
  expect(stat.size).toBeGreaterThan(0);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(result.reportPath);

  expect(workbook.worksheets.map((sheet) => sheet.name))
    .toEqual([
      'Summary',
      'All',
      'Passed',
      'Failed',
      'Not Executed',
    ]);

  expect(workbook.getWorksheet('All')?.rowCount).toBe(5);
  expect(workbook.getWorksheet('Passed')?.rowCount).toBe(3);
  expect(workbook.getWorksheet('Failed')?.rowCount).toBe(2);
  expect(workbook.getWorksheet('Not Executed')?.rowCount).toBe(2);

  console.log(`Excel report generated: ${result.reportPath}`);
});
