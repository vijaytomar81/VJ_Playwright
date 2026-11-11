import dotenv from 'dotenv';
import path from 'node:path';

// Called from createConfig() rather than run on import: the per-brand configs know their project
// only at call time, and import-time code would run before they could set it.
export function loadEnvironment(project: string) {
  // global-setup.ts and the test workers read PROJECT from the environment.
  process.env.PROJECT = project;
  const env = process.env.ENV ?? 'dev';

  const environmentProjects: Record<string, string> = {
    allianzOnlineMotor: 'allianzOnline',
    allianzOnlineHome: 'allianzOnline',
    PCW_Goco: 'PCW/Goco',
  };

  const environmentProject = environmentProjects[project] ?? project;

  const environmentDirectory = path.resolve(`configLayer/environments/${environmentProject}`);

  const envPath = path.join(environmentDirectory, `.env.${env}`);

  const localEnvPath = path.join(environmentDirectory, `.env.local.${env}`);

  dotenv.config({
    path: envPath,
  });

  dotenv.config({
    path: localEnvPath,
    override: true,
  });

  console.log(`Project: ${project}`);
  console.log(`Environment project: ${environmentProject}`);
  console.log(`Environment: ${env}`);
  console.log(`Environment file: ${envPath}`);
  console.log(`Local environment file: ${localEnvPath}`);
}
