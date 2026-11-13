import path from 'node:path';
import { getAllData } from './dataLayer/dataGenerator/excelToJson';
import { getProjectConfig } from './configLayer/execution/projectsRegistry';

declare global {
  var testData: ReturnType<typeof getAllData>;
}

async function globalSetup(): Promise<void> {
  const project = process.env.PROJECT;
  const { excelFile, outputFolder } = getProjectConfig(project);

  console.log(`Generating JSON for project: ${project}`);

  globalThis.testData = getAllData(path.resolve(excelFile), path.resolve(outputFolder));

  const authMode = process.env.AGENT_PORTAL_AUTH;

  if (!authMode) {
    throw new Error('AGENT_PORTAL_AUTH must be set to one of: skip, allianz, sapiens');
  }
  switch (authMode) {
    case 'skip':
      console.log('Skipping agent portal authentication');
      break;

    default:
      throw new Error(`Unknown AGENT_PORTAL_AUTH method: ${authMode}`);
  }

  console.log('Global setup complete.');
}

export default globalSetup;
