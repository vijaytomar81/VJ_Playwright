import dotenv from 'dotenv';
import path from 'node:path';

const project = process.env.PROJECT;
const env = process.env.ENV ?? 'dev';

if (project) {
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
