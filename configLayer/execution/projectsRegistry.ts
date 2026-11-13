export interface ProjectConfig {
  testDir: string;
  excelFile: string;
  outputFolder: string;
}

export const projects: Record<string, ProjectConfig> = {
  allianzOnlineMotor: {
    testDir: './automationLayer/athena/carInsurance/az_motor/tests',
    excelFile: './automationLayer/athena/carInsurance/az_motor/data/AllianzOnlineMotor_NB_DJ.xlsx',
    outputFolder: './automationLayer/athena/carInsurance/az_motor/data',
  },
  allianzOnlineHome: {
    testDir: './automationLayer/athena/homeInsurance/az_home/tests',
    excelFile:
      './automationLayer/athena/homeInsurance/az_home/data/AllianzOnlineHome_DirectJourney.xlsx',
    outputFolder: './automationLayer/athena/homeInsurance/az_home/data',
  },
  britannia: {
    testDir: './automationLayer/athena/carInsurance/britannia/tests',
    excelFile: './automationLayer/athena/carInsurance/britannia/data/Britannia_NB_DJ.xlsx',
    outputFolder: './automationLayer/athena/carInsurance/britannia/data',
  },
  britannia_Declines: {
    testDir: './automationLayer/athena/carInsurance/britannia/tests/Declines',
    excelFile: './automationLayer/athena/carInsurance/britannia/data/DeclineRulesData.xlsx',
    outputFolder: './automationLayer/athena/carInsurance/britannia/data',
  },
  ferry: {
    testDir: './automationLayer/ferry/tests',
    excelFile: './automationLayer/ferry/data/Ferry_NB_DJ.xlsx',
    outputFolder: './automationLayer/ferry/data',
  },
  PCW_Goco: {
    testDir: './automationLayer/PCW/Goco/tests',
    excelFile: './automationLayer/PCW/Goco/data/Goco_NB.xlsx',
    outputFolder: './automationLayer/PCW/Goco/data',
  },
};

export function getProjectConfig(name: string | undefined): ProjectConfig {
  if (!name || !projects[name]) {
    throw new Error(`PROJECT must be one of: ${Object.keys(projects).join(', ')}. Got: ${name}`);
  }
  return projects[name];
}
