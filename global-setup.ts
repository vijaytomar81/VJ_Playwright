
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { FullConfig } from '@playwright/test';

import sapiensAgentPortalAuth from './automationLayer/agentPortalAuth/sapiensAgentPortalAuth';
import allianzAgentPortalAuth from 'automationLayer/agentPortalAuth/allianzAgentPortalAuth';
import { getAllData } from './dataLayer/dataGenerator/excelToJson';
import sapiensAgentPortalAuthKeycloak from 'automationLayer/agentPortalAuth/sapiensAgentPortalAuthKeycloak';
import { getProjectConfig } from './configLayer/execution/projectsRegistry';

declare global {
  var testData: ReturnType<typeof getAllData>;
}

async function globalSetup(config: FullConfig): Promise<void> {

  /*
   * EVIDENCEFACTORY RUN INITIALIZATION
   *
   * Derive the run directory from Playwright's resolved outputDir.
   * This avoids generating another Run ID in global setup.
   *
   * Configured structure:
   *
   * run-<timestamp>/
   *   test-artifacts/
   *
   * The parent directory is the EvidenceFactory run directory.
   */

  const artifactsDirectory = config.projects[0]?.outputDir;

  if (!artifactsDirectory) {
    throw new Error(
      'EvidenceFactory: Playwright outputDir is not configured.',
    );
  }

  const outputDirectory = path.dirname(artifactsDirectory);
  const runId = path.basename(outputDirectory).replace(/^run-/, '');

  await mkdir(outputDirectory, { recursive: true });

  console.log('EvidenceFactory execution initialized');
  console.log(`Run ID: ${runId}`);
  console.log(`Evidence directory: ${outputDirectory}`);

  /*
   * JENKINS EXECUTION METADATA
   *
   * Jenkins automatically provides these variables when available.
   * Local executions do not require them.
   */

  if (
    process.env.BUILD_NUMBER ||
    process.env.BUILD_ID ||
    process.env.JOB_NAME
  ) {
    console.log(`Jenkins Build Number: ${process.env.BUILD_NUMBER || 'Not Known'}`);
    console.log(`Jenkins Build ID: ${process.env.BUILD_ID || 'Not Known'}`);
    console.log(`Jenkins Job Name: ${process.env.JOB_NAME || 'Not Known'}`);
  }

  /*
   * EXISTING PROJECT DATA INITIALIZATION
   */

  const project = process.env.PROJECT;
  const { excelFile, outputFolder } = getProjectConfig(project);

  console.log(`Generating JSON for project: ${project}`);

  globalThis.testData = getAllData(
    path.resolve(excelFile),
    path.resolve(outputFolder),
  );

  /*
   * EXISTING AGENT PORTAL AUTHENTICATION
   */

  const authMode = process.env.AGENT_PORTAL_AUTH;

  if (!authMode) {
    throw new Error(
      'AGENT_PORTAL_AUTH must be set to one of: skip, allianz, sapiens',
    );
  }

  switch (authMode) {
    case 'skip':
      console.log('Skipping agent portal authentication');
      break;

    case 'allianz':
      console.log('Running Allianz Agent Portal authentication');
      await allianzAgentPortalAuth();
      break;

    case 'sapiens':
      console.log('Running Sapiens Agent Portal authentication');
      await sapiensAgentPortalAuth();
      break;

    case 'sapiensKeycloak':
      console.log('Running Sapiens Agent Portal authentication');
      await sapiensAgentPortalAuthKeycloak();
      break;

    default:
      throw new Error(`Unknown AGENT_PORTAL_AUTH method: ${authMode}`);
  }

  console.log('Global setup complete.');
}

export default globalSetup;
